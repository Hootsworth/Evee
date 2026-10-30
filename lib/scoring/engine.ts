// Evee - Deterministic, Explainable Lead Scoring Engine
// Aligned with ARCHITECTURE.MD Part F Section 13

import { Business, EvidenceItem, Contact, LeadScore } from '@/lib/types';

export interface ScoreInput {
  business: Business;
  evidence: EvidenceItem[];
  contact?: Contact | null;
  servicesPromoted: string[];
  isSuppressed?: boolean;
}

export interface ScoreResult {
  fitScore: number;          // Max 30
  needScore: number;         // Max 35
  contactabilityScore: number;// Max 15
  serviceMatchScore: number; // Max 20
  evidenceConfidence: number;// 0.0 to 1.0
  finalScore: number;        // Max 100 (subject to caps)
  reasonCodes: string[];
  isDisqualified: boolean;
  qualificationStatus: 'qualified' | 'disqualified' | 'review_required';
}

export function calculateLeadScore(input: ScoreInput, qualificationThreshold = 65): ScoreResult {
  const reasonCodes: string[] = [];
  let isDisqualified = false;

  // 1. Check contact eligibility and suppression
  if (input.isSuppressed) {
    reasonCodes.push('CONTACT_SUPPRESSED');
    isDisqualified = true;
  }

  if (input.contact?.contact_eligibility === 'ineligible') {
    reasonCodes.push('CONTACT_INELIGIBLE');
    isDisqualified = true;
  }

  // 2. Business Fit Score (Max 30)
  // Factors: Business presence, clear category, valid location, active operations
  let fitScore = 10; // Baseline for discovered business

  if (input.business.canonical_domain || input.business.official_website_url) {
    fitScore += 10;
  }

  if (input.business.city && input.business.business_type) {
    fitScore += 10;
  }

  if (fitScore >= 25) {
    reasonCodes.push('HIGH_BUSINESS_FIT');
  }

  // 3. Evidence of Addressable Problem / Need (Max 35)
  // Evaluates inspected evidence items (broken booking links, missing menus, missing mobile view, etc.)
  let needScore = 0;
  const verifiedEvidence = input.evidence.filter((e) => e.verification_status === 'verified');
  const uncertainEvidence = input.evidence.filter((e) => e.verification_status === 'uncertain');

  let hasHighConfidenceProblem = false;

  for (const item of input.evidence) {
    const finding = item.finding_type.toUpperCase();
    if (finding.includes('MENU') && (finding.includes('MISSING') || finding.includes('NO_MENU'))) {
      needScore += 15;
      reasonCodes.push('NO_MENU_FOUND_ON_INSPECTED_PAGES');
      hasHighConfidenceProblem = true;
    } else if (finding.includes('BOOKING') && (finding.includes('BROKEN') || finding.includes('FAILED') || finding.includes('MISSING') || finding.includes('INCOMPLETE'))) {
      needScore += 15;
      reasonCodes.push('BOOKING_LINK_FAILED');
      hasHighConfidenceProblem = true;
    } else if (finding.includes('MOBILE') || finding.includes('RESPONSIVE')) {
      needScore += 10;
      reasonCodes.push('MOBILE_LAYOUT_ISSUE_CONFIRMED');
      hasHighConfidenceProblem = true;
    } else if (finding.includes('ENQUIRY') || finding.includes('ORDERING') || finding.includes('SUPPORT')) {
      needScore += 10;
      reasonCodes.push('AUTOMATION_OPPORTUNITY_OBSERVED');
      hasHighConfidenceProblem = true;
    } else {
      needScore += 5;
    }
  }

  needScore = Math.min(needScore, 35);

  // 4. Contactability Score (Max 15)
  let contactabilityScore = 0;
  if (input.contact) {
    if (input.contact.email_address) {
      contactabilityScore += 8;
      if (input.contact.verification_status === 'syntax_valid' || input.contact.verification_status === 'provider_verified') {
        contactabilityScore += 4;
      }
    }
    if (input.contact.contact_name) {
      contactabilityScore += 3;
    }
  } else if (input.business.general_business_email) {
    contactabilityScore += 8;
  }

  if (input.business.public_business_phone) {
    contactabilityScore = Math.min(contactabilityScore + 2, 15);
  }

  if (contactabilityScore < 5) {
    reasonCodes.push('CONTACT_SOURCE_UNVERIFIED');
  }

  // 5. Service Match Score (Max 20)
  let serviceMatchScore = 0;
  const promotedLower = input.servicesPromoted.map((s) => s.toLowerCase());

  if (promotedLower.some((s) => s.includes('menu')) && reasonCodes.includes('NO_MENU_FOUND_ON_INSPECTED_PAGES')) {
    serviceMatchScore += 10;
  }
  if (promotedLower.some((s) => s.includes('booking') || s.includes('enquiry')) && reasonCodes.includes('BOOKING_LINK_FAILED')) {
    serviceMatchScore += 10;
  }
  if (promotedLower.some((s) => s.includes('website') || s.includes('mobile')) && reasonCodes.includes('MOBILE_LAYOUT_ISSUE_CONFIRMED')) {
    serviceMatchScore += 10;
  }
  if (promotedLower.some((s) => s.includes('automation') || s.includes('support')) && reasonCodes.includes('AUTOMATION_OPPORTUNITY_OBSERVED')) {
    serviceMatchScore += 10;
  }

  // Fallback service match if services are offered
  if (serviceMatchScore === 0 && input.servicesPromoted.length > 0 && needScore > 0) {
    serviceMatchScore = 10;
  }
  serviceMatchScore = Math.min(serviceMatchScore, 20);

  if (serviceMatchScore >= 15) {
    reasonCodes.push('STRONG_SERVICE_MATCH');
  }

  // Calculate composite confidence
  const evidenceConfidence =
    input.evidence.length > 0
      ? input.evidence.reduce((acc, curr) => acc + curr.confidence, 0) / input.evidence.length
      : 0.5;

  let rawTotal = fitScore + needScore + contactabilityScore + serviceMatchScore;

  // 6. Apply Mandatory Evidence-Quality Caps (Architecture Section 13)
  // - Unverified business identity: maximum score 30
  if (input.business.identity_confidence < 0.6) {
    rawTotal = Math.min(rawTotal, 30);
    reasonCodes.push('LOW_IDENTITY_CONFIDENCE_CAP');
  }

  // - No evidence for the claimed problem: maximum score 40
  if (!hasHighConfidenceProblem && needScore === 0) {
    rawTotal = Math.min(rawTotal, 40);
    reasonCodes.push('NO_PROBLEM_EVIDENCE_CAP');
  }

  // - Stale or low-confidence evidence: maximum score 60
  if (evidenceConfidence < 0.6 || uncertainEvidence.length > verifiedEvidence.length) {
    rawTotal = Math.min(rawTotal, 60);
    reasonCodes.push('EVIDENCE_UNCERTAIN_CAP');
  }

  const finalScore = Math.min(Math.max(rawTotal, 0), 100);

  let qualificationStatus: 'qualified' | 'disqualified' | 'review_required';
  if (isDisqualified) {
    qualificationStatus = 'disqualified';
  } else if (finalScore >= qualificationThreshold) {
    qualificationStatus = 'qualified';
    reasonCodes.push('QUALIFIED_LEAD');
  } else if (finalScore >= 50 || uncertainEvidence.length > 0) {
    qualificationStatus = 'review_required';
  } else {
    qualificationStatus = 'disqualified';
  }

  return {
    fitScore,
    needScore,
    contactabilityScore,
    serviceMatchScore,
    evidenceConfidence,
    finalScore,
    reasonCodes: Array.from(new Set(reasonCodes)),
    isDisqualified,
    qualificationStatus,
  };
}
