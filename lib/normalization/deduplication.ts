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

export interface DuplicateLeadGroup {
  id: string;
  reason: 'domain' | 'email' | 'name_location' | 'phone';
  reasonLabel: string;
  matchValue: string;
  primary: any;
  duplicates: any[];
  all: any[];
}

export interface DuplicateContactGroup {
  id: string;
  businessId: string;
  businessName: string;
  matchValue: string;
  reason: 'email' | 'name';
  primary: any;
  duplicates: any[];
}

/**
 * Calculates a completeness score for a business record.
 * Higher score = more complete data (used to pick which record to keep).
 */
export function calculateBusinessCompleteness(b: any): number {
  if (!b) return 0;
  let score = 0;
  if (b.general_business_email && b.general_business_email.trim()) score += 30;
  if (b.official_website_url && b.official_website_url.trim()) score += 20;
  if (b.public_business_phone && b.public_business_phone.trim()) score += 15;
  if (b.business_type && b.business_type.trim()) score += 5;
  if (b.city && b.city.trim()) score += 5;
  if (b.contacts && Array.isArray(b.contacts)) {
    score += b.contacts.length * 10;
    for (const c of b.contacts) {
      if (c.contact_email && c.contact_email.trim()) score += 10;
      if (c.contact_name && c.contact_name.trim()) score += 5;
    }
  }
  if (b.lead_scores && Array.isArray(b.lead_scores) && b.lead_scores.length > 0) score += 5;
  if (b.evidence_items && Array.isArray(b.evidence_items) && b.evidence_items.length > 0) score += 5;
  return score;
}

/**
 * Scans a list of businesses and clusters duplicates using Union-Find.
 * Matches on:
 * 1. Canonical domain
 * 2. General business email
 * 3. Normalized business name + same city
 * 4. Clean phone number (>= 8 digits)
 */
export function identifyDuplicateLeads(businesses: any[]): DuplicateLeadGroup[] {
  if (!Array.isArray(businesses) || businesses.length < 2) return [];

  // Union-Find implementation
  const parent = new Map<string, string>();
  const reasonMap = new Map<string, { reason: 'domain' | 'email' | 'name_location' | 'phone'; matchValue: string }>();

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  }

  function union(
    idA: string,
    idB: string,
    reason: 'domain' | 'email' | 'name_location' | 'phone',
    matchValue: string
  ) {
    const rootA = find(idA);
    const rootB = find(idB);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
      if (!reasonMap.has(rootA)) {
        reasonMap.set(rootA, { reason, matchValue });
      }
    }
  }

  // Lookup buckets
  const domainBucket = new Map<string, string>();
  const emailBucket = new Map<string, string>();
  const nameCityBucket = new Map<string, string>();
  const phoneBucket = new Map<string, string>();

  for (const b of businesses) {
    const id = b.id;
    if (!id) continue;
    find(id); // initialize

    // 1. Domain match
    const domain = extractCanonicalDomain(b.official_website_url || b.canonical_domain);
    if (domain) {
      if (domainBucket.has(domain)) {
        union(domainBucket.get(domain)!, id, 'domain', domain);
      } else {
        domainBucket.set(domain, id);
      }
    }

    // 2. Email match
    const email = b.general_business_email?.trim().toLowerCase();
    if (email && email.includes('@')) {
      if (emailBucket.has(email)) {
        union(emailBucket.get(email)!, id, 'email', email);
      } else {
        emailBucket.set(email, id);
      }
    }

    // 3. Normalized name + city match
    const normName = normalizeBusinessName(b.display_name || b.name || '');
    const city = (b.city || '').trim().toLowerCase();
    if (normName && city) {
      const key = `${normName}:::${city}`;
      if (nameCityBucket.has(key)) {
        union(nameCityBucket.get(key)!, id, 'name_location', `${b.display_name || normName} in ${b.city}`);
      } else {
        nameCityBucket.set(key, id);
      }
    }

    // 4. Phone match (clean digits, min 8 digits)
    const phone = (b.public_business_phone || '').replace(/\D/g, '');
    if (phone.length >= 8) {
      if (phoneBucket.has(phone)) {
        union(phoneBucket.get(phone)!, id, 'phone', b.public_business_phone);
      } else {
        phoneBucket.set(phone, id);
      }
    }
  }

  // Collect clusters
  const clusters = new Map<string, any[]>();
  for (const b of businesses) {
    if (!b.id) continue;
    const root = find(b.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(b);
  }

  const result: DuplicateLeadGroup[] = [];

  for (const [root, members] of clusters.entries()) {
    if (members.length < 2) continue;

    // Sort members by completeness descending; tie breaker created_at oldest first
    const sorted = [...members].sort((a, b) => {
      const scoreA = calculateBusinessCompleteness(a);
      const scoreB = calculateBusinessCompleteness(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1);
    const meta = reasonMap.get(root) || { reason: 'domain', matchValue: 'Similar profile' };

    let reasonLabel = 'Matching Profile';
    if (meta.reason === 'domain') reasonLabel = `Matching Domain: ${meta.matchValue}`;
    else if (meta.reason === 'email') reasonLabel = `Matching Email: ${meta.matchValue}`;
    else if (meta.reason === 'name_location') reasonLabel = `Same Business & City: ${meta.matchValue}`;
    else if (meta.reason === 'phone') reasonLabel = `Matching Phone: ${meta.matchValue}`;

    result.push({
      id: `dup-group-${root}`,
      reason: meta.reason,
      reasonLabel,
      matchValue: meta.matchValue,
      primary,
      duplicates,
      all: sorted,
    });
  }

  return result;
}

/**
 * Identifies duplicate contacts within or across businesses.
 */
export function identifyDuplicateContacts(businesses: any[]): DuplicateContactGroup[] {
  if (!Array.isArray(businesses)) return [];

  const groups: DuplicateContactGroup[] = [];

  for (const b of businesses) {
    if (!b.contacts || !Array.isArray(b.contacts) || b.contacts.length < 2) continue;

    const emailMap = new Map<string, any[]>();
    for (const c of b.contacts) {
      const email = c.contact_email?.trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(c);
    }

    for (const [email, contacts] of emailMap.entries()) {
      if (contacts.length > 1) {
        // Pick primary contact (one with name or phone)
        const sorted = [...contacts].sort((a, b) => {
          let scoreA = (a.contact_name ? 2 : 0) + (a.contact_phone ? 1 : 0);
          let scoreB = (b.contact_name ? 2 : 0) + (b.contact_phone ? 1 : 0);
          return scoreB - scoreA;
        });

        groups.push({
          id: `contact-dup-${b.id}-${email}`,
          businessId: b.id,
          businessName: b.display_name,
          matchValue: email,
          reason: 'email',
          primary: sorted[0],
          duplicates: sorted.slice(1),
        });
      }
    }
  }

  return groups;
}
