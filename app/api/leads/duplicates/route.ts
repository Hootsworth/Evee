// Evee - Duplicate Detection & Deletion API Handler (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  identifyDuplicateLeads,
  identifyDuplicateContacts,
} from '@/lib/normalization/deduplication';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    // Fetch active/existing businesses with contacts strictly within this organization
    const { data: businesses, error } = await admin
      .from('businesses')
      .select(`
        *,
        contacts (*),
        lead_scores (*),
        evidence_items (*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allBusinesses = businesses || [];
    const duplicateLeadGroups = identifyDuplicateLeads(allBusinesses);
    const duplicateContactGroups = identifyDuplicateContacts(allBusinesses);

    const totalDuplicateLeads = duplicateLeadGroups.reduce(
      (acc, grp) => acc + grp.duplicates.length,
      0
    );
    const totalDuplicateContacts = duplicateContactGroups.reduce(
      (acc, grp) => acc + grp.duplicates.length,
      0
    );

    return NextResponse.json({
      success: true,
      duplicateLeadGroups,
      duplicateContactGroups,
      totalDuplicateLeads,
      totalDuplicateContacts,
      totalBusinesses: allBusinesses.length,
      cleanLeadsCount: allBusinesses.length - totalDuplicateLeads,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json();
    const {
      action = 'delete_duplicates',
      leadIds = [],
      contactIds = [],
      autoCleanAll = false,
    } = body as {
      action?: 'delete_duplicates' | 'delete_leads' | 'delete_contacts';
      leadIds?: string[];
      contactIds?: string[];
      autoCleanAll?: boolean;
    };

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;
    let leadsToDelete: string[] = [];
    let contactsToDelete: string[] = [];

    if (autoCleanAll) {
      // Find all duplicate leads and contacts strictly within this organization
      const { data: businesses } = await admin
        .from('businesses')
        .select(`*, contacts (*)`)
        .eq('organization_id', orgId);

      const allBusinesses = businesses || [];
      const dupLeadGroups = identifyDuplicateLeads(allBusinesses);
      const dupContactGroups = identifyDuplicateContacts(allBusinesses);

      leadsToDelete = dupLeadGroups.flatMap((g) => g.duplicates.map((d) => d.id));
      contactsToDelete = dupContactGroups.flatMap((g) => g.duplicates.map((d) => d.id));
    } else {
      if (Array.isArray(leadIds) && leadIds.length > 0) {
        leadsToDelete = leadIds;
      }
      if (Array.isArray(contactIds) && contactIds.length > 0) {
        contactsToDelete = contactIds;
      }
    }

    let deletedLeadsCount = 0;
    let deletedContactsCount = 0;

    // 1. Delete Contacts if specified (verified against tenant's businesses)
    if (contactsToDelete.length > 0) {
      // Ensure contacts belong to this organization's businesses
      const { data: validContacts } = await admin
        .from('contacts')
        .select('id, business:businesses!inner(organization_id)')
        .in('id', contactsToDelete)
        .eq('businesses.organization_id', orgId);

      const verifiedContactIds = (validContacts || []).map((c) => c.id);

      if (verifiedContactIds.length > 0) {
        const { error: contactErr } = await admin
          .from('contacts')
          .delete()
          .in('id', verifiedContactIds);

        if (!contactErr) {
          deletedContactsCount = verifiedContactIds.length;
        }
      }
    }

    // 2. Delete Leads (Businesses) belonging strictly to this organization
    if (leadsToDelete.length > 0) {
      const { data: validBusinesses } = await admin
        .from('businesses')
        .select('id')
        .in('id', leadsToDelete)
        .eq('organization_id', orgId);

      const verifiedBusinessIds = (validBusinesses || []).map((b) => b.id);

      if (verifiedBusinessIds.length > 0) {
        try {
          await admin.from('outreach_jobs').delete().in('business_id', verifiedBusinessIds);
          await admin.from('email_drafts').delete().in('business_id', verifiedBusinessIds).eq('organization_id', orgId);
          await admin.from('lead_scores').delete().in('business_id', verifiedBusinessIds);
          await admin.from('evidence_items').delete().in('business_id', verifiedBusinessIds);
          await admin.from('contacts').delete().in('business_id', verifiedBusinessIds);
          await admin.from('campaign_businesses').delete().in('business_id', verifiedBusinessIds);

          const { error: deleteErr } = await admin
            .from('businesses')
            .delete()
            .in('id', verifiedBusinessIds)
            .eq('organization_id', orgId);

          if (!deleteErr) {
            deletedLeadsCount = verifiedBusinessIds.length;
          }
        } catch (delErr) {
          console.warn('Error during cascaded delete:', delErr);
        }
      }
    }

    // Record audit event
    try {
      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: 'DUPLICATES_DELETED',
        entity_type: 'businesses',
        details: {
          deletedLeadsCount,
          deletedContactsCount,
          action,
          operatorId: userCtx.userId,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      deletedLeadsCount,
      deletedContactsCount,
      message: `Cleaned ${deletedLeadsCount} duplicate leads and ${deletedContactsCount} duplicate contacts.`,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
