import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { runTemplateManually } from '@/lib/workflows/template-engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');
    const body = await req.json().catch(() => ({}));
    const payload = body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input : {};
    const { id } = await params;
    const run = await runTemplateManually(user.organizationId, id, payload, user.userId);
    return NextResponse.json({ run }, { status: run.status === 'skipped' ? 200 : 202 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Active workflow') ? 404 : err.message?.includes('trigger payload') ? 400 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
