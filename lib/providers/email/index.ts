// Evee - Email Provider Factory
import { EmailProvider } from './interface';
import { SmtpAppPasswordProvider } from './smtp';
import { GmailProvider } from './gmail';
import { MockEmailProvider } from './mock';

export function getEmailProvider(credentials?: {
  type?: 'smtp' | 'oauth';
  user?: string;
  pass?: string;
  host?: string;
  port?: number;
  accessToken?: string;
  refreshToken?: string;
}): EmailProvider {
  // 1. Check if SMTP App Password is provided
  if (credentials?.user && credentials?.pass) {
    return new SmtpAppPasswordProvider({
      user: credentials.user,
      pass: credentials.pass,
      host: credentials.host,
      port: credentials.port,
    });
  }

  // 2. Check OAuth credentials
  if (credentials?.refreshToken || credentials?.accessToken) {
    return new GmailProvider(credentials);
  }

  // 3. Fallback
  return new MockEmailProvider();
}

export * from './interface';
