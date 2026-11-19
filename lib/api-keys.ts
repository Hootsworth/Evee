import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

export async function authenticateWorkspaceApiKey(req: NextRequest, scope: string) {
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || !bearer.startsWith('evee_live_')) throw Object.assign(new Error('A valid Evee API key is required.'), { statusCode: 401 });
  if (!isSupabaseConfigured()) throw Object.assign(new Error('API key authentication is unavailable.'), { statusCode: 503 });
  const hash = crypto.createHash('sha256').update(bearer).digest('hex');
  const admin = createAdminClient();
  const { data: key, error } = await admin.from('workspace_api_keys').select('id, organization_id, scopes, created_by')
    .eq('key_hash', hash).is('revoked_at', null).maybeSingle();
  if (error || !key) throw Object.assign(new Error('Invalid or revoked API key.'), { statusCode: 401 });
  if (!Array.isArray(key.scopes) || !key.scopes.includes(scope)) throw Object.assign(new Error(`API key requires the ${scope} scope.`), { statusCode: 403 });
  await admin.from('workspace_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).eq('organization_id', key.organization_id);
  return { organizationId: key.organization_id as string, admin, createdBy: key.created_by as string };
}

export function apiError(err: any) {
  return { error: err?.message || 'API request failed', status: err?.statusCode || 500 };
}
