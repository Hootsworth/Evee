// Evee - Tenant-Isolated CRM Store & Collision Index
import { CrmOpportunity, CrmSyncSettings } from './types';
import { CrmClient } from './client';

interface TenantCrmState {
  settings: CrmSyncSettings;
  opportunities: CrmOpportunity[];
  domainIndex: Map<string, CrmOpportunity>;
  companyNameIndex: Map<string, CrmOpportunity>;
  lastSyncedAt?: string;
}

const tenantCrmStores = new Map<string, TenantCrmState>();

export const DEFAULT_PROTECTED_STAGES = [
  'Discovery',
  'Qualification',
  'Demo Scheduled',
  'Proposal / Price Quote',
  'Proposal Sent',
  'Contract Review',
  'Contract Sent',
  'Negotiation',
  'Closed Won',
  'Active Customer',
];

function getTenantCrmState(orgId: string): TenantCrmState {
  let state = tenantCrmStores.get(orgId);
  if (!state) {
    const defaultSettings: CrmSyncSettings = {
      organizationId: orgId,
      provider: 'salesforce',
      collisionProtectionEnabled: true,
      autoSuppressColdOutreach: true,
      protectedStages: [...DEFAULT_PROTECTED_STAGES],
      syncQualifiedLeads: true,
      logOutreachActivities: true,
      excludedDomains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'],
      lastSyncAt: new Date().toISOString(),
    };

    state = {
      settings: defaultSettings,
      opportunities: [],
      domainIndex: new Map(),
      companyNameIndex: new Map(),
      lastSyncedAt: new Date().toISOString(),
    };
    tenantCrmStores.set(orgId, state);

    // Seed default opportunities
    const client = new CrmClient({ provider: 'salesforce' });
    client.fetchOpportunities().then((seeded) => {
      populateOpportunities(state!, seeded);
    });
  }
  return state;
}

function populateOpportunities(state: TenantCrmState, opps: CrmOpportunity[]) {
  state.opportunities = opps;
  state.domainIndex.clear();
  state.companyNameIndex.clear();

  for (const opp of opps) {
    if (opp.domain) {
      const clean = opp.domain.toLowerCase().trim();
      state.domainIndex.set(clean, opp);
    }
    if (opp.companyName) {
      const cleanName = opp.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      state.companyNameIndex.set(cleanName, opp);
    }
  }
}

export async function getTenantCrmSettings(orgId: string): Promise<CrmSyncSettings> {
  const state = getTenantCrmState(orgId);
  return { ...state.settings };
}

export async function updateTenantCrmSettings(
  orgId: string,
  updates: Partial<CrmSyncSettings>
): Promise<CrmSyncSettings> {
  const state = getTenantCrmState(orgId);
  state.settings = {
    ...state.settings,
    ...updates,
  };
  return { ...state.settings };
}

export async function getTenantOpportunities(orgId: string): Promise<CrmOpportunity[]> {
  const state = getTenantCrmState(orgId);
  return [...state.opportunities];
}

export async function syncTenantCrm(
  orgId: string,
  credentials?: any
): Promise<{ opportunitiesCount: number; lastSyncedAt: string }> {
  const state = getTenantCrmState(orgId);
  const provider = state.settings.provider;
  const client = new CrmClient({ provider, ...credentials });

  const fresh = await client.fetchOpportunities();
  populateOpportunities(state, fresh);

  const now = new Date().toISOString();
  state.lastSyncedAt = now;
  state.settings.lastSyncAt = now;

  return {
    opportunitiesCount: fresh.length,
    lastSyncedAt: now,
  };
}

export function findCrmOpportunity(
  orgId: string,
  query: { domain?: string | null; companyName?: string | null; email?: string | null }
): CrmOpportunity | null {
  const state = getTenantCrmState(orgId);

  // 1. Check by domain extracted from website or email
  let domain = query.domain?.toLowerCase().trim() || null;
  if (!domain && query.email && query.email.includes('@')) {
    domain = query.email.split('@')[1].toLowerCase().trim();
  }

  if (domain && !state.settings.excludedDomains.includes(domain)) {
    const opp = state.domainIndex.get(domain);
    if (opp) return opp;
  }

  // 2. Check by normalized company name
  if (query.companyName) {
    const norm = query.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const opp = state.companyNameIndex.get(norm);
    if (opp) return opp;
  }

  return null;
}
