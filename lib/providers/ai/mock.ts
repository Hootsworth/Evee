// Evee - Mock AI Provider
// Generates grounded, evidence-backed research results and personalized drafts

import { ResearchProvider, DraftProvider, EmailDraftOutput } from './interface';
import { EvidenceItem, ResearchResult } from '@/lib/types';

export class MockAiProvider implements ResearchProvider, DraftProvider {
  name = 'mock-ai';

  async analyzeBusiness(
    businessContext: { name: string; category?: string; websiteUrl?: string; city?: string },
    evidence: EvidenceItem[],
    services: string[]
  ): Promise<ResearchResult> {
    const opportunities = [];

    // Check for menu opportunities
    const menuEvidence = evidence.filter((e) => e.finding_type.toLowerCase().includes('menu'));
    if (menuEvidence.length > 0 && services.some((s) => s.toLowerCase().includes('menu'))) {
      opportunities.push({
        serviceId: 'digital-qr-menu',
        serviceName: 'Digital & QR Menu System',
        findingIds: menuEvidence.map((e) => e.id),
        businessBenefit: 'Increases order speed and lets staff update daily specials in real time.',
        confidence: 0.95,
        reasoningSummary: 'Inspected public pages lacked a responsive digital menu format.',
      });
    }

    // Check for booking/ordering opportunities
    const bookingEvidence = evidence.filter((e) => e.finding_type.toLowerCase().includes('booking') || e.finding_type.toLowerCase().includes('order'));
    if (bookingEvidence.length > 0 && services.some((s) => s.toLowerCase().includes('book') || s.toLowerCase().includes('order') || s.toLowerCase().includes('enquiry'))) {
      opportunities.push({
        serviceId: 'online-booking-workflow',
        serviceName: 'Online Booking & Enquiry Workflow',
        findingIds: bookingEvidence.map((e) => e.id),
        businessBenefit: 'Captures after-hours inquiries automatically without manual phone follow-up.',
        confidence: 0.9,
        reasoningSummary: 'No direct booking interface or active calendar was discovered on inspected pages.',
      });
    }

    // Default mobile optimization opportunity if mobile issues noted
    const mobileEvidence = evidence.filter((e) => e.finding_type.toLowerCase().includes('mobile') || e.finding_type.toLowerCase().includes('layout'));
    if (mobileEvidence.length > 0) {
      opportunities.push({
        serviceId: 'mobile-web-optimization',
        serviceName: 'Mobile-Optimized Fast Web Presence',
        findingIds: mobileEvidence.map((e) => e.id),
        businessBenefit: 'Prevents customer drop-off on smartphones and improves local search visibility.',
        confidence: 0.88,
        reasoningSummary: 'Identified viewport layout issues on standard mobile resolutions.',
      });
    }

    // If no specific evidence matched, provide a general support/FAQ automation opportunity
    if (opportunities.length === 0 && evidence.length > 0) {
      opportunities.push({
        serviceId: 'ai-faq-support',
        serviceName: 'AI Customer FAQ & Inquiry Assistant',
        findingIds: [evidence[0].id],
        businessBenefit: 'Answers frequent customer questions instantly on web and WhatsApp.',
        confidence: 0.8,
        reasoningSummary: 'Observed standard contact email without interactive inquiry workflow.',
      });
    }

    return {
      businessSummary: `${businessContext.name} operates in ${businessContext.city || 'the region'} within the ${businessContext.category || 'local services'} category.`,
      opportunities,
      unsupportedClaims: [],
      needsHumanReview: opportunities.length === 0,
    };
  }

  async createEmailDraft(
    businessContext: { name: string; category?: string; city?: string },
    verifiedFindings: EvidenceItem[],
    serviceMatch: string,
    styleConfig?: { tone?: string; language?: string }
  ): Promise<EmailDraftOutput> {
    const finding = verifiedFindings[0];
    const observationText = finding
      ? finding.claim_text
      : `your digital presence for ${businessContext.name}`;

    const subject = `Quick observation regarding ${businessContext.name}'s online setup`;

    const bodyText = `Hi there,\n\nI was looking at ${businessContext.name} in ${businessContext.city || 'your area'} and noticed ${observationText}.\n\nWe recently helped similar ${businessContext.category || 'local businesses'} address this with a streamlined ${serviceMatch}, which helps capture more direct customer inquiries without extra staff overhead.\n\nWould you be open to a brief 5-minute conversation or a quick preview next week?\n\nBest regards,\nEvee Team\n\nTo opt out of future emails, reply with 'unsubscribe'.`;

    return {
      subject,
      bodyText,
      evidenceIds: verifiedFindings.map((f) => f.id),
      personalizationSummary: `Referenced verified observation: "${observationText}" tied to ${serviceMatch}.`,
    };
  }
}
