// Evee - Google OAuth Callback Route (Tenant-Isolated)
// Exchanges code for refresh token, encrypts token at rest with AES-256-GCM, stores in oauth_credentials scoped by organization
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret } from '@/lib/compliance/encryption';
import { getUserContext } from '@/lib/auth/context';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?error=${encodeURIComponent(error || 'missing_code')}`);
  }

  // Resolve authenticated user and organization
  const userCtx = await getUserContext(req);
  if (!userCtx || !userCtx.organizationId) {
    return NextResponse.redirect(`${appUrl}/auth?error=${encodeURIComponent('unauthenticated_oauth_flow')}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/settings?error=${encodeURIComponent('token_exchange_failed')}`);
    }

    const tokenData = await tokenRes.json();
    const { refresh_token, access_token } = tokenData;

    // Fetch user email
    let userEmail = 'operator@google.com';
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.email) userEmail = profile.email;
      }
    } catch {}

    const admin = createAdminClient();

    if (refresh_token) {
      const encryptedRefresh = encryptSecret(refresh_token);
      await admin.from('oauth_credentials').upsert(
        {
          organization_id: userCtx.organizationId,
          provider: 'google',
          account_email: userEmail,
          encrypted_refresh_token: encryptedRefresh,
          scopes: ['https://www.googleapis.com/auth/gmail.send'],
        },
        { onConflict: 'organization_id,provider' }
      );
    }

    return NextResponse.redirect(`${appUrl}/settings?success=gmail_connected`);
  } catch (err: unknown) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_error`);
  }
}
