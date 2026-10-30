// Evee - SMTP App Password Outbound Email Provider
// Uses standard Google App Passwords (or any SMTP provider) with authenticated encryption at rest

import nodemailer from 'nodemailer';
import { EmailProvider, SendEmailParams, SendEmailResult } from './interface';

export class SmtpAppPasswordProvider implements EmailProvider {
  name = 'smtp_app_password';
  private user: string;
  private pass: string;
  private host: string;
  private port: number;

  constructor(options: { user: string; pass: string; host?: string; port?: number }) {
    this.user = options.user;
    this.pass = options.pass.replace(/\s+/g, ''); // strip spaces often formatted in Google 16-char app passwords
    this.host = options.host || 'smtp.gmail.com';
    this.port = options.port || 465;
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: {
          user: this.user,
          pass: this.pass,
        },
      });

      const fromAddress = params.from || this.user;

      const info = await transporter.sendMail({
        from: fromAddress,
        to: params.to,
        subject: params.subject,
        text: params.bodyText,
        html: params.bodyHtml || undefined,
        headers: {
          'X-Evee-Idempotency-Key': params.idempotencyKey,
        },
      });

      return {
        providerMessageId: info.messageId || `smtp-${Date.now()}`,
        status: 'sent',
        rawResponse: info,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        providerMessageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }
}
