// Evee - Suppression & Anti-Spam Compliance Checks
// Checks global and tenant suppression registry before draft approval and immediately before message dispatch

export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Strip spaces, dashes, parentheses
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

export function extractEmailDomain(email: string): string {
  const norm = normalizeEmail(email);
  const parts = norm.split('@');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Checks if a candidate email matches a suppressed entry.
 * Supports exact email matching as well as wildcard domain matching:
 * - exact: 'prospect@domain.com'
 * - domain prefix: '@domain.com'
 * - wildcard: '*@domain.com'
 * - plain domain: 'domain.com'
 * Also matches subdomains if the root domain is suppressed (e.g. @corp.com matches mail.corp.com).
 */
export function matchesEmailPattern(candidateEmail: string, suppressedPattern: string): boolean {
  const normCand = normalizeEmail(candidateEmail);
  const normPat = normalizeEmail(suppressedPattern);

  if (!normCand || !normPat) return false;

  // 1. Exact email match
  if (normCand === normPat) {
    return true;
  }

  const candidateDomain = extractEmailDomain(normCand);
  if (!candidateDomain) return false;

  // Extract the target domain from the suppression pattern
  let patternDomain = normPat;
  if (patternDomain.startsWith('*@')) {
    patternDomain = patternDomain.slice(2);
  } else if (patternDomain.startsWith('@')) {
    patternDomain = patternDomain.slice(1);
  }

  // If pattern didn't have @ or started with @/*@, check domain match
  if (!patternDomain.includes('@')) {
    if (candidateDomain === patternDomain || candidateDomain.endsWith(`.${patternDomain}`)) {
      return true;
    }
  }

  return false;
}

export interface SuppressionCheckResult {
  isSuppressed: boolean;
  reason?: string;
  source?: string;
  matchedPattern?: string;
}

export interface SuppressionRecord {
  normalized_email?: string | null;
  normalized_phone?: string | null;
  reason: string;
  source: string;
  organization_id?: string | null;
}

/**
 * Validates whether an email or phone is in the suppression list.
 * Can be run against a supplied suppression list array or database query result.
 * If organizationId is provided, matches entries scoped to that organization OR global entries (organization_id IS NULL).
 */
export function checkSuppression(
  identifier: { email?: string | null; phone?: string | null },
  suppressionRecords: SuppressionRecord[],
  organizationId?: string | null
): SuppressionCheckResult {
  const normEmail = identifier.email ? normalizeEmail(identifier.email) : null;
  const normPhone = identifier.phone ? normalizePhone(identifier.phone) : null;

  for (const entry of suppressionRecords) {
    // If entry is tenant-scoped and does not match the requested organization, skip it
    if (
      organizationId &&
      entry.organization_id &&
      entry.organization_id !== organizationId
    ) {
      continue;
    }

    if (normEmail && entry.normalized_email) {
      if (matchesEmailPattern(normEmail, entry.normalized_email)) {
        return {
          isSuppressed: true,
          reason: entry.reason,
          source: entry.source,
          matchedPattern: entry.normalized_email,
        };
      }
    }

    if (normPhone && entry.normalized_phone && normPhone === normalizePhone(entry.normalized_phone)) {
      return {
        isSuppressed: true,
        reason: entry.reason,
        source: entry.source,
        matchedPattern: entry.normalized_phone,
      };
    }
  }

  return { isSuppressed: false };
}
