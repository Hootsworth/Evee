import { describe, it, expect } from 'vitest';
import {
  hasMinimumRole,
  canManageSettings,
  canApproveDrafts,
  canDispatchOutreach,
  canViewAnalytics,
  canManageMembers,
  assertAuthenticated,
  assertAuthorized,
  isOrganizationMember,
  AuthenticationError,
  AuthorizationError,
} from '@/lib/auth/rbac';
import { resolveUserContext, createWorkerContext } from '@/lib/auth/context';

describe('Role-Based Access Control (RBAC) & Tenant Security', () => {
  it('correctly evaluates role hierarchy', () => {
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
    expect(hasMinimumRole('admin', 'operator')).toBe(true);
    expect(hasMinimumRole('admin', 'viewer')).toBe(true);

    expect(hasMinimumRole('operator', 'admin')).toBe(false);
    expect(hasMinimumRole('operator', 'operator')).toBe(true);
    expect(hasMinimumRole('operator', 'viewer')).toBe(true);

    expect(hasMinimumRole('viewer', 'admin')).toBe(false);
    expect(hasMinimumRole('viewer', 'operator')).toBe(false);
    expect(hasMinimumRole('viewer', 'viewer')).toBe(true);
  });

  it('restricts admin-only settings capabilities', () => {
    expect(canManageSettings('admin')).toBe(true);
    expect(canManageSettings('operator')).toBe(false);
    expect(canManageSettings('viewer')).toBe(false);

    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('operator')).toBe(false);
  });

  it('allows operators and admins to approve drafts and dispatch outreach', () => {
    expect(canApproveDrafts('admin')).toBe(true);
    expect(canApproveDrafts('operator')).toBe(true);
    expect(canApproveDrafts('viewer')).toBe(false);

    expect(canDispatchOutreach('admin')).toBe(true);
    expect(canDispatchOutreach('operator')).toBe(true);
    expect(canDispatchOutreach('viewer')).toBe(false);
  });

  it('allows all roles including viewers to inspect analytics and logs', () => {
    expect(canViewAnalytics('viewer')).toBe(true);
    expect(canViewAnalytics('operator')).toBe(true);
    expect(canViewAnalytics('admin')).toBe(true);
  });

  it('verifies organization membership strictly', () => {
    const memberships = [
      { organizationId: 'org_alpha', userId: 'user_1', role: 'admin' as const },
      { organizationId: 'org_beta', userId: 'user_2', role: 'operator' as const },
    ];

    const check1 = isOrganizationMember('user_1', 'org_alpha', memberships);
    expect(check1.isMember).toBe(true);
    expect(check1.role).toBe('admin');

    const crossOrgCheck = isOrganizationMember('user_1', 'org_beta', memberships);
    expect(crossOrgCheck.isMember).toBe(false);

    const nonMemberCheck = isOrganizationMember('attacker_99', 'org_alpha', memberships);
    expect(nonMemberCheck.isMember).toBe(false);
  });

  it('throws AuthenticationError when asserting on unauthenticated context', () => {
    expect(() => assertAuthenticated(null)).toThrow(AuthenticationError);
  });

  it('throws AuthorizationError when user lacks required role', () => {
    const operatorCtx = {
      userId: 'usr_1',
      email: 'op@evee.ai',
      displayName: 'Operator',
      organizationId: 'org_1',
      organizationName: 'Org 1',
      role: 'operator' as const,
    };

    // Operator has operator role
    expect(() => assertAuthorized(operatorCtx, 'operator')).not.toThrow();

    // Operator does NOT have admin role
    expect(() => assertAuthorized(operatorCtx, 'admin')).toThrow(AuthorizationError);
  });

  it('rejects unauthenticated requests even if spoofed headers are supplied', async () => {
    const spoofedReq = new Request('http://localhost:3000/api/businesses', {
      headers: {
        'x-organization-id': 'org_victim_enterprise',
        'x-user-role': 'admin',
        'x-user-id': 'usr_spoofed_admin',
      },
    });

    const context = await resolveUserContext(spoofedReq);
    // MUST return null, never granting admin or adopting spoofed headers
    expect(context).toBeNull();
  });

  it('creates worker context with explicit tenant scope', () => {
    expect(() => createWorkerContext('')).toThrow('Worker context requires an explicit organizationId');

    const workerCtx = createWorkerContext('org_acme_123');
    expect(workerCtx.organizationId).toBe('org_acme_123');
    expect(workerCtx.isServiceRole).toBe(true);
    expect(workerCtx.role).toBe('admin');
  });
});
