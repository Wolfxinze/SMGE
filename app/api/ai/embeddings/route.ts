import { generateEmbedding, generateEmbeddings } from '@/lib/ai/embeddings';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

      const validTexts = texts.filter(t => typeof t === 'string' && t.trim().length > 0);
      if (validTexts.length === 0) {
        return NextResponse.json(
          { error: 'At least one valid text is required' },
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