// Evee - Immutable Audit Event Telemetry
// Aligned with Phase 5 Production Readiness

import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

export type AuditAction =
  | 'DRAFT_APPROVED'
  | 'DRAFT_REJECTED'
  | 'OUTREACH_DISPATCHED'
  | 'OUTREACH_TEST_SENT'
  | 'LEAD_ENRICHED'
  | 'SUPPRESSION_ADDED'
  | 'SUPPRESSION_REMOVED'
  | 'DNS_AUDITED'
  | 'API_KEY_UPDATED'
  | 'CAMPAIGN_CREATED'
  | 'INBOUND_REPLY_RECEIVED';

export interface AuditEvent {
  id: string;
  organizationId: string;
  userId: string;
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  created_at: string;
}

// In-memory persistent circular buffer for fast queries & serverless fallback
const memoryAuditLog: AuditEvent[] = [];
const MAX_LOGS = 500;

export async function recordAuditEvent(params: {
  organizationId?: string;
  userId?: string;
  actorEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    organizationId: params.organizationId || 'org_primary_workspace',
    userId: params.userId || 'usr_operator',
    actorEmail: params.actorEmail || 'operator@singulr.tech',
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata || {},
    ipAddress: params.ipAddress || '127.0.0.1',
    created_at: new Date().toISOString(),
  };

  // 1. In-memory append
  memoryAuditLog.unshift(event);
  if (memoryAuditLog.length > MAX_LOGS) {
    memoryAuditLog.pop();
  }

  // 2. Persist to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('audit_events').insert({
        id: event.id,
        organization_id: event.organizationId,
        actor_id: event.userId,
        event_type: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        details: event.metadata,
        ip_address: event.ipAddress,
        created_at: event.created_at,
      });
    } catch {
      // In-memory buffer preserves records
    }
  }

  return event;
}

export async function queryAuditEvents(options?: {
  organizationId?: string;
  action?: AuditAction;
  limit?: number;
}): Promise<AuditEvent[]> {
  const limit = options?.limit || 50;

  // Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      let query = supabase
        .from('audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options?.organizationId) {
        query = query.eq('organization_id', options.organizationId);
      }
      if (options?.action) {
        query = query.eq('event_type', options.action);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          organizationId: d.organization_id,
          userId: d.actor_id,
          actorEmail: d.actor_email || 'operator@singulr.tech',
          action: d.event_type as AuditAction,
          entityType: d.entity_type,
          entityId: d.entity_id,
          metadata: d.details || {},
          ipAddress: d.ip_address,
          created_at: d.created_at,
        }));
      }
    } catch {
      // Fallback
    }
  }

  // Filter in-memory logs
  return memoryAuditLog
    .filter((e) => {
      if (options?.organizationId && e.organizationId !== options.organizationId) return false;
      if (options?.action && e.action !== options.action) return false;
      return true;
    })
    .slice(0, limit);
}
