import { describe, it, expect } from 'vitest';
import { BusinessRecord } from '@/lib/types';

describe('Lead Archival & Status Lifecycle', () => {
  const sampleLeads: Partial<BusinessRecord>[] = [
    {
      id: 'lead-1',
      display_name: 'Artisan Flour Bakery',
      record_status: 'active',
      general_business_email: 'hello@artisanflour.com',
      city: 'Bengaluru',
    },
    {
      id: 'lead-2',
      display_name: 'Quick Tyre Shop',
      record_status: 'active',
      general_business_email: null,
      city: 'Delhi',
    },
    {
      id: 'lead-3',
      display_name: 'Old Bookseller',
      record_status: 'active',
      general_business_email: '',
      city: 'Mumbai',
    },
    {
      id: 'lead-4',
      display_name: 'Vintage Cafe',
      record_status: 'archived',
      general_business_email: 'info@vintagecafe.com',
      city: 'Bengaluru',
    },
  ];

  it('correctly filters active leads vs no-email leads vs archived leads', () => {
    // Active leads
    const activeLeads = sampleLeads.filter((l) => l.record_status === 'active');
    expect(activeLeads.length).toBe(3);

    // Active leads missing emails
    const missingEmailLeads = activeLeads.filter(
      (l) => !l.general_business_email || l.general_business_email.trim() === ''
    );
    expect(missingEmailLeads.length).toBe(2);
    expect(missingEmailLeads.map((l) => l.id)).toEqual(['lead-2', 'lead-3']);

    // Archived leads
    const archivedLeads = sampleLeads.filter((l) => l.record_status === 'archived');
    expect(archivedLeads.length).toBe(1);
    expect(archivedLeads[0].id).toBe('lead-4');
  });

  it('simulates archival transition of no-email leads', () => {
    const updated = sampleLeads.map((lead) => {
      if (lead.record_status === 'active' && (!lead.general_business_email || lead.general_business_email.trim() === '')) {
        return { ...lead, record_status: 'archived' as const };
      }
      return lead;
    });

    const activeRemaining = updated.filter((l) => l.record_status === 'active');
    expect(activeRemaining.length).toBe(1);
    expect(activeRemaining[0].id).toBe('lead-1');

    const totalArchived = updated.filter((l) => l.record_status === 'archived');
    expect(totalArchived.length).toBe(3);
  });

  it('simulates unarchival / restoration of an archived lead', () => {
    const targetLeadId = 'lead-4';
    const restored = sampleLeads.map((lead) => {
      if (lead.id === targetLeadId) {
        return { ...lead, record_status: 'active' as const };
      }
      return lead;
    });

    const lead = restored.find((l) => l.id === targetLeadId);
    expect(lead?.record_status).toBe('active');
  });
});
