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
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  operator: 2,
  viewer: 1,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
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
