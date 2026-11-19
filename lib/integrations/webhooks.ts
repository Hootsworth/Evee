import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

export async function queueWorkspaceWebhook(orgId: string, eventType: string, payload: Record<string, unknown>) {
  if (!isSupabaseConfigured()) return;
  const admin = createAdminClient();
  const { data: subscriptions } = await admin.from('webhook_subscriptions').select('id')
    .eq('organization_id', orgId).eq('status', 'active').contains('events', [eventType]);
  for (const subscription of subscriptions || []) {
    const { data: delivery, error } = await admin.from('webhook_deliveries').insert({
      organization_id: orgId, subscription_id: subscription.id, event_type: eventType, payload, status: 'queued',
    }).select('id').single();
    if (error || !delivery) continue;
    await admin.from('background_jobs').insert({
      organization_id: orgId, job_type: 'deliver_webhook', payload: { organizationId: orgId, deliveryId: delivery.id },
      idempotency_key: `webhook:${delivery.id}`,
    });
  }
}
