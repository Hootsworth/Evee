import { describe, it, expect } from 'vitest';
import { ExploriumEnrichmentProvider } from '@/lib/providers/enrichment/explorium';
import { detectColumnMapping } from '@/lib/csv/parser';

describe('Lead Enrichment & Discovery Engine', () => {
  it('detects phone and category columns in CSV mapping', () => {
    const headers = ['Business Name', 'Official Site', 'Email Address', 'Phone Number', 'Industry Sector'];
    const mapping = detectColumnMapping(headers);

    expect(mapping.companyName).toBe('Business Name');
    expect(mapping.website).toBe('Official Site');
    expect(mapping.email).toBe('Email Address');
    expect(mapping.phone).toBe('Phone Number');
    expect(mapping.category).toBe('Industry Sector');
  });

  it('enriches business with canonical domain email fallback', async () => {
    const provider = new ExploriumEnrichmentProvider();
    const result = await provider.enrichBusiness({
      name: 'Artisan Sourdough Bakery',
      domain: 'artisanflour.com',
      city: 'Bengaluru',
      category: 'Artisan Bakery',
    });

    expect(result.businessName).toBe('Artisan Sourdough Bakery');
    expect(result.domain).toBe('artisanflour.com');
    expect(result.generalEmail).toBeDefined();
    expect(result.generalEmail).toContain('@artisanflour.com');
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.contacts[0].verificationStatus).toBeDefined();
  }, 10000);

  it('handles business without website gracefully', async () => {
    const provider = new ExploriumEnrichmentProvider();
    const result = await provider.enrichBusiness({
      name: 'Local Corner Tailor',
      city: 'Mumbai',
    });

    expect(result.businessName).toBe('Local Corner Tailor');
    expect(result.contacts).toBeDefined();
  });
});
