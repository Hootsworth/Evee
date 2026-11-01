// Evee - Notification Dispatcher Mesh
// Routes high-priority events to Slack, Discord, and Zapier/Make webhooks
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export interface HotLeadEvent {
  prospectEmail: string;
  businessName?: string;
  sentiment: 'INTERESTED' | 'NOT_INTERESTED' | 'UNSUBSCRIBE' | 'OUT_OF_OFFICE' | 'NEUTRAL';
  subject: string;
  replySnippet: string;
  rationale: string;
}

export interface CampaignCompletedEvent {
  campaignName: string;
  dispatchedCount: number;
  validRate: string;
}

async function getStoredWebhook(provider: 'slack' | 'discord' | 'zapier'): Promise<{ url: string; config: any } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data: record } = await admin
      .from('oauth_credentials')
      .select('*')
      .eq('provider', `integration_${provider}`)
      .maybeSingle();

    if (record?.encrypted_access_token) {
      const url = decryptSecret(record.encrypted_access_token);
      return { url, config: (record.scopes as any)?.publicConfig || {} };
    }
  } catch (e) {
    console.warn(`Failed to fetch ${provider} webhook:`, e);
  }
  return null;
}

export async function dispatchHotLeadAlert(event: HotLeadEvent): Promise<void> {
  if (event.sentiment !== 'INTERESTED') return;

  // 1. Dispatch to Slack
  const slack = await getStoredWebhook('slack');
  if (slack?.url) {
    try {
      await fetch(slack.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔥 *HOT LEAD REPLY DETECTED* from *${event.businessName || event.prospectEmail}*!`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: '🔥 Hot Lead Reply Detected', emoji: true },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Prospect:*\n${event.prospectEmail}` },
                { type: 'mrkdwn', text: `*Company:*\n${event.businessName || 'SMB Target'}` },
                { type: 'mrkdwn', text: `*Subject:*\n${event.subject}` },
                { type: 'mrkdwn', text: `*Classification:*\n✅ High Interest` },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `> "${event.replySnippet.slice(0, 240)}..."\n_${event.rationale}_`,
              },
            },
          ],
        }),
      });
    } catch (err) {
      console.warn('Failed to dispatch Slack alert:', err);
    }
  }

  // 2. Dispatch to Discord
  const discord = await getStoredWebhook('discord');
  if (discord?.url) {
    try {
      await fetch(discord.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: '🔥 Hot Lead Reply Detected',
              color: 0xef2cc1,
              fields: [
                { name: 'Prospect', value: event.prospectEmail, inline: true },
                { name: 'Company', value: event.businessName || 'SMB Target', inline: true },
                { name: 'Subject', value: event.subject, inline: false },
                { name: 'Message', value: `"${event.replySnippet.slice(0, 240)}..."`, inline: false },
                { name: 'AI Rationale', value: event.rationale, inline: false },
              ],
              footer: { text: 'Evee B2B Intelligence Mesh' },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch (err) {
      console.warn('Failed to dispatch Discord alert:', err);
    }
  }

  // 3. Dispatch to Zapier / Make webhook
  const zapier = await getStoredWebhook('zapier');
  if (zapier?.url) {
    try {
      await fetch(zapier.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'lead.reply.interested',
          timestamp: new Date().toISOString(),
          data: event,
        }),
      });
    } catch (err) {
      console.warn('Failed to dispatch Zapier hook:', err);
    }
  }
}

export async function dispatchCampaignFinishedAlert(event: CampaignCompletedEvent): Promise<void> {
  const slack = await getStoredWebhook('slack');
  if (slack?.url) {
    try {
      await fetch(slack.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚀 *Outreach Batch Complete*: Sent ${event.dispatchedCount} emails for *${event.campaignName}* (${event.validRate} deliverability rate).`,
        }),
      });
    } catch {}
  }
}
