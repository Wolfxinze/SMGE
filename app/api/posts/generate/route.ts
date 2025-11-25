import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/posts/generate
 *
 * Generates AI-powered social media content using Brand Brain for consistency.
 * Integrates with n8n workflow for advanced content generation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 20 post generations per minute
    const rateLimit = await checkRateLimit(user.id, '/api/posts/generate', 20, 60000);

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
    const {
      brand_id,
      topic,
      platform,
      content_type = 'post',
      tone,
      max_length,
      include_hashtags = true,
      include_call_to_action = false,
      reference_content_ids = [],
    } = body;

    // Validate required fields
    if (!brand_id || !topic || !platform) {
      return NextResponse.json(
        { error: 'brand_id, topic, and platform are required' },
        { status: 400 }
      );
    }

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, user_id')
      .eq('id', brand_id)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 404 }
      );
    }

    // Get brand voice for consistent tone
    const { data: brandVoice } = await supabase
      .from('brand_voice')
      .select('tone, writing_style, keywords, avoid_phrases, brand_values')
      .eq('brand_id', brand_id)
      .single();

    // Get reference content if specified
    let referenceContent: any[] = [];
    if (reference_content_ids.length > 0) {
      const { data: examples } = await supabase
        .from('brand_content_examples')
        .select('content, platform')
        .eq('brand_id', brand_id)
        .in('id', reference_content_ids);

      referenceContent = examples || [];
    }

    // Build generation context
    const generationContext = {
      brand: {
        name: (brand as any).name,
        voice: brandVoice || {},
      },
      request: {
        topic,
        platform,
        content_type,
        tone: tone || ((brandVoice as any)?.tone ? (brandVoice as any).tone[0] : 'professional'),
        max_length,
        include_hashtags,
        include_call_to_action,
      },
      reference_content: referenceContent,
    };

    // TODO: Call n8n workflow for advanced generation
    // For MVP, use simple AI generation
    const generatedContent = await generateContentWithAI(generationContext);

    // Create draft post
    const { data: post, error: postError } = await (supabase
      .from('posts') as any)
      .insert({
        brand_id,
        user_id: user.id,
        content: generatedContent.text,
        content_type,
        platform,
        generation_prompt: topic,
        ai_model: generatedContent.model,
        generation_params: generationContext,
        status: 'draft',
      })
      .select()
      .single();

    if (postError) {
      console.error('Failed to create post:', postError);
      return NextResponse.json(
        { error: 'Failed to save generated post' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      post,
      metadata: {
        generated_at: new Date().toISOString(),
        model: generatedContent.model,
        tokens_used: generatedContent.tokens,
      },
    });
  } catch (error) {
    console.error('Post generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate post' },
      { status: 500 }
    );
  }
}

/**
 * Generate content using AI with Brand Brain context
 */
async function generateContentWithAI(context: any) {
  // Extract generation parameters
  const { brand, request, reference_content } = context;
  const { topic, platform, tone, max_length, include_hashtags, include_call_to_action } = request;

  // Build system prompt with brand voice
  const systemPrompt = `You are a social media content creator for ${brand.name}.

Brand Voice Guidelines:
${brand.voice.tone ? `- Tone: ${brand.voice.tone.join(', ')}` : ''}
${brand.voice.writing_style ? `- Style: ${brand.voice.writing_style.join(', ')}` : ''}
${brand.voice.keywords ? `- Key themes: ${brand.voice.keywords.join(', ')}` : ''}
${brand.voice.avoid_phrases ? `- Avoid: ${brand.voice.avoid_phrases.join(', ')}` : ''}
${brand.voice.brand_values ? `- Values: ${brand.voice.brand_values.join(', ')}` : ''}

Platform: ${platform}
Content Type: ${request.content_type}
Tone: ${tone}
${max_length ? `Max length: ${max_length} characters` : ''}

${reference_content.length > 0 ? `Reference Examples:\n${reference_content.map((c: any) => `- ${c.content}`).join('\n')}` : ''}

Create engaging ${platform} content that matches the brand voice and resonates with the audience.`;

  // Build user prompt
  const userPrompt = `Create a ${request.content_type} about: ${topic}

${include_hashtags ? 'Include relevant hashtags.' : 'Do not include hashtags.'}
${include_call_to_action ? 'Include a clear call-to-action.' : ''}

Generate only the post content, no explanations or meta-commentary.`;

  // Call OpenAI API (using simple fetch for MVP)
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: max_length ? Math.min(max_length * 2, 1000) : 500,
    }),
  });

  if (!openaiResponse.ok) {
    throw new Error('OpenAI API request failed');
  }

  const completion = await openaiResponse.json();

  return {
    text: completion.choices[0].message.content.trim(),
    model: completion.model,
    tokens: completion.usage.total_tokens,
  };
}
