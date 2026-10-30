// Evee - Email Provider Interface

export interface SendEmailParams {
  to: string;
  from?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  idempotencyKey: string;
}

export interface SendEmailResult {
  providerMessageId: string;
  status: 'sent' | 'failed' | 'unknown_outcome';
  rawResponse?: unknown;
  error?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}
