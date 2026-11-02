import { describe, it, expect } from 'vitest';
import {
  extractCanonicalDomain,
  normalizeBusinessName,
  findDuplicateBusiness,
  identifyDuplicateLeads,
  identifyDuplicateContacts,
  calculateBusinessCompleteness,
} from '@/lib/normalization/deduplication';

describe('Business Deduplication & Normalization', () => {
  it('extracts canonical domain correctly', () => {
    expect(extractCanonicalDomain('https://www.example.com/contact')).toBe('example.com');
    expect(extractCanonicalDomain('http://cafe.in:8080/')).toBe('cafe.in');
    expect(extractCanonicalDomain(null)).toBeNull();
  });

  it('normalizes business names by removing legal noise', () => {
    expect(normalizeBusinessName('The Artisan Cafe Pvt. Ltd.')).toBe('the artisan cafe');
    expect(normalizeBusinessName('Sutra Dental Care LLC')).toBe('sutra dental care');
  });

  it('detects duplicates with matching domain', () => {
    const existing = [
      {
        id: '1',
        normalized_name: 'artisan crust bakery',
        canonical_domain: 'artisancrust.com',
        city: 'Bengaluru',
      },
    ];

    const match = findDuplicateBusiness(
      {
        name: 'Artisan Crust Cafe',
        website: 'https://artisancrust.com/locations',
        city: 'Bengaluru',
      },
      existing
    );

    expect(match).not.toBeNull();
    expect(match?.id).toBe('1');
  });

  it('does NOT merge solely because names match if locations differ', () => {
    const existing = [
      {
        id: '1',
        normalized_name: 'sutra dental',
        canonical_domain: 'sutradental-blr.in',
        city: 'Bengaluru',
      },
    ];

    const match = findDuplicateBusiness(
      {
        name: 'Sutra Dental',
        website: 'https://sutradental-delhi.com',
        city: 'New Delhi',
      },
      existing
    );

    expect(match).toBeNull();
  });

  it('identifies duplicate leads and picks the most complete primary record', () => {
    const leads = [
      {
        id: 'lead-1',
        display_name: 'Artisan Flour Bakery',
        official_website_url: 'https://artisanflour.com',
        general_business_email: '',
        city: 'Bengaluru',
      },
      {
        id: 'lead-2',
        display_name: 'Artisan Flour Bakery Pvt Ltd',
        official_website_url: 'https://www.artisanflour.com/contact',
        general_business_email: 'hello@artisanflour.com',
        public_business_phone: '+91 98765 43210',
        city: 'Bengaluru',
        contacts: [{ id: 'c-1', contact_name: 'Siddharth Rao', contact_email: 'siddharth@artisanflour.com' }],
      },
      {
        id: 'lead-3',
        display_name: 'Apex Legal Advisory',
        official_website_url: 'https://apexlegal.in',
        general_business_email: 'meera@apexlegal.in',
        city: 'Delhi',
      },
    ];

    const duplicates = identifyDuplicateLeads(leads);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].matchValue).toBe('artisanflour.com');
    // lead-2 has email, phone, and contacts, so it must be selected as primary
    expect(duplicates[0].primary.id).toBe('lead-2');
    expect(duplicates[0].duplicates).toHaveLength(1);
    expect(duplicates[0].duplicates[0].id).toBe('lead-1');
  });

  it('identifies duplicate contacts within a business', () => {
    const leads = [
      {
        id: 'b-1',
        display_name: 'Zenith Robotics',
        contacts: [
          { id: 'c-1', contact_name: 'Rohan Verma', contact_email: 'rohan@zenith.io', contact_phone: '+91 99000' },
          { id: 'c-2', contact_name: '', contact_email: 'rohan@zenith.io' },
        ],
      },
    ];

    const dupContacts = identifyDuplicateContacts(leads);
    expect(dupContacts).toHaveLength(1);
    expect(dupContacts[0].primary.id).toBe('c-1');
    expect(dupContacts[0].duplicates).toHaveLength(1);
    expect(dupContacts[0].duplicates[0].id).toBe('c-2');
  });
});
