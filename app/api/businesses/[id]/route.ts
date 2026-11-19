// Evee - Business Detail & Research Endpoint (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { getAllotments, getAllPartners } from '@/lib/services/partner-store';
import type { AccountActivityItem } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const { id } = await params;
    const admin = createAdminClient();

    // Verify business exists and belongs to this organization
    const { data: business, error } = await admin
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('organization_id', userCtx.organizationId)
      .single();

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const [evidenceRes, contactsRes, scoreRes, draftsRes, runsRes, accountAuditRes, inboundAuditRes, messagesRes, allotments, partners] = await Promise.all([
      admin.from('evidence_items').select('*').eq('business_id', id).order('observed_at', { ascending: false }),
      admin.from('contacts').select('*').eq('business_id', id),
      admin.from('lead_scores').select('*').eq('business_id', id).order('created_at', { ascending: false }).limit(1),
      admin.from('email_drafts').select('*').eq('business_id', id).eq('organization_id', userCtx.organizationId).order('created_at', { ascending: false }),
      admin.from('research_runs').select('*').eq('business_id', id).order('created_at', { ascending: false }),
      admin.from('audit_events').select('id, event_type, entity_type, entity_id, timestamp, details')
        .eq('organization_id', userCtx.organizationId).eq('entity_id', id).order('timestamp', { ascending: false }).limit(250),
      admin.from('audit_events').select('id, event_type, entity_type, entity_id, timestamp, details')
        .eq('organization_id', userCtx.organizationId).eq('entity_type', 'inbound_replies').order('timestamp', { ascending: false }).limit(250),
      admin.from('outreach_messages').select('id, status, sent_at, created_at, failure_code, failure_detail')
        .eq('organization_id', userCtx.organizationId).eq('business_id', id).order('created_at', { ascending: false }),
      getAllotments(userCtx.organizationId),
      getAllPartners(userCtx.organizationId),
    ]);

    const activities: AccountActivityItem[] = [];
    const pushActivity = (item: AccountActivityItem) => activities.push(item);

    pushActivity({
      id: `account-created-${id}`,
      kind: 'account',
      title: 'Account added',
      description: `${business.display_name} was added to the workspace.`,
      occurredAt: business.created_at,
    });

    for (const run of runsRes.data || []) {
      const status = run.status || 'queued';
      pushActivity({
        id: `research-${run.id}`,
        kind: 'research',
        title: `Research ${status}`,
        description: run.error_summary || `${run.pages_successfully_read || 0} pages read across ${run.pages_attempted || 0} attempts.`,
        occurredAt: run.completed_at || run.started_at || run.created_at,
        status,
      });
    }

    const drafts = draftsRes.data || [];
    for (const draft of drafts) {
      pushActivity({
        id: `draft-created-${draft.id}`,
        kind: 'approval',
        title: 'Email draft prepared',
        description: draft.subject || 'An outreach draft was prepared for this account.',
        occurredAt: draft.created_at,
        status: draft.approval_status,
      });
    }

    for (const message of messagesRes.data || []) {
      const status = message.status || 'unknown';
      pushActivity({
        id: `message-${message.id}`,
        kind: 'message',
        title: status === 'sent' ? 'Outreach sent' : `Outreach ${status}`,
        description: message.failure_detail || (message.failure_code ? `Delivery issue: ${message.failure_code}` : 'Email activity recorded for this account.'),
        occurredAt: message.sent_at || message.created_at,
        status,
      });
    }

    const draftIds = new Set(drafts.map((draft) => draft.id));
    const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
    const draftAuditRes = draftIds.size > 0
      ? await admin.from('audit_events').select('id, event_type, entity_type, entity_id, timestamp, details')
        .eq('organization_id', userCtx.organizationId).in('entity_id', [...draftIds]).order('timestamp', { ascending: false }).limit(250)
      : { data: [] };
    const accountEmails = new Set([
      business.general_business_email,
      ...(contactsRes.data || []).map((contact) => contact.email_normalized || contact.email_address),
    ].filter(Boolean).map((email) => String(email).toLowerCase().trim()));
    const auditEvents = Array.from(new Map([
      ...(accountAuditRes.data || []),
      ...(inboundAuditRes.data || []),
      ...(draftAuditRes.data || []),
    ].map((event) => [event.id, event])).values());
    const assignmentEvents = auditEvents.filter((event) => event.entity_id === id && ['LEAD_ASSIGNED', 'LEAD_UNASSIGNED'].includes(event.event_type));

    for (const event of auditEvents) {
      const details = (event.details || {}) as Record<string, any>;
      const isAccountEvent = event.entity_id === id || (Array.isArray(details.targetIds) && details.targetIds.includes(id));
      const isDraftEvent = event.entity_type === 'email_drafts' && draftIds.has(event.entity_id);
      const isInboundReply = event.event_type.startsWith('INBOUND_REPLY_') && !!details.sender && accountEmails.has(String(details.sender).toLowerCase().trim());
      if (!isAccountEvent && !isDraftEvent && !isInboundReply) continue;

      if (event.event_type === 'LEAD_ASSIGNED' || event.event_type === 'LEAD_UNASSIGNED') {
        pushActivity({
          id: `audit-${event.id}`,
          kind: 'assignment',
          title: event.event_type === 'LEAD_ASSIGNED' ? 'Assigned to partner' : 'Partner assignment removed',
          description: details.partnerName ? `Partner: ${details.partnerName}` : 'Partner assignment updated.',
          occurredAt: event.timestamp,
          actor: details.actorName,
        });
      } else if (event.event_type === 'ACCOUNT_UPDATED' || event.event_type === 'LEAD_ENRICHED') {
        pushActivity({
          id: `audit-${event.id}`,
          kind: 'edit',
          title: event.event_type === 'LEAD_ENRICHED' ? 'Account enriched' : 'Account updated',
          description: Array.isArray(details.changedFields) ? `Updated: ${details.changedFields.join(', ')}.` : 'Account details were updated.',
          occurredAt: event.timestamp,
          actor: details.actorName,
        });
      } else if (event.event_type === 'DRAFT_APPROVED' || event.event_type === 'DRAFT_REJECTED') {
        pushActivity({
          id: `audit-${event.id}`,
          kind: 'approval',
          title: event.event_type === 'DRAFT_APPROVED' ? 'Draft approved' : 'Draft rejected',
          description: details.subject || draftsById.get(event.entity_id)?.subject || 'An outreach draft received a review decision.',
          occurredAt: event.timestamp,
          status: event.event_type === 'DRAFT_APPROVED' ? 'approved' : 'rejected',
          actor: details.actorName || details.operatorId,
        });
      } else if (isInboundReply) {
        const sentiment = event.event_type.replace('INBOUND_REPLY_', '').toLowerCase();
        pushActivity({
          id: `audit-${event.id}`,
          kind: 'outcome',
          title: `Reply received: ${sentiment}`,
          description: details.subject || details.rationale || 'A reply was received from this account.',
          occurredAt: event.timestamp,
          status: sentiment,
        });
      } else {
        pushActivity({
          id: `audit-${event.id}`,
          kind: 'account',
          title: event.event_type.replaceAll('_', ' ').toLowerCase(),
          description: details.action || details.reason || details.subject || 'Account activity recorded.',
          occurredAt: event.timestamp,
        });
      }
    }

    const currentAssignment = allotments[id];
    if (currentAssignment && assignmentEvents.length === 0) {
      const assignedPartner = partners.find((partner) => partner.id === currentAssignment.partnerId);
      pushActivity({
        id: `assignment-${currentAssignment.partnerId}-${currentAssignment.allottedAt}`,
        kind: 'assignment',
        title: 'Assigned to partner',
        description: assignedPartner ? `Partner: ${assignedPartner.name}` : 'Partner assignment is active.',
        occurredAt: currentAssignment.allottedAt,
        actor: currentAssignment.allottedBy,
      });
    }

    activities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return NextResponse.json({
      business,
      evidence: evidenceRes.data || [],
      contacts: contactsRes.data || [],
      score: scoreRes.data?.[0] || null,
      drafts: draftsRes.data || [],
      researchRuns: runsRes.data || [],
      activities,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
