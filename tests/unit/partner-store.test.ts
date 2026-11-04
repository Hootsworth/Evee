import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllPartners,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerByAccessKey,
  getPartnerById,
  allotLeadsToPartner,
  getPartnerAllottedLeadIds,
  getAllotmentsMap,
} from '@/lib/services/partner-store';

describe('Partner Portal & Lead Allotment Multi-Tenant Store', () => {
  let partnerAId: string;
  let partnerBId: string;
  let partnerAAccessKey: string;

  beforeEach(async () => {
    // Create test partners
    const partnerA = await createPartner({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      company: 'Growth Advisors Delhi',
      role: 'Regional Partner',
    });
    partnerAId = partnerA.id;
    partnerAAccessKey = partnerA.accessKey;

    const partnerB = await createPartner({
      name: 'Ananya Verma',
      email: 'ananya.verma@example.com',
      company: 'South Outreach Partners',
      role: 'Growth Lead',
    });
    partnerBId = partnerB.id;
  });

  it('generates secure access keys prefixed with prt_ for new partners', async () => {
    expect(partnerAAccessKey).toMatch(/^prt_[a-z0-9_]+$/);
    const retrieved = await getPartnerByAccessKey(partnerAAccessKey);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(partnerAId);
    expect(retrieved?.email).toBe('rohan.sharma@example.com');
  });

  it('retrieves partners by ID and lists all active partners', async () => {
    const partner = await getPartnerById(partnerAId);
    expect(partner).toBeDefined();
    expect(partner?.name).toBe('Rohan Sharma');

    const all = await getAllPartners();
    const ids = all.map((p) => p.id);
    expect(ids).toContain(partnerAId);
    expect(ids).toContain(partnerBId);
  });

  it('updates partner status and notes', async () => {
    const updated = await updatePartner(partnerAId, {
      status: 'paused',
      notes: 'Paused for quarterly review',
    });
    expect(updated?.status).toBe('paused');
    expect(updated?.notes).toBe('Paused for quarterly review');

    const fetched = await getPartnerById(partnerAId);
    expect(fetched?.status).toBe('paused');
  });

  it('strictly isolates lead allotments between partners', async () => {
    const lead1 = 'lead-corp-101';
    const lead2 = 'lead-corp-102';
    const lead3 = 'lead-corp-103';

    // Allot lead1 and lead2 to Partner A
    const resA = await allotLeadsToPartner([lead1, lead2], partnerAId, 'admin-tester');
    expect(resA.allottedCount).toBe(2);

    // Allot lead3 to Partner B
    const resB = await allotLeadsToPartner([lead3], partnerBId, 'admin-tester');
    expect(resB.allottedCount).toBe(1);

    // Verify isolation
    const allottedToA = await getPartnerAllottedLeadIds(partnerAId);
    expect(allottedToA).toContain(lead1);
    expect(allottedToA).toContain(lead2);
    expect(allottedToA).not.toContain(lead3);

    const allottedToB = await getPartnerAllottedLeadIds(partnerBId);
    expect(allottedToB).toContain(lead3);
    expect(allottedToB).not.toContain(lead1);
    expect(allottedToB).not.toContain(lead2);
  });

  it('reassigns leads when allotted to another partner', async () => {
    const lead = 'lead-reassign-404';

    // First assign to Partner A
    await allotLeadsToPartner([lead], partnerAId);
    let aLeads = await getPartnerAllottedLeadIds(partnerAId);
    expect(aLeads).toContain(lead);

    // Reassign to Partner B
    await allotLeadsToPartner([lead], partnerBId);
    aLeads = await getPartnerAllottedLeadIds(partnerAId);
    const bLeads = await getPartnerAllottedLeadIds(partnerBId);

    expect(aLeads).not.toContain(lead);
    expect(bLeads).toContain(lead);
  });

  it('unallots leads when partnerId is null', async () => {
    const lead = 'lead-unallot-999';
    await allotLeadsToPartner([lead], partnerAId);

    let aLeads = await getPartnerAllottedLeadIds(partnerAId);
    expect(aLeads).toContain(lead);

    // Unallot
    await allotLeadsToPartner([lead], null);
    aLeads = await getPartnerAllottedLeadIds(partnerAId);
    expect(aLeads).not.toContain(lead);

    const map = await getAllotmentsMap();
    expect(map[lead]).toBeUndefined();
  });

  it('cleans up lead allotments when partner is deleted', async () => {
    const lead = 'lead-cleanup-888';
    await allotLeadsToPartner([lead], partnerAId);

    const success = await deletePartner(partnerAId);
    expect(success).toBe(true);

    const partner = await getPartnerById(partnerAId);
    expect(partner).toBeNull();

    const map = await getAllotmentsMap();
    expect(map[lead]).toBeUndefined();
  });
});
