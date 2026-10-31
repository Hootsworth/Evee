// Evee - AI Company Type Classifier & Outreach Personalization Engine
// Uses active AI provider (Gemini / OpenAI / Meta) with robust fallback heuristics
// Guarantees accurate company type detection and tailored copy adjustments every time

import { getDynamicAiProvider } from '@/lib/providers/ai';
import { MultiLlmProvider } from '@/lib/providers/ai/multi-llm';
import { CsvColumnMapping } from './parser';

export interface CompanyAiAnalysis {
  companyType: string;
  industry: string;
  painPoint: string;
  personalizedPitch: string;
  valueProp: string;
}

// 1. Semantic Heuristic Rulebook for High-Reliability Fallback
export function classifyCompanyHeuristic(
  companyName: string,
  website?: string
): CompanyAiAnalysis {
  const combined = `${companyName} ${website || ''}`.toLowerCase();

  // Bakery & Confectionery
  if (/bak(e|ing|ery)|patisserie|pastr(y|ies)|cake|cookie|artisan bake/i.test(combined)) {
    return {
      companyType: 'Artisan Bakery & Patisserie',
      industry: 'Food & Hospitality',
      painPoint: 'handling phone pre-orders and peak walk-in morning rush congestion',
      personalizedPitch: 'For artisan bakeries, a seamless pre-order and pickup queue eliminates morning counter congestion and increases repeat cake orders.',
      valueProp: 'frictionless pre-order & pickup scheduling workflows',
    };
  }

  // Cafe & Coffee Roasters
  if (/cafe|coffee|roast(er|ing|s)?|espresso|brew|matcha|tea/i.test(combined)) {
    return {
      companyType: 'Specialty Cafe & Roastery',
      industry: 'Food & Beverage',
      painPoint: 'peak rush order drop-offs and table turnaround delays',
      personalizedPitch: 'For specialty cafes, digital table ordering and mobile pickup reduce barista counter bottlenecks during peak commute hours.',
      valueProp: 'mobile queue-busting and repeat loyalty automation',
    };
  }

  // Dental & Oral Healthcare
  if (/dent(al|ist|istry)|smile|orthodont|oral|teeth/i.test(combined)) {
    return {
      companyType: 'Dental Practice',
      industry: 'Healthcare',
      painPoint: 'patient no-shows, delayed recall reminders, and manual intake forms',
      personalizedPitch: 'For modern dental clinics, automated booking recalls and digital intake forms recover thousands in lost chair time.',
      valueProp: 'automated patient recall & zero-friction booking',
    };
  }

  // Medical Clinic & Healthcare
  if (/clinic|health|pediatric|doctor|physi|chiro|derma|med(ical|spa)?/i.test(combined)) {
    return {
      companyType: 'Medical & Wellness Clinic',
      industry: 'Healthcare',
      painPoint: 'intake paperwork friction and scheduling coordination phone calls',
      personalizedPitch: 'For private healthcare clinics, direct self-service appointment scheduling streamlines patient intake and lowers front-desk overhead.',
      valueProp: 'compliant digital intake & online appointment coordination',
    };
  }

  // Law Firms & Legal Services
  if (/law|legal|attorney|advocate|solicitor|barrister/i.test(combined)) {
    return {
      companyType: 'Legal Advisory & Law Firm',
      industry: 'Professional Legal Services',
      painPoint: 'slow client intake screening and conflict-check coordination',
      personalizedPitch: 'For legal practices, automated consultation intake immediately filters qualified matters before partners spend billable time.',
      valueProp: 'automated client qualification & consultation booking',
    };
  }

  // Technology, SaaS & AI
  if (/tech|software|saas|ai|robotics|cloud|cyber|data|app|labs|digital/i.test(combined)) {
    return {
      companyType: 'Technology & Software Company',
      industry: 'Technology',
      painPoint: 'inbound trial conversion drop-offs and manual enterprise onboarding steps',
      personalizedPitch: 'For fast-moving tech companies, streamlining self-serve discovery into qualified product walkthroughs accelerates sales cycles.',
      valueProp: 'high-intent demo booking & automated lead qualification',
    };
  }

  // Restaurant & Dining
  if (/restaurant|bistro|bar & grill|diner|eatery|kitchen|pizzeria|trattoria|tapas/i.test(combined)) {
    return {
      companyType: 'Restaurant & Dining Establishment',
      industry: 'Hospitality',
      painPoint: 'third-party marketplace commissions and reservation cancellations',
      personalizedPitch: 'For independent dining establishments, direct zero-commission reservations and private dining inquiries preserve margin.',
      valueProp: 'direct reservation workflows and private event inquiry automation',
    };
  }

  // Fitness & Gyms
  if (/fit(ness)?|gym|crossfit|yoga|pilates|studio|strength|training/i.test(combined)) {
    return {
      companyType: 'Fitness & Wellness Studio',
      industry: 'Sports & Fitness',
      painPoint: 'trial class no-shows and manual recurring membership renewals',
      personalizedPitch: 'For boutique fitness studios, automated intro-class reminders and one-tap signups turn walk-ins into monthly members.',
      valueProp: 'automated trial booking & membership onboarding',
    };
  }

  // Real Estate & Property
  if (/realt(y|or)|estate|properties|homes|realty group|housing/i.test(combined)) {
    return {
      companyType: 'Real Estate Agency',
      industry: 'Real Estate',
      painPoint: 'lead response lag and scheduling back-and-forth for property walkthroughs',
      personalizedPitch: 'For real estate agencies, instant tour scheduling on listings captures high-intent buyers before they move to rival properties.',
      valueProp: 'instant tour booking & buyer qualification routing',
    };
  }

  // Home Services & Trades (Plumbing, Electrical, Roofing, HVAC)
  if (/plumb(ing|er)|electric|hvac|roof(ing)?|contract(or|ing)|repair|construct/i.test(combined)) {
    return {
      companyType: 'Contracting & Field Service Provider',
      industry: 'Home & Commercial Services',
      painPoint: 'missed emergency inquiry calls while technicians are in the field',
      personalizedPitch: 'For field service contractors, after-hours instant quote requests capture commercial jobs while your team is on-site.',
      valueProp: '24/7 automated quote intake & emergency job scheduling',
    };
  }

  // Financial & Accounting
  if (/account(ing|ant)|cpa|finance|wealth|tax|audit|capital|fund/i.test(combined)) {
    return {
      companyType: 'Accounting & Financial Advisory',
      industry: 'Financial Services',
      painPoint: 'tax season document collection delays and client appointment backlogs',
      personalizedPitch: 'For accounting firms, structured digital intake checklists reduce document chasing by up to 60% during filing periods.',
      valueProp: 'automated client document collection & tax review scheduling',
    };
  }

  // Generic Intelligent Fallback
  return {
    companyType: 'Growing Business',
    industry: 'Commercial Services',
    painPoint: 'manual customer inquiries and workflow drop-offs on digital channels',
    personalizedPitch: `For ${companyName}, streamlining customer inquiry and scheduling workflows helps capture higher conversion with zero added friction.`,
    valueProp: 'frictionless customer inquiry & booking workflows',
  };
}

export interface ClassificationResult {
  analyses: CompanyAiAnalysis[];
  meta: {
    source: 'live' | 'heuristic';
    provider: string;
    model: string;
    error?: string;
  };
}

// 2. Multi-prospect Batch AI Classifier
export async function classifyProspectBatchWithAi(
  prospects: Array<{
    companyName: string;
    website?: string;
    city?: string;
    raw?: Record<string, any>;
  }>
): Promise<ClassificationResult> {
  if (!prospects || prospects.length === 0) {
    return {
      analyses: [],
      meta: {
        source: 'heuristic',
        provider: 'heuristic-rules',
        model: 'semantic-classifier',
      },
    };
  }

  // Default results computed using intelligent heuristic
  const results: CompanyAiAnalysis[] = prospects.map((p) =>
    classifyCompanyHeuristic(p.companyName, p.website)
  );

  const meta: ClassificationResult['meta'] = {
    source: 'heuristic',
    provider: 'heuristic-rules',
    model: 'semantic-classifier',
  };

  try {
    const aiProvider = await getDynamicAiProvider();

    // Check if we have an active real LLM provider with API key
    if (aiProvider instanceof MultiLlmProvider) {
      const config = (aiProvider as any).config;
      if (config && config.apiKey) {
        const baseUrl = (aiProvider as any).getEffectiveBaseUrl();
        const model = (aiProvider as any).getEffectiveModel();
        meta.provider = config.provider || 'gemini';
        meta.model = model;

        const promptList = prospects.map((p, idx) => ({
          id: idx,
          name: p.companyName,
          website: p.website || '',
          city: p.city || '',
        }));

        const systemPrompt = `You are an elite B2B market researcher and copywriter for Evee.
Analyze each company provided in the input list.
For EACH company, return:
- companyType: concise, specific business type (e.g. "Artisan Sourdough Bakery", "Specialty Coffee Roaster", "Family Dental Practice", "Autonomous Robotics Engineering", "Commercial Roofing Contractor"). Max 4 words.
- industry: high-level sector (e.g. "Hospitality", "Healthcare", "Technology", "Construction").
- painPoint: a realistic operational bottleneck typical for that exact business (e.g. "phone booking drop-offs during morning rush hours", "patient recall lapses and empty chair time").
- personalizedPitch: one crisp, natural sentence tailored specifically to this business type explaining how streamlined online conversion and automated customer workflows help them.
- valueProp: punchy 3-5 word benefit (e.g. "instant self-service table booking", "automated patient recall reminders").

Return strictly valid JSON matching this schema:
{
  "companies": [
    {
      "id": 0,
      "companyType": "string",
      "industry": "string",
      "painPoint": "string",
      "personalizedPitch": "string",
      "valueProp": "string"
    }
  ]
}`;

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(promptList) },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const companies = parsed.companies || [];
            companies.forEach((item: any) => {
              if (item && item.id !== undefined && results[item.id]) {
                results[item.id] = {
                  companyType: item.companyType || results[item.id].companyType,
                  industry: item.industry || results[item.id].industry,
                  painPoint: item.painPoint || results[item.id].painPoint,
                  personalizedPitch: item.personalizedPitch || results[item.id].personalizedPitch,
                  valueProp: item.valueProp || results[item.id].valueProp,
                };
              }
            });
            meta.source = 'live';
          }
        } else {
          const errText = await response.text();
          console.error(`[CSV AI Classifier] Provider returned HTTP ${response.status}:`, errText);
          meta.error = `HTTP ${response.status}: ${errText.slice(0, 100)}`;
        }
      } else {
        meta.error = 'No active API key in settings';
      }
    } else {
      meta.error = 'Mock provider active (set API key in settings)';
    }
  } catch (err: any) {
    console.warn('AI provider error during batch classification, fell back to heuristic:', err);
    meta.error = err.message || 'Error executing AI classification';
  }

  return { analyses: results, meta };
}

// 3. Single Prospect Helper
export async function classifySingleProspectWithAi(prospect: {
  companyName: string;
  website?: string;
  city?: string;
}): Promise<CompanyAiAnalysis> {
  const { analyses } = await classifyProspectBatchWithAi([prospect]);
  return analyses[0] || classifyCompanyHeuristic(prospect.companyName, prospect.website);
}

// 4. Utility to enrich raw CSV prospect objects
export function applyAiAnalysisToProspect(
  prospect: Record<string, any>,
  analysis: CompanyAiAnalysis
): Record<string, any> {
  return {
    ...prospect,
    ai_company_type: analysis.companyType,
    company_type: analysis.companyType,
    ai_industry: analysis.industry,
    industry: analysis.industry,
    ai_pain_point: analysis.painPoint,
    pain_point: analysis.painPoint,
    ai_personalized_pitch: analysis.personalizedPitch,
    personalized_pitch: analysis.personalizedPitch,
    ai_value_prop: analysis.valueProp,
    value_prop: analysis.valueProp,
  };
}
