import { NextResponse } from 'next/server';
import { queryAuditEvents, recordAuditEvent, AuditAction } from '@/lib/telemetry/audit';
import { resolveUserContext } from '@/lib/auth/context';

export async function GET(req: Request) {
  try {
    const userCtx = await resolveUserContext(req);
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userCtx = await resolveUserContext(req);
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
