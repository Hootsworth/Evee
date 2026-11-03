// Evee - Secure Tenant & Auth Context Resolver
// Enforces cryptographic session verification and database-backed organization membership checks.
// NEVER trusts client-supplied role or organization headers.

import { UserContext, UserRole, AuthenticationError, AuthorizationError } from './rbac';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

export interface ResolveContextOptions {
  requiredRole?: UserRole;
  allowWorker?: boolean;
}

/**
 * Resolves the authenticated user and verified organization membership.
 * Rejects unauthenticated requests and ignores untrusted client headers.
 * 
 * Verification flow:
 * 1. Validates session token via Supabase Auth (cookies or Bearer JWT).
 * 2. Fetches user's actual memberships from `organization_members` table.
 * 3. If a specific tenant is requested, verifies user belongs to that tenant.
 * 4. Extracts verified role from database record (never from headers).
 */
export async function resolveUserContext(
  req?: Request,
  options?: ResolveContextOptions
): Promise<UserContext | null> {
  let user: any = null;

  // 1. Try to extract bearer token from Authorization header if present
  const authHeader = req?.headers.get('authorization');
  const admin = createAdminClient();

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      try {
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data?.user) {
          user = data.user;
        }
      } catch (err) {
        console.warn('Bearer token verification failed:', err);
      }
    }
  }

  // 2. Try to extract session from cookies via server client (in Next.js runtime)
  if (!user && typeof window === 'undefined') {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    } catch {
      // Running in unit test or non-cookie environment; continue
    }
  }

  // 3. Unauthenticated: NEVER return default admin context. Reject immediately.
  if (!user) {
    return null;
  }

  const userId = user.id;
  const email = user.email || '';
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (email ? email.split('@')[0] : 'Operator');

  // 4. Verify organization membership from database
  if (isSupabaseConfigured()) {
    try {
      // Query user's verified organization memberships
      const { data: memberships, error } = await admin
        .from('organization_members')
        .select('organization_id, role, organizations(id, name, slug)')
        .eq('user_id', userId);

      if (!error && memberships && memberships.length > 0) {
        const requestedOrgId = req?.headers.get('x-organization-id');

        // Prefer Primary Workspace if member of multiple and no specific org requested
        let activeMembership =
          memberships.find((m: any) => m.organizations?.slug === 'primary-workspace') ||
          memberships[0];

        // If client requested a specific tenant, verify they ACTUALLY belong to it
        if (requestedOrgId) {
          const matched = memberships.find((m) => m.organization_id === requestedOrgId);
          if (matched) {
            activeMembership = matched;
          } else {
            // Client tried to access an organization they do not belong to!
            throw new AuthorizationError(
              `User does not have access to requested organization "${requestedOrgId}".`
            );
          }
        }

        const orgRecord = (activeMembership as any).organizations;
        const verifiedRole = activeMembership.role as UserRole;

        return {
          userId,
          email,
          displayName,
          organizationId: activeMembership.organization_id,
          organizationName: orgRecord?.name || 'Primary Workspace',
          role: verifiedRole,
        };
      }

      // If user has no organization yet, check if Primary Workspace exists to prevent orphaning directory data
      const { data: primaryOrg } = await admin
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', 'primary-workspace')
        .maybeSingle();

      let targetOrg = primaryOrg;

      if (!targetOrg) {
        const defaultSlug = `ws-${userId.slice(0, 8)}`;
        const { data: newOrg } = await admin
          .from('organizations')
          .insert({
            name: `${displayName}'s Workspace`,
            slug: defaultSlug,
            plan: 'starter',
          })
          .select()
          .single();
        targetOrg = newOrg;
      }

      if (targetOrg) {
        await admin.from('organization_members').insert({
          organization_id: targetOrg.id,
          user_id: userId,
          role: 'admin',
        });

        return {
          userId,
          email,
          displayName,
          organizationId: targetOrg.id,
          organizationName: targetOrg.name,
          role: 'admin',
        };
      }
    } catch (dbErr) {
      if (dbErr instanceof AuthorizationError) {
        throw dbErr;
      }
      console.warn('Organization lookup failed, falling back to user-isolated space:', dbErr);
    }
  }

  // Fallback for standalone/dev environments where database is not configured
  return {
    userId,
    email,
    displayName,
    organizationId: `org_${userId}`,
    organizationName: `${displayName}'s Workspace`,
    role: 'operator',
  };
}

/**
 * Creates an authorized context specifically for background queue workers.
 * Workers must have an explicit organizationId to process jobs.
 */
export function createWorkerContext(organizationId: string, role: UserRole = 'admin'): UserContext {
  if (!organizationId) {
    throw new Error('Worker context requires an explicit organizationId');
  }

  return {
    userId: 'system_background_worker',
    email: 'worker@evee.ai',
    displayName: 'Background Worker',
    organizationId,
    organizationName: 'Tenant Scope',
    role,
    isServiceRole: true,
  };
}

export const getUserContext = resolveUserContext;
