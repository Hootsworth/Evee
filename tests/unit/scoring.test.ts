import { describe, it, expect } from 'vitest';
import { calculateLeadScore } from '@/lib/scoring/engine';
import { Business, EvidenceItem, Contact } from '@/lib/types';

describe('Lead Scoring Engine', () => {
  const mockBusiness: Business = {
    id: 'biz-1',
    normalized_name: 'artisan cafe',
    display_name: 'Artisan Cafe',
    business_type: 'Cafe',
    description: null,
    country_code: 'IN',
    region: 'Karnataka',
    city: 'Bengaluru',
    postal_code: '560038',
    official_website_url: 'https://artisancafe.example.com',
    canonical_domain: 'artisancafe.example.com',
    public_business_phone: '+919876543210',
    general_business_email: 'hello@artisancafe.example.com',
    identity_confidence: 1.0,
    record_status: 'active',
    last_verified_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockEvidence: EvidenceItem[] = [
    {
      id: 'ev-1',
      business_id: 'biz-1',
      research_run_id: null,
      source_url: 'https://artisancafe.example.com',
      source_type: 'website_inspection',
      observed_at: new Date().toISOString(),
      finding_type: 'NO_MENU_FOUND_ON_INSPECTED_PAGES',
      claim_text: 'No interactive digital menu discovered',
      supporting_excerpt: null,
      confidence: 0.95,
      verification_status: 'verified',
      expires_at: null,
      retention_policy_id: 'default',
      metadata: {},
    },
  ];

  const mockContact: Contact = {
    id: 'cont-1',
    business_id: 'biz-1',
    contact_name: 'Owner',
    job_title: 'Manager',
    email_address: 'hello@artisancafe.example.com',
    email_normalized: 'hello@artisancafe.example.com',
    contact_channel: 'email',
    contact_source_url: null,
    contact_type: 'general_business',
    verification_status: 'syntax_valid',
    contact_eligibility: 'eligible',
    consent_status: 'unknown',
    last_verified_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('qualifies a business with high fit, verified evidence, and valid contact', () => {
    const result = calculateLeadScore({
      business: mockBusiness,
      evidence: mockEvidence,
      contact: mockContact,
      servicesPromoted: ['Digital QR Menu', 'Online Ordering'],
    });

    expect(result.finalScore).toBeGreaterThanOrEqual(65);
    expect(result.qualificationStatus).toBe('qualified');
    expect(result.reasonCodes).toContain('NO_MENU_FOUND_ON_INSPECTED_PAGES');
    expect(result.reasonCodes).toContain('QUALIFIED_LEAD');
  });

  it('applies identity confidence cap if business identity is uncertain', () => {
    const lowConfidenceBiz = { ...mockBusiness, identity_confidence: 0.4 };
    const result = calculateLeadScore({
      business: lowConfidenceBiz,
      evidence: mockEvidence,
      contact: mockContact,
      servicesPromoted: ['Digital QR Menu'],
    });

    expect(result.finalScore).toBeLessThanOrEqual(30);
    expect(result.reasonCodes).toContain('LOW_IDENTITY_CONFIDENCE_CAP');
  });

  it('disqualifies suppressed contacts immediately regardless of score', () => {
    const result = calculateLeadScore({
      business: mockBusiness,
      evidence: mockEvidence,
      contact: mockContact,
      servicesPromoted: ['Digital QR Menu'],
      isSuppressed: true,
    });

    expect(result.isDisqualified).toBe(true);
    expect(result.qualificationStatus).toBe('disqualified');
    expect(result.reasonCodes).toContain('CONTACT_SUPPRESSED');
  });
});
