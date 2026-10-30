// Evee - Mock Business Discovery Provider
// Generates realistic small business candidates for testing and offline development

import { DiscoveryProvider, DiscoveryQuery, BusinessCandidate } from './interface';

export class MockDiscoveryProvider implements DiscoveryProvider {
  name = 'mock';

  async search(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    const geo = query.geography || 'Bengaluru';
    const limit = Math.min(query.limit || 5, 20);

    const candidates: BusinessCandidate[] = [
      {
        provider: 'mock',
        providerId: `mock-${geo.toLowerCase()}-artisan-bakery`,
        name: 'The Artisan Crust Bakery & Cafe',
        category: 'Bakery & Cafe',
        city: geo,
        region: 'Karnataka',
        countryCode: 'IN',
        officialWebsite: 'https://artisancrust.example.com',
        publicContact: 'hello@artisancrust.example.com',
        publicPhone: '+91 98765 43210',
        sourceUrl: 'https://mock-directory.local/listing/artisan-crust',
        attribution: 'Simulated Local Business Registry (Mock)',
      },
      {
        provider: 'mock',
        providerId: `mock-${geo.toLowerCase()}-wellness-clinic`,
        name: 'Sutra Dental Care & Aesthetics',
        category: 'Dental Clinic',
        city: geo,
        region: 'Karnataka',
        countryCode: 'IN',
        officialWebsite: 'https://sutradental.example.com',
        publicContact: 'care@sutradental.example.com',
        publicPhone: '+91 98111 22334',
        sourceUrl: 'https://mock-directory.local/listing/sutra-dental',
        attribution: 'Simulated Local Business Registry (Mock)',
      },
      {
        provider: 'mock',
        providerId: `mock-${geo.toLowerCase()}-fitness-studio`,
        name: 'Pulse Kinetic Fitness Studio',
        category: 'Fitness & Gym',
        city: geo,
        region: 'Karnataka',
        countryCode: 'IN',
        officialWebsite: 'https://pulsekinetic.example.com',
        publicContact: 'info@pulsekinetic.example.com',
        publicPhone: '+91 98450 99887',
        sourceUrl: 'https://mock-directory.local/listing/pulse-kinetic',
        attribution: 'Simulated Local Business Registry (Mock)',
      },
      {
        provider: 'mock',
        providerId: `mock-${geo.toLowerCase()}-bistro`,
        name: 'Olive Tree Mediterranean Kitchen',
        category: 'Restaurant',
        city: geo,
        region: 'Karnataka',
        countryCode: 'IN',
        officialWebsite: 'https://olivetreebistro.example.com',
        publicContact: 'reservations@olivetreebistro.example.com',
        publicPhone: '+91 99000 11223',
        sourceUrl: 'https://mock-directory.local/listing/olive-tree',
        attribution: 'Simulated Local Business Registry (Mock)',
      },
      {
        provider: 'mock',
        providerId: `mock-${geo.toLowerCase()}-boutique-law`,
        name: 'Apex Legal Advocates & Consultants',
        category: 'Legal Services',
        city: geo,
        region: 'Karnataka',
        countryCode: 'IN',
        officialWebsite: 'https://apexlegal.example.com',
        publicContact: 'contact@apexlegal.example.com',
        publicPhone: '+91 97654 32109',
        sourceUrl: 'https://mock-directory.local/listing/apex-legal',
        attribution: 'Simulated Local Business Registry (Mock)',
      },
    ];

    return candidates.slice(0, limit);
  }
}
