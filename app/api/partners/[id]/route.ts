// Evee - Single Partner Management API

import { NextRequest, NextResponse } from 'next/server';
import { updatePartner, deletePartner, getPartnerById } from '@/lib/services/partner-store';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const { id } = await params;
    const partner = await getPartnerById(id, userCtx.organizationId);

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, partner });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const { id } = await params;
    const body = await req.json();

    const updated = await updatePartner(id, body, userCtx.organizationId);
    if (!updated) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, partner: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const { id } = await params;
    const deleted = await deletePartner(id, userCtx.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Partner not found or could not be removed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Partner removed and allotted leads returned to pool' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
