// Evee - Google Places API Discovery Adapter
// Complies with ARCHITECTURE.MD Part E Section 10:
// Uses official Places API (New Text Search), requests only permitted fields, applies attribution, tracks costs

import { DiscoveryProvider, DiscoveryQuery, BusinessCandidate } from './interface';

export class GooglePlacesDiscoveryProvider implements DiscoveryProvider {
  name = 'google_places';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.DISCOVERY_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.PLACES_API_KEY ||
      '';
  }

  async search(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    if (!this.apiKey) {
      throw new Error('Google Places API key is not configured in DISCOVERY_API_KEY');
    }

    const searchQuery = `${query.categories.join(' ')} ${query.keywords.join(' ')} in ${query.geography}`.trim();
    const endpoint = 'https://places.googleapis.com/v1/places:searchText';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.primaryTypeDisplayName',
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        pageSize: Math.min(query.limit, 20),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const places = data.places || [];

    return places.map((place: any) => ({
      provider: 'google_places',
      providerId: place.id,
      name: place.displayName?.text || 'Unknown Business',
      category: place.primaryTypeDisplayName?.text,
      city: query.geography,
      officialWebsite: place.websiteUri,
      publicPhone: place.internationalPhoneNumber,
      sourceUrl: place.websiteUri || undefined,
      attribution: 'Google Places API',
    }));
  }
}
