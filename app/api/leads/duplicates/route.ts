// Evee - Duplicate Detection & Deletion API Handler
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  identifyDuplicateLeads,
  identifyDuplicateContacts,
} from '@/lib/normalization/deduplication';

export async function GET() {
  try {
    const admin = createAdminClient();

    // Fetch all active/existing businesses with contacts
    const { data: businesses, error } = await admin
      .from('businesses')
      .select(`
        *,
        contacts (*),
        lead_scores (*),
        evidence_items (*)
      `)
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
    console.error('Failed to identify duplicates:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to detect duplicates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
    let leadsToDelete: string[] = [];
    let contactsToDelete: string[] = [];

    if (autoCleanAll) {
      // Find all duplicate leads and contacts across the database
      const { data: businesses } = await admin
        .from('businesses')
        .select(`*, contacts (*)`);

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

    // 1. Delete Contacts if specified
    if (contactsToDelete.length > 0) {
      const { error: contactErr } = await admin
        .from('contacts')
        .delete()
        .in('id', contactsToDelete);

      if (contactErr) {
        console.warn('Error deleting contacts:', contactErr.message);
      } else {
        deletedContactsCount = contactsToDelete.length;
      }
    }

    // 2. Delete Leads (Businesses)
    if (leadsToDelete.length > 0) {
      // Clean up dependent child rows first to avoid foreign key constraints
      try {
        await admin.from('outreach_jobs').delete().in('business_id', leadsToDelete);
        await admin.from('email_drafts').delete().in('business_id', leadsToDelete);
        await admin.from('lead_scores').delete().in('business_id', leadsToDelete);
        await admin.from('evidence_items').delete().in('business_id', leadsToDelete);
        await admin.from('research_runs').delete().in('business_id', leadsToDelete);
        await admin.from('contacts').delete().in('business_id', leadsToDelete);
      } catch (childErr) {
        console.warn('Cascading clean-up warning:', childErr);
      }

      const { error: businessErr } = await admin
        .from('businesses')
        .delete()
        .in('id', leadsToDelete);

      if (businessErr) {
        return NextResponse.json({ error: businessErr.message }, { status: 500 });
      }

      deletedLeadsCount = leadsToDelete.length;
    }

    // 3. Log audit log
    try {
      await admin.from('audit_events').insert({
        event_type: 'DUPLICATES_DELETED',
        entity_type: 'businesses',
        details: {
          action,
          autoCleanAll,
          deletedLeadsCount,
          deletedContactsCount,
          leadsToDelete,
          contactsToDelete,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedLeadsCount} duplicate leads and ${deletedContactsCount} duplicate contacts.`,
      deletedLeadsCount,
      deletedContactsCount,
      deletedLeadIds: leadsToDelete,
      deletedContactIds: contactsToDelete,
    });
  } catch (err: any) {
    console.error('Delete duplicates error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to delete duplicates' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req);
}
