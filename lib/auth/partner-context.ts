// Evee - Partner Context Resolver
// Resolves and verifies the authenticated Partner session.

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getPartnerByAccessKey, getPartnerById, Partner } from '@/lib/services/partner-store';

export async function resolvePartnerContext(req?: NextRequest): Promise<Partner | null> {
  // 1. Check header
  const headerKey = req?.headers.get('x-partner-key');
  if (headerKey) {
    const partner = await getPartnerByAccessKey(headerKey);
    if (partner && partner.status === 'active') return partner;
  }

  // 2. Check query string key (e.g. ?key=...)
  if (req) {
    const url = new URL(req.url);
    const queryKey = url.searchParams.get('key');
    if (queryKey) {
      const partner = await getPartnerByAccessKey(queryKey);
      if (partner && partner.status === 'active') return partner;
    }
  }

  // 3. Check cookie
  try {
    const cookieStore = await cookies();
    const partnerId = cookieStore.get('evee_partner_id')?.value;
    if (partnerId) {
      const partner = await getPartnerById(partnerId);
      if (partner && partner.status === 'active') return partner;
    }
  } catch {
    // Non-cookie environment
  }

  return null;
}
