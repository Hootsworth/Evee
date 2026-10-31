import { describe, it, expect } from 'vitest';
import { MockAiProvider } from '@/lib/providers/ai/mock';

describe('AI Email Draft Copy Optimization Engine', () => {
  const provider = new MockAiProvider();

  it('optimizes draft copy for conciseness while preserving dynamic tokens', async () => {
    const input = {
      subject: 'Quick question regarding {company_name}',
      bodyText:
        'I hope this email finds you well. My name is Alex and I wanted to reach out because we love what {company_name} is doing in {city}.\n\nWe provide high performance web optimization tools that can help your {company_type} scale revenue without added overhead.\n\nWould you be open to a 30-minute introductory call next Tuesday?',
      goal: 'concise' as const,
      businessContext: {
        name: 'Blue Bottle Coffee',
        category: 'Coffee Roastery',
        city: 'Bengaluru',
      },
    };

    const result = await provider.enhanceDraft(input);

    expect(result.improvedBody).toBeDefined();
    // Clichés removed
    expect(result.improvedBody).not.toContain('I hope this email finds you well');
    expect(result.improvedBody).not.toContain('I wanted to reach out because');
    // Dynamic tokens preserved
    expect(result.improvedBody).toContain('{company_name}');
    // Opt-out preserved/added
    expect(result.improvedBody.toLowerCase()).toContain('opt out');
    expect(result.changesSummary).toContain('mobile scanning');
    expect(result.keyImprovementTips?.length).toBeGreaterThan(0);
  });

  it('replaces high-friction meeting asks with low-friction permission CTAs', async () => {
    const input = {
      subject: 'Partnership with {company_name}',
      bodyText:
        'Hi {first_name},\n\nWe noticed your {company_type} website could use faster checkout flows.\n\nWould you be open to a 30-minute meeting next week to discuss this?',
      goal: 'cta' as const,
    };

    const result = await provider.enhanceDraft(input);

    expect(result.improvedBody).toContain('{first_name}');
    expect(result.improvedBody).not.toContain('30-minute meeting');
    expect(result.improvedBody.toLowerCase()).toMatch(/preview|video|quick/);
    expect(result.changesSummary).toContain('friction');
  });

  it('adapts draft tone to warm consultative peer-to-peer style', async () => {
    const input = {
      subject: 'Urgent Action Required for {company_name}',
      bodyText: 'You need to update your reservation system before the holiday surge.',
      goal: 'warmer' as const,
      businessContext: { name: 'Trattoria Bella' },
    };

    const result = await provider.enhanceDraft(input);

    expect(result.improvedSubject).not.toContain('Urgent');
    expect(result.improvedBody).toContain('Hi');
    expect(result.changesSummary).toContain('peer-to-peer');
  });
});
