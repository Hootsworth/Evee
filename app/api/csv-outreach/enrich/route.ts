// Evee - CSV Batch AI Company Enrichment Endpoint
// Dynamically classifies company types and crafts tailored copy adjustments

import { NextRequest, NextResponse } from 'next/server';
import {
  classifyProspectBatchWithAi,
  applyAiAnalysisToProspect,
} from '@/lib/csv/classifier';
import { CsvColumnMapping } from '@/lib/csv/parser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prospects, mapping } = body as {
      prospects: Array<Record<string, any>>;
      mapping?: CsvColumnMapping;
    };

    if (!Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({ error: 'No prospects provided.' }, { status: 400 });
    }

    const companyCol = mapping?.companyName || 'company_name';
    const websiteCol = mapping?.website || 'website';
    const cityCol = mapping?.city || 'city';

    // Format prospects for the AI batch classifier
    const formatted = prospects.map((p) => {
      const companyName =
        p[companyCol] ||
        p.company_name ||
        p.company ||
        p.business_name ||
        p.organization ||
        'Business';
      const website = p[websiteCol] || p.website || p.url || '';
      const city = p[cityCol] || p.city || p.location || '';

      return { companyName, website, city, raw: p };
    });

    // Run AI classification with fallback heuristics
    const analyses = await classifyProspectBatchWithAi(formatted);

    // Apply results back to the prospect records
    const enrichedProspects = prospects.map((prospect, idx) => {
      const analysis = analyses[idx];
      return applyAiAnalysisToProspect(prospect, analysis);
    });

    return NextResponse.json({
      success: true,
      count: enrichedProspects.length,
      enrichedProspects,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to enrich prospects with AI' },
      { status: 500 }
    );
  }
}
