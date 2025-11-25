import { generateEmbedding, generateEmbeddings } from '@/lib/ai/embeddings';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

// OpenAI's token limit is 8191, keep character limit conservative
const MAX_TEXT_LENGTH = 8000;
const MAX_TEXTS_BATCH = 20; // Limit batch size to prevent abuse

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 10 requests per minute per user
    const rateLimit = await checkRateLimit(user.id, '/api/ai/embeddings', 10, 60000);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          limit: rateLimit.limit,
          reset: rateLimit.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toISOString(),
          },
        }
      );
    }

    const body = await request.json();
    const { text, texts } = body;

    // Handle single text
    if (text) {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Text must be a non-empty string' },
          { status: 400 }
        );
      }

      // Validate text length to prevent OpenAI API errors and excessive costs
      if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          {
            error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
            current: text.length,
            max: MAX_TEXT_LENGTH,
          },
          { status: 400 }
        );
      }

      const embedding = await generateEmbedding(text);
      return NextResponse.json({ embedding });
    }

    // Handle multiple texts
    if (texts) {
      if (!Array.isArray(texts)) {
        return NextResponse.json(
          { error: 'Texts must be an array' },
          { status: 400 }
        );
      }

      // Validate batch size to prevent abuse
      if (texts.length > MAX_TEXTS_BATCH) {
        return NextResponse.json(
          {
            error: `Batch size exceeds maximum of ${MAX_TEXTS_BATCH} texts`,
            current: texts.length,
            max: MAX_TEXTS_BATCH,
          },
          { status: 400 }
        );
      }

      const validTexts = texts.filter(t => typeof t === 'string' && t.trim().length > 0);
      if (validTexts.length === 0) {
        return NextResponse.json(
          { error: 'At least one valid text is required' },
          { status: 400 }
        );
      }

      // Validate each text length
      const tooLong = validTexts.find(t => t.length > MAX_TEXT_LENGTH);
      if (tooLong) {
        return NextResponse.json(
          {
            error: `One or more texts exceed maximum length of ${MAX_TEXT_LENGTH} characters`,
            max: MAX_TEXT_LENGTH,
          },
          { status: 400 }
        );
      }

      const embeddings = await generateEmbeddings(validTexts);
      return NextResponse.json({ embeddings });
    }

    return NextResponse.json(
      { error: 'Either text or texts parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    );
  }
}