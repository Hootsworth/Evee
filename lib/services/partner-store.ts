// Evee - Partner & Sub-Portal Persistence Store
// Handles partner management and lead allotment with dual Supabase + local cache persistence.

import fs from 'fs';
import path from 'path';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

export interface Partner {
  id: string;
  name: string;
  email: string;
  accessKey: string;
  role?: string;
  status: 'active' | 'paused';
  notes?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadAssignment {
  businessId: string;
  partnerId: string;
  allottedAt: string;
  allottedBy: string;
}

interface PartnerStoreData {
  partners: Partner[];
  leadAssignments: Record<string, LeadAssignment>; // businessId -> LeadAssignment
}

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'partner_store.json');

function ensureDataDirectory() {
  const dir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocalCache(): PartnerStoreData {
  try {
    ensureDataDirectory();
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        partners: Array.isArray(parsed.partners) ? parsed.partners : [],
        leadAssignments: parsed.leadAssignments && typeof parsed.leadAssignments === 'object' ? parsed.leadAssignments : {},
      };
    }
  } catch (err) {
    console.warn('Could not read local partner cache:', err);
  }
  return { partners: [], leadAssignments: {} };
}

function writeLocalCache(data: PartnerStoreData) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write local partner cache:', err);
  }
}

async function getOrgSettings(orgId?: string): Promise<{ orgId: string; settings: any } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    let query = admin.from('organizations').select('id, settings');
    if (orgId) {
      query = query.eq('id', orgId);
    } else {
      query = query.eq('slug', 'primary-workspace');
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return { orgId: data.id, settings: data.settings || {} };
    }
  } catch (err) {
    console.warn('Error fetching organization settings for partners:', err);
  }
  return null;
}

async function saveOrgSettings(orgId: string, settings: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('organizations')
      .update({ settings })
      .eq('id', orgId);
    return !error;
  } catch (err) {
    console.warn('Error saving organization settings for partners:', err);
    return false;
  }
}

/**
 * Loads all partners and lead assignments combining remote Supabase settings with local cache fallback.
 */
export async function getStoreData(orgId?: string): Promise<PartnerStoreData> {
  const local = readLocalCache();
  const remote = await getOrgSettings(orgId);

  if (remote && remote.settings) {
    const remotePartners = remote.settings.partners;
    const remoteAssignments = remote.settings.leadAssignments;

    if (Array.isArray(remotePartners)) {
      local.partners = remotePartners;
    }
    if (remoteAssignments && typeof remoteAssignments === 'object') {
      local.leadAssignments = remoteAssignments;
    }
    // Keep local cache synced
    writeLocalCache(local);
  }

  return local;
}

/**
 * Saves store data to both Supabase organization settings and local file cache.
 */
export async function saveStoreData(data: PartnerStoreData, orgId?: string): Promise<void> {
  writeLocalCache(data);
  const remote = await getOrgSettings(orgId);
  if (remote) {
    const newSettings = {
      ...remote.settings,
      partners: data.partners,
      leadAssignments: data.leadAssignments,
    };
    await saveOrgSettings(remote.orgId, newSettings);
  }
}

// -------------------------------------------------------------
// Partner CRUD Operations
// -------------------------------------------------------------

export async function getAllPartners(orgId?: string): Promise<Partner[]> {
  const store = await getStoreData(orgId);
  return store.partners;
}

export async function getPartnerById(partnerId: string, orgId?: string): Promise<Partner | null> {
  const store = await getStoreData(orgId);
  return store.partners.find((p) => p.id === partnerId) || null;
}

export async function getPartnerByAccessKey(accessKey: string, orgId?: string): Promise<Partner | null> {
  const store = await getStoreData(orgId);
  const cleanKey = accessKey.trim().toLowerCase();
  return store.partners.find((p) => p.accessKey.trim().toLowerCase() === cleanKey && p.status === 'active') || null;
}

export async function createPartner(
  partnerInput: {
    name: string;
    email: string;
    accessKey?: string;
    role?: string;
    notes?: string;
  },
  orgId?: string
): Promise<Partner> {
  const store = await getStoreData(orgId);
  const now = new Date().toISOString();

  // Generate clean default accessKey if none provided
  const baseKey = partnerInput.accessKey
    ? partnerInput.accessKey.trim().toLowerCase()
    : `prt_${partnerInput.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;

  const newPartner: Partner = {
    id: `prt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: partnerInput.name.trim(),
    email: partnerInput.email.trim().toLowerCase(),
    accessKey: baseKey,
    role: partnerInput.role?.trim() || 'Outreach Partner',
    notes: partnerInput.notes?.trim() || '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  store.partners.push(newPartner);
  await saveStoreData(store, orgId);
  return newPartner;
}

export async function updatePartner(
  partnerId: string,
  updates: Partial<Omit<Partner, 'id' | 'createdAt'>>,
  orgId?: string
): Promise<Partner | null> {
  const store = await getStoreData(orgId);
  const idx = store.partners.findIndex((p) => p.id === partnerId);
  if (idx === -1) return null;

  const existing = store.partners[idx];
  const updated: Partner = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  store.partners[idx] = updated;
  await saveStoreData(store, orgId);
  return updated;
}

export async function deletePartner(partnerId: string, orgId?: string): Promise<boolean> {
  const store = await getStoreData(orgId);
  const initialLen = store.partners.length;
  store.partners = store.partners.filter((p) => p.id !== partnerId);

  // Unallot leads that were assigned to this partner
  for (const [bizId, assignment] of Object.entries(store.leadAssignments)) {
    if (assignment.partnerId === partnerId) {
      delete store.leadAssignments[bizId];
    }
  }

  if (store.partners.length !== initialLen) {
    await saveStoreData(store, orgId);
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// Lead Allotment Operations
// -------------------------------------------------------------

export async function getAllotments(orgId?: string): Promise<Record<string, LeadAssignment>> {
  const store = await getStoreData(orgId);
  return store.leadAssignments;
}

export const getAllotmentsMap = getAllotments;

export async function getPartnerAllottedLeadIds(partnerId: string, orgId?: string): Promise<string[]> {
  const store = await getStoreData(orgId);
  const ids: string[] = [];
  for (const [bizId, assignment] of Object.entries(store.leadAssignments)) {
    if (assignment.partnerId === partnerId) {
      ids.push(bizId);
    }
  }
  return ids;
}

export async function allotLeadsToPartner(
  businessIds: string[],
  partnerId: string | null,
  allottedBy: string = 'Admin',
  orgId?: string
): Promise<{ allottedCount: number }> {
  const store = await getStoreData(orgId);
  const now = new Date().toISOString();
  let count = 0;

  for (const bId of businessIds) {
    if (partnerId) {
      store.leadAssignments[bId] = {
        businessId: bId,
        partnerId,
        allottedAt: now,
        allottedBy,
      };
      count++;
    } else {
      // Unallot
      if (store.leadAssignments[bId]) {
        delete store.leadAssignments[bId];
        count++;
      }
    }
  }

  await saveStoreData(store, orgId);
  return { allottedCount: count };
}
