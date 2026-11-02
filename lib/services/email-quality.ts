// Evee - AI & Rule-Driven Email Quality, Proxy Detector, and Archival Engine
// Detects fake emails, non-emails, aggregator redirects (Swiggy, Foursquare, etc.),
// social platform handles (Instagram, etc.), no-reply addresses, and cross-lead duplicates.

import { getDynamicAiProvider } from '@/lib/providers/ai';

export type EmailFlagCategory =
  | 'aggregator_proxy'
  | 'social_platform'
  | 'placeholder_fake'
  | 'non_email'
  | 'system_noreply'
  | 'duplicate_email';

export interface EmailQualityFlag {
  category: EmailFlagCategory;
  categoryLabel: string;
  reason: string;
  confidence: number; // 0.0 to 1.0
  suggestedAction: 'archive' | 'review';
}

export interface FlaggedLeadEmail {
  leadId: string;
  displayName: string;
  officialWebsiteUrl?: string;
  city?: string;
  email: string;
  recordStatus: string;
  flag: EmailQualityFlag;
  duplicateCount?: number;
}

export interface EmailAuditReport {
  scannedAt: string;
  totalLeads: number;
  totalWithEmail: number;
  totalFlagged: number;
  flaggedByCategory: Record<EmailFlagCategory, number>;
  flaggedLeads: FlaggedLeadEmail[];
}

// 1. Known Aggregator, Directory, and Delivery Proxy Domains
const AGGREGATOR_PROXY_DOMAINS = new Set([
  'redirect.foursquare.com',
  'foursquare.com',
  'swiggy.com',
  'swiggy.in',
  'zomato.com',
  'yelp.com',
  'yelp.co.uk',
  'yelp.ca',
  'tripadvisor.com',
  'tripadvisor.in',
  'justdial.com',
  'yellowpages.com',
  'yellowpages.ca',
  'deliveroo.com',
  'deliveroo.co.uk',
  'ubereats.com',
  'doordash.com',
  'grubhub.com',
  'opentable.com',
  'resy.com',
  'bookatable.com',
  'magicpin.in',
  'dineout.co.in',
  'zmenu.com',
  'menupages.com',
  'eat24.com',
  'toasttab.com',
  'chownow.com',
]);

// 2. Social Media Platform Domains (mistakenly scraped instead of real decision maker emails)
const SOCIAL_PLATFORM_DOMAINS = new Set([
  'instagram.com',
  'ig.com',
  'facebook.com',
  'facebookmail.com',
  'meta.com',
  'fb.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'pinterest.com',
  'threads.net',
  'youtube.com',
  'snapchat.com',
  'reddit.com',
]);

// 3. Known Placeholder / Test / Fake Domain Names
const FAKE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'testing.com',
  'domain.com',
  'yourdomain.com',
  'sample.com',
  'placeholder.com',
  'dummy.com',
  'invalid.com',
  'localhost',
  'none.com',
  'null.com',
  'na.com',
  'temp.com',
  'abc.com',
  'xyz.com',
  'fake.com',
]);

// 4. Placeholder Username Prefixes / Patterns
const FAKE_USERNAMES = new Set([
  'test',
  'sample',
  'demo',
  'user',
  'admin',
  'null',
  'none',
  'noemail',
  'no-email',
  'fake',
  'placeholder',
  'dummy',
  'notavailable',
  'notfound',
  'na',
  'asdf',
  'qwerty',
  '123456',
  'xyz',
  'abc',
  'temp',
]);

// 5. System No-Reply / Daemon Prefixes
const SYSTEM_NOREPLY_PREFIXES = [
  'noreply@',
  'no-reply@',
  'donotreply@',
  'do-not-reply@',
  'mailer-daemon@',
  'postmaster@',
  'bounce@',
  'bounces@',
  'notifications@',
  'automated@',
  'robot@',
];

/**
 * Evaluates an individual email string using rule-based heuristics.
 * Returns null if the email appears to be a normal business/personal email.
 */
export function evaluateEmailQuality(rawEmail: string): EmailQualityFlag | null {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return {
      category: 'non_email',
      categoryLabel: 'Non-Email String',
      reason: 'Empty or missing email value',
      confidence: 1.0,
      suggestedAction: 'archive',
    };
  }

  const email = rawEmail.trim().toLowerCase();

  // Check 1: Non-Email or malformed strings
  if (!email.includes('@')) {
    // Maybe a URL or phone number accidentally in email field
    if (/^\+?\d[\d\s\-().]{6,}\d$/.test(email)) {
      return {
        category: 'non_email',
        categoryLabel: 'Phone in Email Field',
        reason: `Value "${rawEmail}" is a phone number, not an email`,
        confidence: 1.0,
        suggestedAction: 'archive',
      };
    }
    if (email.startsWith('http://') || email.startsWith('https://') || email.startsWith('www.')) {
      return {
        category: 'non_email',
        categoryLabel: 'URL in Email Field',
        reason: `Value "${rawEmail}" is a web link, not an email address`,
        confidence: 1.0,
        suggestedAction: 'archive',
      };
    }
    return {
      category: 'non_email',
      categoryLabel: 'Malformed Non-Email',
      reason: `Missing "@" symbol in "${rawEmail}"`,
      confidence: 1.0,
      suggestedAction: 'archive',
    };
  }

  // Split username and domain
  const parts = email.split('@');
  if (parts.length !== 2) {
    return {
      category: 'non_email',
      categoryLabel: 'Multiple @ Symbols',
      reason: `Malformed address with multiple "@" symbols in "${rawEmail}"`,
      confidence: 1.0,
      suggestedAction: 'archive',
    };
  }

  const [username, domain] = parts;

  if (!username || username.trim() === '') {
    return {
      category: 'non_email',
      categoryLabel: 'Missing Username',
      reason: `Email is missing user prefix before "@"`,
      confidence: 1.0,
      suggestedAction: 'archive',
    };
  }

  if (!domain || domain.trim() === '' || !domain.includes('.')) {
    return {
      category: 'non_email',
      categoryLabel: 'Invalid Domain Part',
      reason: `Domain "${domain}" is missing a valid top-level extension (TLD)`,
      confidence: 0.95,
      suggestedAction: 'archive',
    };
  }

  // Check 2: Aggregator / Proxy / Redirect Domains (Swiggy, Foursquare, etc.)
  for (const aggDomain of AGGREGATOR_PROXY_DOMAINS) {
    if (domain === aggDomain || domain.endsWith('.' + aggDomain)) {
      const providerName = aggDomain.split('.')[0].toUpperCase();
      return {
        category: 'aggregator_proxy',
        categoryLabel: `Aggregator Proxy (${providerName})`,
        reason: `Aggregator/Directory proxy domain (${domain}). Emails to this domain redirect or bounce and do not reach business decision makers.`,
        confidence: 0.99,
        suggestedAction: 'archive',
      };
    }
  }

  // Check 3: Social Platform Domains (Instagram, Facebook, TikTok, etc.)
  for (const socialDomain of SOCIAL_PLATFORM_DOMAINS) {
    if (domain === socialDomain || domain.endsWith('.' + socialDomain)) {
      const platform = socialDomain.split('.')[0].toUpperCase();
      return {
        category: 'social_platform',
        categoryLabel: `Social Platform (${platform})`,
        reason: `Social media platform domain (${domain}). Typically a social profile handle or notification relay, not a direct business inbox.`,
        confidence: 0.98,
        suggestedAction: 'archive',
      };
    }
  }

  // Check 4: Placeholder / Fake Domains
  if (
    FAKE_DOMAINS.has(domain) ||
    domain.endsWith('.invalid') ||
    domain.endsWith('.example') ||
    domain.endsWith('.test') ||
    domain.endsWith('.localhost')
  ) {
    return {
      category: 'placeholder_fake',
      categoryLabel: 'Fake / Test Domain',
      reason: `Domain "${domain}" is a standard mock/test or placeholder domain.`,
      confidence: 0.99,
      suggestedAction: 'archive',
    };
  }

  // Check 5: Placeholder Usernames (e.g. test@, user@, none@, null@)
  if (FAKE_USERNAMES.has(username)) {
    return {
      category: 'placeholder_fake',
      categoryLabel: 'Placeholder Email',
      reason: `Username "${username}" is a placeholder or fake test identity.`,
      confidence: 0.9,
      suggestedAction: 'archive',
    };
  }

  // Check 6: System No-Reply / Daemon
  for (const prefix of SYSTEM_NOREPLY_PREFIXES) {
    if (email.startsWith(prefix)) {
      return {
        category: 'system_noreply',
        categoryLabel: 'No-Reply / System Bot',
        reason: `Automated unmonitored mailbox (${prefix.replace('@', '')}). Inbound cold outreach will be rejected or discarded.`,
        confidence: 0.95,
        suggestedAction: 'archive',
      };
    }
  }

  // Valid business or standard email
  return null;
}

/**
 * Scans a list of business records and classifies emails, including duplicate cross-lead emails.
 */
export function scanLeadsEmailQuality(businesses: any[]): EmailAuditReport {
  const result: FlaggedLeadEmail[] = [];
  const categoryCounts: Record<EmailFlagCategory, number> = {
    aggregator_proxy: 0,
    social_platform: 0,
    placeholder_fake: 0,
    non_email: 0,
    system_noreply: 0,
    duplicate_email: 0,
  };

  let totalWithEmail = 0;

  // Build email occurrence index to detect cross-lead duplicates
  const emailOccurrences = new Map<string, any[]>();

  for (const b of businesses) {
    const rawEmail = b.general_business_email;
    if (rawEmail && typeof rawEmail === 'string' && rawEmail.trim()) {
      totalWithEmail++;
      const normEmail = rawEmail.trim().toLowerCase();
      if (!emailOccurrences.has(normEmail)) {
        emailOccurrences.set(normEmail, []);
      }
      emailOccurrences.get(normEmail)!.push(b);
    }
  }

  for (const b of businesses) {
    const rawEmail = b.general_business_email;
    const normEmail = (rawEmail || '').trim().toLowerCase();

    // 1. Single email evaluation
    const flag = evaluateEmailQuality(rawEmail);

    if (flag) {
      categoryCounts[flag.category]++;
      result.push({
        leadId: b.id,
        displayName: b.display_name || 'Unnamed Business',
        officialWebsiteUrl: b.official_website_url,
        city: b.city,
        email: rawEmail,
        recordStatus: b.record_status || 'active',
        flag,
      });
      continue;
    }

    // 2. Cross-lead duplicate check (shared by 2+ distinct businesses)
    if (normEmail && emailOccurrences.has(normEmail)) {
      const occurrences = emailOccurrences.get(normEmail)!;
      if (occurrences.length > 1) {
        const flagDup: EmailQualityFlag = {
          category: 'duplicate_email',
          categoryLabel: `Shared Email (${occurrences.length} Leads)`,
          reason: `Exact same email address is shared across ${occurrences.length} distinct business leads. Likely an agency, directory, or aggregator holding address.`,
          confidence: 0.85,
          suggestedAction: 'review',
        };
        categoryCounts.duplicate_email++;
        result.push({
          leadId: b.id,
          displayName: b.display_name || 'Unnamed Business',
          officialWebsiteUrl: b.official_website_url,
          city: b.city,
          email: rawEmail,
          recordStatus: b.record_status || 'active',
          flag: flagDup,
          duplicateCount: occurrences.length,
        });
      }
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalLeads: businesses.length,
    totalWithEmail,
    totalFlagged: result.length,
    flaggedByCategory: categoryCounts,
    flaggedLeads: result,
  };
}

/**
 * Deep AI Email Analysis for ambiguous cases.
 * Uses the configured AI provider (Gemini / OpenAI / Meta Llama) to classify suspicious domains.
 */
export async function auditEmailsWithAI(
  emailsWithContext: { email: string; businessName: string; website?: string }[]
): Promise<Record<string, { isSuspicious: boolean; reason: string; category: EmailFlagCategory }>> {
  if (!emailsWithContext.length) return {};

  try {
    const ai = await getDynamicAiProvider();
    const systemPrompt = `You are a cold email deliverability and data hygiene specialist.
Analyze this list of business emails and detect:
- Aggregator proxies (e.g. food delivery redirects like @swiggy.com, @redirect.foursquare.com, @zomato.com)
- Social platform domains (e.g. @instagram.com, @facebook.com)
- Non-emails, fake test placeholders (e.g. @test.com, @example.com, test@...)
- Automated no-reply addresses (e.g. noreply@...)

Respond strictly in valid JSON matching:
{
  "results": [
    {
      "email": "string",
      "isSuspicious": boolean,
      "category": "aggregator_proxy" | "social_platform" | "placeholder_fake" | "non_email" | "system_noreply" | "valid_direct",
      "reason": "string"
    }
  ]
}`;

    const promptText = JSON.stringify(emailsWithContext);
    
    // If the provider supports dynamic prompts or chat completion:
    if ((ai as any).chatCompletion) {
      const response = await (ai as any).chatCompletion(systemPrompt, promptText);
      const parsed = JSON.parse(response);
      const map: Record<string, any> = {};
      for (const item of parsed.results || []) {
        map[item.email.toLowerCase()] = item;
      }
      return map;
    }
  } catch (err) {
    console.warn('AI email audit fallback to rules:', err);
  }

  // Fallback to heuristic evaluation
  const fallbackMap: Record<string, any> = {};
  for (const item of emailsWithContext) {
    const evaluated = evaluateEmailQuality(item.email);
    fallbackMap[item.email.toLowerCase()] = {
      isSuspicious: evaluated !== null,
      category: evaluated?.category || 'valid_direct',
      reason: evaluated?.reason || 'Valid direct business inbox',
    };
  }
  return fallbackMap;
}
