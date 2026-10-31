import { describe, it, expect } from 'vitest';
import {
  classifyCompanyHeuristic,
  applyAiAnalysisToProspect,
} from '@/lib/csv/classifier';
import { replaceTemplateVariables } from '@/lib/csv/parser';

describe('AI Company Type Classifier & Adjustment Engine', () => {
  it('correctly classifies a bakery business and generates tailored copy', () => {
    const analysis = classifyCompanyHeuristic('Artisan Bakes & Pastries', 'artisanbakes.in');
    expect(analysis.companyType).toContain('Bakery');
    expect(analysis.industry).toBe('Food & Hospitality');
    expect(analysis.painPoint).toContain('morning');
    expect(analysis.personalizedPitch).toContain('bakeries');
    expect(analysis.valueProp).toBeDefined();
  });

  it('correctly classifies a dental practice with patient-centric adjustments', () => {
    const analysis = classifyCompanyHeuristic('SmileCare Dental Clinic', 'smilecare.in');
    expect(analysis.companyType).toContain('Dental');
    expect(analysis.industry).toBe('Healthcare');
    expect(analysis.painPoint).toContain('recall');
    expect(analysis.personalizedPitch).toContain('dental');
  });

  it('correctly classifies a specialty cafe and roastery', () => {
    const analysis = classifyCompanyHeuristic('Urban Roast Cafe', 'urbanroast.in');
    expect(analysis.companyType).toContain('Cafe');
    expect(analysis.painPoint).toContain('rush');
    expect(analysis.personalizedPitch).toContain('cafes');
  });

  it('correctly classifies a tech / software company', () => {
    const analysis = classifyCompanyHeuristic('Apex Robotics AI', 'apexrobotics.ai');
    expect(analysis.companyType).toContain('Technology');
    expect(analysis.industry).toBe('Technology');
    expect(analysis.valueProp).toContain('lead qualification');
  });

  it('correctly replaces AI tokens in email templates', () => {
    const rawProspect = {
      email: 'sunita@artisanbakes.in',
      company_name: 'Artisan Bakes',
      first_name: 'Sunita',
      city: 'Bengaluru',
    };

    const analysis = classifyCompanyHeuristic(rawProspect.company_name);
    const enriched = applyAiAnalysisToProspect(rawProspect, analysis);

    const template = 'Hi {first_name}, regarding {company_name} in {city}. As a {company_type}, {personalized_pitch} We tackle {pain_point}.';
    const rendered = replaceTemplateVariables(template, enriched);

    expect(rendered).toContain('Hi Sunita');
    expect(rendered).toContain('Artisan Bakes');
    expect(rendered).toContain('Bengaluru');
    expect(rendered).toContain('Bakery');
    expect(rendered).toContain('bakeries');
  });

  it('guarantees graceful fallbacks so outreach never leaves blank placeholders', () => {
    const emptyProspect = {
      email: 'test@example.com',
    };

    const template = 'Hello {first_name}, your {company_type} can benefit from {value_prop}. {personalized_pitch}';
    const rendered = replaceTemplateVariables(template, emptyProspect);

    expect(rendered).not.toContain('{');
    expect(rendered).not.toContain('}');
    expect(rendered).toContain('Hello there');
    expect(rendered).toContain('growing business');
  });
});
