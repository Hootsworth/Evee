// Evee - AI Email Draft Copy Optimization Endpoint
// Leverages active dynamic LLM (Meta Llama, Google Gemini, OpenAI) with smart fallback
import { NextRequest, NextResponse } from 'next/server';
import { getDynamicAiProvider } from '@/lib/providers/ai';
import { MockAiProvider } from '@/lib/providers/ai/mock';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, bodyText, goal, instruction, businessContext } = body;

    if (!bodyText || typeof bodyText !== 'string' || bodyText.trim().length === 0) {
      return NextResponse.json(
        { error: 'bodyText is required to perform copy enhancement' },
        { status: 400 }
      );
    }

    let result;
    try {
      const provider = await getDynamicAiProvider();
      if (provider.enhanceDraft) {
        result = await provider.enhanceDraft({
          subject: subject || '',
          bodyText,
          goal: goal || 'persuasive',
          instruction,
          businessContext,
        });
      }
    } catch (llmErr) {
      console.warn('Dynamic LLM provider call failed, falling back to smart copy optimizer:', llmErr);
    }

    if (!result) {
      const fallbackProvider = new MockAiProvider();
      result = await fallbackProvider.enhanceDraft({
        subject: subject || '',
        bodyText,
        goal: goal || 'persuasive',
        instruction,
        businessContext,
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Failed to enhance draft copy:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error while enhancing draft copy' },
      { status: 500 }
    );
  }
}
