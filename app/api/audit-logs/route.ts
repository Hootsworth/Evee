import { NextResponse } from 'next/server';
import { queryAuditEvents, recordAuditEvent, AuditAction } from '@/lib/telemetry/audit';
import { resolveUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

export async function GET(req: Request) {
  try {
    const userCtx = await resolveUserContext(req);
    assertAuthenticated(userCtx);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') as AuditAction | null;
    const limit = Number(searchParams.get('limit')) || 50;

    const logs = await queryAuditEvents({
      organizationId: userCtx.organizationId,
      action: action || undefined,
      limit,
    });

    return NextResponse.json({
      status: 'ok',
      organizationId: userCtx.organizationId,
      logs,
      count: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'AuthenticationError' ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const userCtx = await resolveUserContext(req);
    assertAuthenticated(userCtx);

    const body = await req.json();

    if (!body.action || !body.entityType) {
      return NextResponse.json({ error: 'Missing required audit fields: action and entityType' }, { status: 400 });
    }

    const event = await recordAuditEvent({
      organizationId: userCtx.organizationId,
      userId: userCtx.userId,
      actorEmail: userCtx.email,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      metadata: body.metadata,
    });

    return NextResponse.json({ status: 'recorded', event });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'AuthenticationError' ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
