// Evee - Notification Dispatcher Mesh (Tenant-Isolated & SSRF Protected)
// Routes high-priority events to Slack, Discord, and Zapier/Make webhooks
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';
import { validateUrlAgainstSSRF } from '@/lib/research/ssrf';

export interface HotLeadEvent {
  prospectEmail: string;
  businessName?: string;
  sentiment: 'INTERESTED' | 'NOT_INTERESTED' | 'UNSUBSCRIBE' | 'OUT_OF_OFFICE' | 'NEUTRAL';
  subject: string;
  replySnippet: string;
  rationale: string;
  organizationId?: string | null;
}

export interface CampaignCompletedEvent {
  campaignName: string;
  dispatchedCount: number;
  validRate: string;
  organizationId?: string | null;
}

async function getStoredWebhook(
  provider: 'slack' | 'discord' | 'zapier',
  organizationId?: string | null
): Promise<{ url: string; config: any } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    let query = admin
      .from('oauth_credentials')
      .select('*')
      .eq('provider', `integration_${provider}`);

    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      query = query.is('organization_id', null);
    }

    const { data: records } = await query;
    const record = records?.find((r) => r.organization_id === organizationId) || records?.[0];

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

  const orgId = event.organizationId || null;

  // 1. Dispatch to Slack
  const slack = await getStoredWebhook('slack', orgId);
  if (slack?.url) {
    if (slack.url.startsWith('https://hooks.slack.com/')) {
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
                  { type: 'mrkdwn', text: `*Business:*\n${event.businessName || 'Unknown'}` },
                ],
              },
              {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Subject:*\n${event.subject}` },
              },
              {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Reply Excerpt:*\n> ${event.replySnippet.slice(0, 300)}` },
              },
              {
                type: 'context',
                elements: [
                  { type: 'mrkdwn', text: `*AI Sentiment Rationale:* ${event.rationale}` },
                ],
              },
            ],
          }),
        });
      } catch (err) {
        console.warn('Failed to dispatch Slack alert:', err);
      }
    }
  }

  // 2. Dispatch to Discord
  const discord = await getStoredWebhook('discord', orgId);
  if (discord?.url) {
    if (discord.url.startsWith('https://discord.com/api/webhooks/')) {
      try {
        await fetch(discord.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Evee Prospecting Bot',
            embeds: [
              {
                title: '🔥 Hot Lead Detected!',
                color: 16734208, // orange-red
                fields: [
                  { name: 'Business', value: event.businessName || 'Unknown', inline: true },
                  { name: 'Prospect Email', value: event.prospectEmail, inline: true },
                  { name: 'Subject', value: event.subject || 'N/A' },
                  { name: 'Reply Snippet', value: event.replySnippet.slice(0, 300) },
                  { name: 'Sentiment Rationale', value: event.rationale },
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
  }

  // 3. Dispatch to Zapier / Make webhook (SSRF-protected)
  const zapier = await getStoredWebhook('zapier', orgId);
  if (zapier?.url) {
    const ssrfCheck = await validateUrlAgainstSSRF(zapier.url);
    if (ssrfCheck.isValid) {
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
}

export async function dispatchCampaignFinishedAlert(event: CampaignCompletedEvent): Promise<void> {
  const slack = await getStoredWebhook('slack', event.organizationId);
  if (slack?.url && slack.url.startsWith('https://hooks.slack.com/')) {
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
