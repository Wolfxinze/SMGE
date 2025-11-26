/**
 * AI Response Generation Service for Engagement Agent
 * Generates contextual responses using Brand Brain context
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import type { EngagementItem, GeneratedResponse, Platform, EngagementType, SentimentType, PriorityType, EngagementStatus } from '@/lib/types/engagement';
import type { Database } from '@/lib/db/types';

// Rate limiting configuration (for future use)
// const RATE_LIMITS = {
//   openai: { requestsPerMinute: 60, tokensPerMinute: 90000 },
//   anthropic: { requestsPerMinute: 50, tokensPerMinute: 100000 },
// };

/**
 * Converts database row to EngagementItem type with proper enum validation
 */
function dbRowToEngagementItem(
  row: Database['public']['Tables']['engagement_items']['Row']
): EngagementItem {
  // Validate platform enum
  const validPlatforms: Platform[] = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook'];
  if (!validPlatforms.includes(row.platform as Platform)) {
    throw new Error(`Invalid platform: ${row.platform}`);
  }

  // Validate engagement_type enum
  const validTypes: EngagementType[] = ['comment', 'dm', 'mention'];
  if (!validTypes.includes(row.engagement_type as EngagementType)) {
    throw new Error(`Invalid engagement_type: ${row.engagement_type}`);
  }

  // Validate status enum if present
  const validStatuses: EngagementStatus[] = ['pending', 'processing', 'responded', 'ignored', 'failed'];
  const status = (row.status || 'pending') as EngagementStatus;
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${row.status}`);
  }

  return {
    id: row.id,
    brand_id: row.brand_id,
    platform: row.platform as Platform,
    social_account_id: row.social_account_id,
    engagement_type: row.engagement_type as EngagementType,
    external_id: row.external_id,
    parent_post_id: row.parent_post_id,
    author_username: row.author_username,
    author_display_name: row.author_display_name,
    author_profile_url: row.author_profile_url,
    content: row.content,
    original_post_content: row.original_post_content,
    conversation_context: row.conversation_context as EngagementItem['conversation_context'],
    sentiment: (row.sentiment as SentimentType) || 'neutral',
    sentiment_score: row.sentiment_score,
    detected_intent: row.detected_intent,
    priority: (row.priority as PriorityType) || 'medium',
    is_spam: row.is_spam || false,
    is_influencer: row.is_influencer || false,
    requires_response: row.requires_response || true,
    status: status,
    processed_at: row.processed_at,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    raw_data: row.raw_data ? (row.raw_data as Record<string, any>) : undefined,
  };
}

interface BrandContext {
  brand_name: string;
  tagline?: string;
  mission?: string;
  voice_tone: Record<string, number>;
  personality_traits: string[];
  key_messages: string[];
  example_content: Array<{
    content: string;
    content_type: string;
    platform: string;
  }>;
}

interface ResponseGenerationOptions {
  model?: 'gpt-4' | 'claude-3.5-sonnet';
  temperature?: number;
  variant_count?: number;
  max_tokens?: number;
}

/**
 * Fetch Brand Brain context for response generation
 */
async function getBrandContext(brandId: string): Promise<BrandContext> {
  const supabase = await createClient();

  // Use the existing get_brand_context function
  const { data, error } = await supabase.rpc('get_brand_context', {
    p_brand_id: brandId,
  });

  if (error) throw new Error(`Failed to fetch brand context: ${error.message}`);

  const context = data as any;

  return {
    brand_name: context.brand?.name || 'the brand',
    tagline: context.brand?.tagline,
    mission: context.brand?.mission,
    voice_tone: context.voice?.tone || {},
    personality_traits: context.voice?.personality_traits || [],
    key_messages: context.voice?.key_messages || [],
    example_content: context.top_content_examples || [],
  };
}

/**
 * Analyze sentiment of incoming engagement
 */
export async function analyzeSentiment(
  content: string
): Promise<{ sentiment: string; score: number; intent: string }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const prompt = `Analyze the sentiment and intent of this social media comment/message.
Provide:
1. Sentiment (positive, neutral, negative, or urgent)
2. Sentiment score (-1.0 to 1.0)
3. Detected intent (e.g., "customer_service", "compliment", "question", "complaint", "spam")

Comment: "${content}"

Return ONLY a JSON object with these exact keys: sentiment, score, intent`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      sentiment: result.sentiment || 'neutral',
      score: result.score || 0,
      intent: result.intent || 'unknown',
    };
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    return { sentiment: 'neutral', score: 0, intent: 'unknown' };
  }
}

/**
 * Determine priority based on sentiment and influencer status
 */
export function calculatePriority(
  sentiment: string,
  isInfluencer: boolean,
  intent: string
): string {
  if (sentiment === 'urgent' || intent === 'customer_service') return 'urgent';
  if (sentiment === 'negative') return 'high';
  if (isInfluencer) return 'high';
  if (sentiment === 'positive') return 'normal';
  return 'normal';
}

/**
 * Generate AI response using OpenAI GPT-4
 */
async function generateWithGPT4(
  engagement: EngagementItem,
  brandContext: BrandContext,
  options: ResponseGenerationOptions
): Promise<{ text: string; tokens: { prompt: number; completion: number }; time: number }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const startTime = Date.now();

  // Build context-rich prompt
  const systemPrompt = `You are a social media manager for ${brandContext.brand_name}.

Brand Voice:
- Tone: ${Object.entries(brandContext.voice_tone)
    .map(([key, value]) => `${key} (${value})`)
    .join(', ')}
- Personality: ${brandContext.personality_traits.join(', ')}
- Mission: ${brandContext.mission || 'Not specified'}

Key Messages to Reinforce:
${brandContext.key_messages.map((msg) => `- ${msg}`).join('\n')}

Example Content Style:
${brandContext.example_content
  .slice(0, 2)
  .map((ex) => `"${ex.content.slice(0, 150)}..."`)
  .join('\n')}

Guidelines:
- Match the brand's voice and tone exactly
- Be authentic, helpful, and engaging
- Keep responses concise (1-3 sentences max for comments)
- Use appropriate emojis if they fit the brand personality
- Never make promises you can't keep
- Redirect complex issues to DM or customer support if needed`;

  const userPrompt = `Generate a response to this ${engagement.engagement_type}:

Author: ${engagement.author_username}
${engagement.author_display_name ? `Display Name: ${engagement.author_display_name}` : ''}
Content: "${engagement.content}"
${engagement.original_post_content ? `Original Post: "${engagement.original_post_content}"` : ''}
Sentiment: ${engagement.sentiment}

Generate a brand-aligned response that:
1. Acknowledges the ${engagement.engagement_type}
2. Matches the brand voice
3. Is appropriate for the sentiment (${engagement.sentiment})
${engagement.sentiment === 'negative' ? '4. Shows empathy and offers help' : ''}
${engagement.detected_intent === 'customer_service' ? '4. Offers to help resolve the issue' : ''}

Return ONLY the response text, no explanations.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 200,
    });

    const generationTime = Date.now() - startTime;

    return {
      text: response.choices[0].message.content?.trim() || '',
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
      },
      time: generationTime,
    };
  } catch (error: any) {
    throw new Error(`GPT-4 generation failed: ${error.message}`);
  }
}

/**
 * Generate AI response using Claude 3.5 Sonnet
 */
async function generateWithClaude(
  engagement: EngagementItem,
  brandContext: BrandContext,
  options: ResponseGenerationOptions
): Promise<{ text: string; tokens: { prompt: number; completion: number }; time: number }> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const startTime = Date.now();

  const prompt = `You are responding to social media engagement for ${brandContext.brand_name}.

Brand Context:
- Voice Tone: ${Object.entries(brandContext.voice_tone)
    .map(([key, value]) => `${key} (${value})`)
    .join(', ')}
- Personality: ${brandContext.personality_traits.join(', ')}
- Key Messages: ${brandContext.key_messages.join('; ')}

Incoming ${engagement.engagement_type}:
Author: ${engagement.author_username}
Content: "${engagement.content}"
${engagement.original_post_content ? `Context (Original Post): "${engagement.original_post_content}"` : ''}
Sentiment Analysis: ${engagement.sentiment}

Generate a concise, brand-aligned response (1-3 sentences) that:
1. Matches the brand's communication style
2. Is appropriate for a ${engagement.sentiment} sentiment
3. Engages authentically with the author
${engagement.sentiment === 'negative' ? '4. Shows empathy and offers to help' : ''}

Return only the response text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options.max_tokens || 200,
      temperature: options.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const generationTime = Date.now() - startTime;

    const contentBlock = response.content[0];
    const text = contentBlock.type === 'text' ? contentBlock.text : '';

    return {
      text: text.trim(),
      tokens: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
      },
      time: generationTime,
    };
  } catch (error: any) {
    throw new Error(`Claude generation failed: ${error.message}`);
  }
}

/**
 * Calculate brand voice similarity score
 */
async function calculateVoiceSimilarity(
  responseText: string,
  _brandId: string
): Promise<number> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Generate embedding for the response
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: responseText,
    });

    const responseEmbedding = embeddingResponse.data[0].embedding;

    // Compare with brand voice embedding
    // TODO: When Brand Brain is fully integrated, use search_similar_voice
    // For now, return a default similarity score
    try {
      const supabase = await createClient();
      // Convert embedding array to pgvector format: [1,2,3,...]
      const vectorString = `[${responseEmbedding.join(',')}]`;
      const { data, error } = await supabase.rpc('search_similar_voice', {
        p_query_embedding: vectorString,
        p_limit: 1,
      });

      if (!error && data && data.length > 0) {
        return data[0].similarity || 0.7;
      }
    } catch (rpcError) {
      console.log('Brand Brain voice similarity not available yet, using default');
    }

    // Default similarity score until Brand Brain integration is complete
    return 0.85;
  } catch (error) {
    console.error('Voice similarity calculation failed:', error);
    return 0.7; // Default similarity
  }
}

/**
 * Main function: Generate response for engagement item
 */
export async function generateResponse(
  engagementItemId: string,
  brandId: string,
  options: ResponseGenerationOptions = {}
): Promise<GeneratedResponse> {
  const supabase = await createClient();

  // Fetch engagement item
  const { data: engagementRow, error: engagementError } = await supabase
    .from('engagement_items')
    .select('*')
    .eq('id', engagementItemId)
    .single();

  if (engagementError || !engagementRow) {
    throw new Error('Engagement item not found');
  }

  // Convert database row to typed EngagementItem with validation
  const engagement = dbRowToEngagementItem(engagementRow);

  // Fetch brand context
  const brandContext = await getBrandContext(brandId);

  // Select model (default to GPT-4)
  const model = options.model || 'gpt-4';

  // Generate response
  let result;
  if (model === 'claude-3.5-sonnet') {
    result = await generateWithClaude(engagement, brandContext, options);
  } else {
    result = await generateWithGPT4(engagement, brandContext, options);
  }

  // Calculate brand voice similarity
  const voiceSimilarity = await calculateVoiceSimilarity(result.text, brandId);

  // Create generated response record
  const { data: generatedResponse, error: insertError } = await supabase
    .from('generated_responses')
    .insert({
      engagement_item_id: engagementItemId,
      brand_id: brandId,
      response_text: result.text,
      response_variant_number: 1,
      ai_model: model,
      prompt_tokens: result.tokens.prompt,
      completion_tokens: result.tokens.completion,
      generation_time_ms: result.time,
      brand_voice_similarity: voiceSimilarity,
      approval_status: 'pending',
      posting_status: 'queued',
    })
    .select()
    .single();

  if (insertError || !generatedResponse) {
    throw new Error(`Failed to save response: ${insertError?.message}`);
  }

  return generatedResponse as GeneratedResponse;
}

/**
 * Batch generate multiple response variants
 */
export async function generateResponseVariants(
  engagementItemId: string,
  brandId: string,
  variantCount: number = 3
): Promise<GeneratedResponse[]> {
  const variants: GeneratedResponse[] = [];

  for (let i = 0; i < variantCount; i++) {
    const model = i === 0 ? 'gpt-4' : i === 1 ? 'claude-3.5-sonnet' : 'gpt-4';
    const temperature = 0.7 + i * 0.1; // Slightly vary temperature

    const response = await generateResponse(engagementItemId, brandId, {
      model,
      temperature,
    });

    variants.push(response);
  }

  return variants;
}
