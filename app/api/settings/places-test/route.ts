// Evee - Google Places Discovery Live Diagnostic Test Route
import { NextRequest, NextResponse } from 'next/server';
import { GooglePlacesDiscoveryProvider } from '@/lib/providers/discovery/google-places';
import { getDynamicDiscoveryProvider } from '@/lib/providers/discovery';
import { MockDiscoveryProvider } from '@/lib/providers/discovery/mock';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext(req);
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json();
    const query = body.query || 'Artisan Bakery & Specialty Coffee';
    const location = body.location || 'Bengaluru';
    const tempApiKey = body.apiKey?.trim();

    let provider;
    if (tempApiKey) {
      provider = new GooglePlacesDiscoveryProvider(tempApiKey);
    } else {
      provider = await getDynamicDiscoveryProvider();
    }

    const results = await provider.search({
      categories: [query],
      keywords: [],
      geography: location,
      limit: 5,
    });

    return NextResponse.json({
      success: true,
      provider: provider.name,
      isLiveApi: provider.name === 'google_places',
      count: results.length,
      places: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Google Places Discovery test failed',
      },
      { status: err.statusCode || 400 }
    );
  }
}
