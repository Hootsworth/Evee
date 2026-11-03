// Evee - Role-Based Access Control (RBAC) System
// Roles: admin (full control), operator (drafts, discovery, outreach), viewer (read-only)

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'growth' | 'enterprise';
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
}

export interface UserContext {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: UserRole;
  isServiceRole?: boolean;
}

export class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message = 'Authentication required. Please sign in.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;
  constructor(message = 'Access forbidden. Insufficient permissions for this organization.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  operator: 2,
  viewer: 1,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

// Capability checks
export function canManageSettings(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function canManageMembers(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function canApproveDrafts(role: UserRole): boolean {
  return hasMinimumRole(role, 'operator');
}

export function canDispatchOutreach(role: UserRole): boolean {
  return hasMinimumRole(role, 'operator');
}

export function canTriggerDiscovery(role: UserRole): boolean {
  return hasMinimumRole(role, 'operator');
}

export function canImportCsv(role: UserRole): boolean {
  return hasMinimumRole(role, 'operator');
}

export function canViewAnalytics(role: UserRole): boolean {
  return hasMinimumRole(role, 'viewer');
}

/**
 * Asserts that a context is authenticated; throws AuthenticationError (401) if null or unauthenticated.
 */
export function assertAuthenticated(context: UserContext | null): asserts context is UserContext {
  if (!context || !context.userId) {
    throw new AuthenticationError();
  }
}

/**
 * Asserts that the authenticated context has at least the required role in their organization.
 * Throws AuthorizationError (403) if role is insufficient.
 */
export function assertAuthorized(context: UserContext | null, requiredRole: UserRole): asserts context is UserContext {
  assertAuthenticated(context);
  if (!hasMinimumRole(context.role, requiredRole)) {
    throw new AuthorizationError(
      `Role "${context.role}" does not satisfy required role "${requiredRole}" for organization "${context.organizationName || context.organizationId}".`
    );
  }
}

/**
 * Checks if a user is a member of an organization.
 */
export function isOrganizationMember(
  userId: string,
  orgId: string,
  members: Array<{ organizationId: string; userId: string; role: UserRole }>
): { isMember: boolean; role?: UserRole } {
  const member = members.find((m) => m.userId === userId && m.organizationId === orgId);
  if (member) {
    return { isMember: true, role: member.role };
  }
  return { isMember: false };
}
