import { describe, it, expect } from 'vitest';
import {
  extractCanonicalDomain,
  normalizeBusinessName,
  findDuplicateBusiness,
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
});
