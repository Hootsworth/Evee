import crypto from 'crypto';
import { isIP } from 'net';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { encryptSecret } from '@/lib/compliance/encryption';

const events = new Set(['work_item.created', 'work_item.updated', 'account_record.created', 'account_record.updated']);
function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && !isIP(host) &&
      host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local') &&
      !host.endsWith('.internal') && host !== 'metadata.google.internal';
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserContext(req); assertAuthenticated(user); assertAuthorized(user, 'manager');
    if (!isSupabaseConfigured()) return NextResponse.json({ subscriptions: [] });
    const { data, error } = await createAdminClient().from('webhook_subscriptions')
      .select('id, name, endpoint_url, events, status, created_at').eq('organization_id', user.organizationId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ subscriptions: data || [] });
  } catch (err: any) { return NextResponse.json({ error: err.message || 'Unable to list webhooks' }, { status: err.statusCode || 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserContext(req); assertAuthenticated(user); assertAuthorized(user, 'manager');
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (!name || !validEndpoint(body.endpointUrl)) return NextResponse.json({ error: 'Provide a name and a public HTTPS endpoint.' }, { status: 400 });
    const selectedEvents = Array.isArray(body.events) ? [...new Set(body.events.filter((event: unknown) => typeof event === 'string'))] as string[] : [];
    if (!selectedEvents.length || selectedEvents.some((event) => !events.has(event))) return NextResponse.json({ error: 'Choose supported webhook events.' }, { status: 400 });
    if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Persistent storage is required for webhooks.' }, { status: 503 });
    const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
    const { data, error } = await createAdminClient().from('webhook_subscriptions').insert({
      organization_id: user.organizationId, name, endpoint_url: body.endpointUrl, encrypted_secret: encryptSecret(secret), events: selectedEvents, created_by: user.userId,
    }).select('id, name, endpoint_url, events, status, created_at').single();
    if (error) throw error;
    return NextResponse.json({ subscription: data, secret }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message || 'Unable to create webhook' }, { status: err.statusCode || 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserContext(req); assertAuthenticated(user); assertAuthorized(user, 'manager');
    const body = await req.json();
    if (!body.id || !['active', 'paused', 'revoked'].includes(body.status)) return NextResponse.json({ error: 'Subscription id and a valid status are required.' }, { status: 400 });
    const { error } = await createAdminClient().from('webhook_subscriptions').update({ status: body.status })
      .eq('id', body.id).eq('organization_id', user.organizationId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ error: err.message || 'Unable to update webhook' }, { status: err.statusCode || 500 }); }
}
