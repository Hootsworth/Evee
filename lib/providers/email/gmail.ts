// Evee - Google Gmail API Outbound Provider
// Implements safe dispatch via Gmail REST API v1
// Uses decrypted refresh token to obtain temporary access tokens

import { EmailProvider, SendEmailParams, SendEmailResult } from './interface';

export class GmailProvider implements EmailProvider {
  name = 'gmail';
  private accessToken?: string;
  private refreshToken?: string;

  constructor(options?: { accessToken?: string; refreshToken?: string }) {
    this.accessToken = options?.accessToken;
    this.refreshToken = options?.refreshToken;
  }

  /**
   * Refreshes access token if expired using Google OAuth token endpoint
   */
  private async refreshAccessToken(): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!this.refreshToken || !clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials for Gmail token refresh');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to refresh Google access token: ${err}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return data.access_token;
  }

  /**
   * Constructs base64url-encoded RFC 2822 email payload
   */
  private createRfc2822Raw(params: SendEmailParams): string {
    const lines = [
      `To: ${params.to}`,
      params.from ? `From: ${params.from}` : '',
      `Subject: =?utf-8?B?${Buffer.from(params.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      params.bodyText,
    ].filter(Boolean);

    const message = lines.join('\r\n');
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    let token = this.accessToken;
    if (!token && this.refreshToken) {
      token = await this.refreshAccessToken();
    }

    if (!token) {
      throw new Error('Gmail provider has no active access or refresh token');
    }

    const raw = this.createRfc2822Raw(params);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          providerMessageId: '',
          status: 'failed',
          error: `Gmail API returned ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      return {
        providerMessageId: result.id,
        status: 'sent',
        rawResponse: result,
      };
    } catch (err: unknown) {
      const error = err as Error;
      // If aborted or network dropped after submission, outcome is unknown!
      // Must NOT blindly resend.
      if (error.name === 'AbortError' || error.message.includes('fetch failed')) {
        return {
          providerMessageId: '',
          status: 'unknown_outcome',
          error: `Network timeout or ambiguous outcome: ${error.message}. Requires reconciliation.`,
        };
      }

      return {
        providerMessageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }
}
