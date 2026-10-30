// Evee - Suppression & Anti-Spam Compliance Checks
// Checks global suppression list before draft approval and immediately before message dispatch

export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Strip spaces, dashes, parentheses
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

export interface SuppressionCheckResult {
  isSuppressed: boolean;
  reason?: string;
  source?: string;
}

/**
 * Validates whether an email or phone is in the suppression list.
 * Can be run against a supplied suppression list array or database query result.
 */
export function checkSuppression(
  identifier: { email?: string | null; phone?: string | null },
  suppressionRecords: Array<{
    normalized_email?: string | null;
    normalized_phone?: string | null;
    reason: string;
    source: string;
  }>
): SuppressionCheckResult {
  const normEmail = identifier.email ? normalizeEmail(identifier.email) : null;
  const normPhone = identifier.phone ? normalizePhone(identifier.phone) : null;

  for (const entry of suppressionRecords) {
    if (normEmail && entry.normalized_email && normEmail === normalizeEmail(entry.normalized_email)) {
      return {
        isSuppressed: true,
        reason: entry.reason,
        source: entry.source,
      };
    }

    if (normPhone && entry.normalized_phone && normPhone === normalizePhone(entry.normalized_phone)) {
      return {
        isSuppressed: true,
        reason: entry.reason,
        source: entry.source,
      };
    }
  }

  return { isSuppressed: false };
}
