import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

const allowedScopes = new Set(['accounts:read', 'work:read', 'leads:write']);

export async function GET(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    if (!isSupabaseConfigured()) return NextResponse.json({ keys: [] });
    const { data, error } = await createAdminClient().from('workspace_api_keys')
      .select('id, name, key_prefix, scopes, created_at, last_used_at, revoked_at')
      .eq('organization_id', user.organizationId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ keys: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unable to load API keys' }, { status: err.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes.filter((scope: unknown) => typeof scope === 'string'))] as string[] : [];
    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (!scopes.length || scopes.some((scope) => !allowedScopes.has(scope))) return NextResponse.json({ error: 'Choose one or more supported scopes.' }, { status: 400 });
    if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Persistent storage is required to create API keys.' }, { status: 503 });
    const token = `evee_live_${crypto.randomBytes(32).toString('base64url')}`;
    const keyPrefix = token.slice(0, 18);
    const { data, error } = await createAdminClient().from('workspace_api_keys').insert({
      organization_id: user.organizationId,
      name,
      key_prefix: keyPrefix,
      key_hash: crypto.createHash('sha256').update(token).digest('hex'),
      scopes,
      created_by: user.userId,
    }).select('id, name, key_prefix, scopes, created_at').single();
    if (error) throw error;
    return NextResponse.json({ key: data, token }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unable to create API key' }, { status: err.statusCode || 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    const id = req.nextUrl.searchParams.get('id');
    if (!id || !isSupabaseConfigured()) return NextResponse.json({ error: 'API key id is required.' }, { status: 400 });
    const { error } = await createAdminClient().from('workspace_api_keys').update({ revoked_at: new Date().toISOString() })
      .eq('id', id).eq('organization_id', user.organizationId).is('revoked_at', null);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unable to revoke API key' }, { status: err.statusCode || 500 });
  }
}
