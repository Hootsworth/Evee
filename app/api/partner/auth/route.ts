// Evee - Partner Portal Authentication Endpoint
// Authenticates partner via Access Key and manages partner portal session.

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerByAccessKey, getPartnerById } from '@/lib/services/partner-store';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessKey } = body;

    if (!accessKey || typeof accessKey !== 'string') {
      return NextResponse.json({ error: 'Access Key is required' }, { status: 400 });
    }

    const partner = await getPartnerByAccessKey(accessKey);
    if (!partner) {
      return NextResponse.json({ error: 'Invalid or inactive Partner Access Key' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set('evee_partner_id', partner.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        role: partner.role,
        status: partner.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const partnerId = cookieStore.get('evee_partner_id')?.value;
    const headerKey = req.headers.get('x-partner-key');

    let partner = null;
    if (headerKey) {
      partner = await getPartnerByAccessKey(headerKey);
    } else if (partnerId) {
      partner = await getPartnerById(partnerId);
    }

    if (!partner || partner.status !== 'active') {
      return NextResponse.json({ authenticated: false, partner: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        role: partner.role,
        status: partner.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('evee_partner_id');
  return NextResponse.json({ success: true, message: 'Logged out of Partner Portal' });
}
