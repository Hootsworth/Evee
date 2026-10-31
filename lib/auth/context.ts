// Evee - Tenant & Auth Context Resolver
import { UserContext, UserRole } from './rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_ORG: UserContext = {
  userId: 'usr_default_operator',
  email: 'operator@singulr.tech',
  displayName: 'Operator',
  organizationId: 'org_primary_workspace',
  organizationName: 'Primary Workspace',
  role: 'admin',
};

export async function resolveUserContext(req?: Request): Promise<UserContext> {
  // If request contains tenant or user headers, parse them
  if (req) {
    const orgHeader = req.headers.get('x-organization-id');
    const roleHeader = req.headers.get('x-user-role') as UserRole | null;
    const userHeader = req.headers.get('x-user-id');

    if (orgHeader) {
      return {
        ...DEFAULT_ORG,
        organizationId: orgHeader,
        role: roleHeader || 'operator',
        userId: userHeader || DEFAULT_ORG.userId,
      };
    }
  }

  // Check Supabase session if available
  try {
    const supabase = createAdminClient();
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
      .maybeSingle();

    if (orgData) {
      return {
        ...DEFAULT_ORG,
        organizationId: orgData.id,
        organizationName: orgData.name,
      };
    }
  } catch {
    // Fall back to default organization context
  }

  return DEFAULT_ORG;
}
