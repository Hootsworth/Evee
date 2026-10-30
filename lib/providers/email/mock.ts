// Evee - Mock Email Provider
// Simulates message dispatch safely without sending live outreach

import { EmailProvider, SendEmailParams, SendEmailResult } from './interface';

export class MockEmailProvider implements EmailProvider {
  name = 'mock-email';

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    // Return simulated success with a mock message ID
    return {
      providerMessageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      status: 'sent',
      rawResponse: { simulated: true, recipient: params.to, timestamp: new Date().toISOString() },
    };
  }
}
