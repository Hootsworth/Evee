// Evee - Mock AI Provider
// Generates grounded, evidence-backed research results and personalized drafts

import {
  ResearchProvider,
  DraftProvider,
  EmailDraftOutput,
  EnhanceDraftInput,
  EnhanceDraftOutput,
} from './interface';
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

  async enhanceDraft(input: EnhanceDraftInput): Promise<EnhanceDraftOutput> {
    const goal = input.goal || 'persuasive';
    let subject = input.subject || 'Quick question regarding your workflow';
    let body = input.bodyText || '';

    // Remove corporate pleasantries and throat-clearing
    body = body
      .replace(/I hope this email finds you well[,.]?\s*/gi, '')
      .replace(/Hope all is well with you[,.]?\s*/gi, '')
      .replace(/I wanted to reach out because\s*/gi, '')
      .replace(/My name is .*? and I am reaching out to\s*/gi, '')
      .replace(/Just following up to see\s*/gi, 'Following up to see');

    let summary = '';
    const tips: string[] = [];

    if (goal === 'concise') {
      // Split into sentences, keep only core punchy ones
      const sentences = body
        .split(/(?<=[.?!])\s+/)
        .filter((s) => s.trim().length > 0);
      
      const coreSentences = sentences.slice(0, Math.min(sentences.length, 4));
      body = coreSentences.join('\n\n');

      if (!body.includes('unsubscribe') && !body.includes('opt out')) {
        body += "\n\nReply 'unsubscribe' to opt out.";
      }

      subject = subject.replace(/^(Quick question regarding|Following up on)\s*/i, '').trim();
      if (!subject.startsWith('Note regarding') && !subject.startsWith('Question for')) {
        subject = `Note: ${subject}`;
      }

      summary = 'Trimmed introductory filler, restructured into 1-sentence paragraphs for mobile scanning.';
      tips.push('Cut length by ~30% to maximize reading completion on mobile.');
      tips.push('Removed generic introductory pleasantries.');
    } else if (goal === 'cta') {
      // Replace aggressive or high friction asks with frictionless CTA
      body = body.replace(
        /(Would you be open to a (?:brief |quick )?(?:15|20|30|45)-minute (?:call|chat|meeting|demo)\??.*$)/gim,
        'Open to a quick 3-minute video breakdown of how this works, or should I leave you in peace?'
      );

      if (!body.includes('3-minute video') && !body.includes('quick question')) {
        const parts = body.split('\n\n');
        parts.splice(Math.max(parts.length - 2, 1), 0, 'Open to taking a look at a 2-minute preview, or not a priority right now?');
        body = parts.join('\n\n');
      }

      summary = 'Replaced high-commitment calendar pitch with a zero-friction permission ask.';
      tips.push('Lowered friction by offering a 2-3 minute preview instead of a meeting.');
      tips.push('Added polite out-clause to increase reply probability.');
    } else if (goal === 'warmer') {
      if (!body.startsWith('Hi {first_name}') && !body.startsWith('Hi there')) {
        body = `Hi {first_name},\n\n${body}`;
      }
      subject = subject.replace(/Exclusive Offer|Action Required|Urgent/gi, 'Ideas for');
      summary = 'Softened tone to peer-to-peer advisory style, emphasizing shared context.';
      tips.push('Shifted posture from outbound seller to helpful industry peer.');
    } else if (goal === 'punchy') {
      body = body
        .replace(/We are able to assist/gi, 'We help')
        .replace(/In order to facilitate/gi, 'To enable')
        .replace(/It would be great if we could/gi, 'Can we');
      summary = 'Converted passive constructions to direct active voice and tightened phrasing.';
      tips.push('Replaced corporate terminology with crisp conversational phrasing.');
    } else {
      // Persuasive / default
      if (!subject.toLowerCase().includes('idea') && !subject.toLowerCase().includes('question')) {
        subject = `Idea for ${input.businessContext?.name || '{company_name}'}`;
      }
      summary = 'Sharpened the opening hook and framed the core benefit around quantifiable outcomes.';
      tips.push('Hook focused on immediate operational upside.');
      tips.push('Preserved all dynamic personalization variables.');
    }

    if (input.instruction) {
      summary += ` Applied custom instruction: "${input.instruction}".`;
    }

    return {
      improvedSubject: subject.trim(),
      improvedBody: body.trim(),
      changesSummary: summary,
      keyImprovementTips: tips,
      modelUsed: 'Evee Copy Engine // Conversational Optimizer',
    };
  }
}
