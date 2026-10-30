// Evee - Business Normalization & Deduplication Service
// Aligned with ARCHITECTURE.MD Part C Section 7.2

export function extractCanonicalDomain(urlOrDomain: string | null | undefined): string | null {
  if (!urlOrDomain) return null;
  let str = urlOrDomain.trim().toLowerCase();

  // Remove protocol
  str = str.replace(/^(https?:\/\/)/, '');
  // Remove port and path
  str = str.split('/')[0].split(':')[0];
  // Remove www.
  str = str.replace(/^www\./, '');

  if (!str || !str.includes('.')) return null;
  return str;
}

export function normalizeBusinessName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim().toLowerCase();

  // Strip common corporate suffixes
  cleaned = cleaned.replace(/\b(pvt\.?|ltd\.?|private limited|limited|llc|inc\.?|corp\.?|co\.?)\b/gi, '');
  // Remove punctuation & extra whitespace
  cleaned = cleaned.replace(/[^\w\s]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export interface BusinessIdentityCandidate {
  name: string;
  website?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface ExistingBusinessRecord {
  id: string;
  normalized_name: string;
  canonical_domain?: string | null;
  city: string;
  public_business_phone?: string | null;
}

/**
 * Checks if a candidate business matches an existing record in the database.
 * Rule: Never merge two businesses solely because their names match.
 * Must match:
 * 1. Canonical domain (highest confidence), OR
 * 2. Normalized name AND same city AND (matching phone or matching postal code)
 */
export function findDuplicateBusiness(
  candidate: BusinessIdentityCandidate,
  existingList: ExistingBusinessRecord[]
): ExistingBusinessRecord | null {
  const candidateDomain = extractCanonicalDomain(candidate.website);
  const candidateNormName = normalizeBusinessName(candidate.name);
  const candidateCity = (candidate.city || '').trim().toLowerCase();
  const candidatePhone = (candidate.phone || '').replace(/[\s\-\(\)\.]/g, '');

  for (const existing of existingList) {
    // 1. Domain match
    if (candidateDomain && existing.canonical_domain) {
      if (candidateDomain === existing.canonical_domain) {
        return existing;
      }
    }

    // 2. Name + City + Phone match
    if (
      candidateNormName &&
      existing.normalized_name === candidateNormName &&
      candidateCity &&
      existing.city.trim().toLowerCase() === candidateCity
    ) {
      if (candidatePhone && existing.public_business_phone) {
        const existingPhone = existing.public_business_phone.replace(/[\s\-\(\)\.]/g, '');
        if (candidatePhone === existingPhone) {
          return existing;
        }
      }
    }
  }

  return null;
}
