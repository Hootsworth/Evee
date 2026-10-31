import { describe, it, expect } from 'vitest';
import {
  hasMinimumRole,
  canManageSettings,
  canApproveDrafts,
  canDispatchOutreach,
  canViewAnalytics,
  canManageMembers,
  UserRole,
} from '@/lib/auth/rbac';
import { resolveUserContext } from '@/lib/auth/context';

describe('Role-Based Access Control (RBAC)', () => {
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

  it('resolves tenant context from request headers with safe fallbacks', async () => {
    const mockReq = new Request('http://localhost:3000/api/reports/overview', {
      headers: {
        'x-organization-id': 'org_acme_growth',
        'x-user-role': 'operator',
        'x-user-id': 'usr_sarah_123',
      },
    });

    const context = await resolveUserContext(mockReq);
    expect(context.organizationId).toBe('org_acme_growth');
    expect(context.role).toBe('operator');
    expect(context.userId).toBe('usr_sarah_123');
  });
});
