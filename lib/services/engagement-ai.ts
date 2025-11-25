import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EngagementContext {
  brand_id: string;
  platform: string;
  content: string;
  author_username: string;
  sentiment_score?: number;
  is_influencer?: boolean;
}

export interface GeneratedResponse {
  content: string;
  confidence_score: number;
  voice_similarity: number;
  suggested_edits?: string;
}

export class EngagementAIService {
  private supabase: any;

  constructor() {
    this.initSupabase();
  }

  private async initSupabase() {
    this.supabase = await createClient();
  }

  /**
   * Generate an AI response for an engagement
   */
  async generateResponse(context: EngagementContext): Promise<GeneratedResponse> {
    try {
      // Get brand voice and context
      const brandVoice = await this.getBrandVoice(context.brand_id);

      // Generate response using OpenAI
      const systemPrompt = this.buildSystemPrompt(brandVoice);
      const userPrompt = this.buildUserPrompt(context);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 280, // Twitter limit
      });

      const generatedContent = completion.choices[0]?.message?.content || '';

      // Calculate confidence score based on various factors
      const confidenceScore = this.calculateConfidenceScore(
        generatedContent,
        context
      );

      // Calculate voice similarity
      // TODO: When Brand Brain is integrated, use search_similar_voice function
      // For now, use a default similarity score
      const voiceSimilarity = await this.calculateVoiceSimilarity(
        generatedContent,
        brandVoice
      );

      // Generate suggested edits if confidence is low
      let suggestedEdits: string | undefined;
      if (confidenceScore < 0.7) {
        suggestedEdits = await this.generateSuggestedEdits(
          generatedContent,
          brandVoice,
          context
        );
      }

      return {
        content: generatedContent,
        confidence_score: confidenceScore,
        voice_similarity: voiceSimilarity,
        suggested_edits: suggestedEdits
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Analyze sentiment of the engagement content
   */
  async analyzeSentiment(content: string): Promise<number> {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Analyze the sentiment of the following text and return a score between -1 (very negative) and 1 (very positive). Return only the number.'
          },
          { role: 'user', content }
        ],
        temperature: 0,
        max_tokens: 10,
      });

      const score = parseFloat(completion.choices[0]?.message?.content || '0');
      return Math.max(-1, Math.min(1, score));
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 0;
    }
  }

  /**
   * Detect the intent of the engagement
   */
  async detectIntent(content: string): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Classify the intent of this social media message into one of these categories: question, feedback, complaint, praise, request, general. Return only the category name.'
          },
          { role: 'user', content }
        ],
        temperature: 0,
        max_tokens: 20,
      });

      return completion.choices[0]?.message?.content?.toLowerCase() || 'general';
    } catch (error) {
      console.error('Error detecting intent:', error);
      return 'general';
    }
  }

  /**
   * Get brand voice and guidelines
   */
  private async getBrandVoice(brandId: string): Promise<any> {
    if (!this.supabase) {
      this.supabase = await createClient();
    }

    const { data, error } = await this.supabase
      .from('brands')
      .select('brand_voice, tone_attributes, content_guidelines')
      .eq('id', brandId)
      .single();

    if (error) {
      console.error('Error fetching brand voice:', error);
      return {
        brand_voice: 'Professional and friendly',
        tone_attributes: ['helpful', 'approachable'],
        content_guidelines: []
      };
    }

    return data;
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(brandVoice: any): string {
    const voice = brandVoice.brand_voice || 'Professional and friendly';
    const tones = brandVoice.tone_attributes?.join(', ') || 'helpful, approachable';
    const guidelines = brandVoice.content_guidelines?.join('\n') || '';

    return `You are a social media manager responding on behalf of a brand.

Brand Voice: ${voice}
Tone Attributes: ${tones}
${guidelines ? `Guidelines:\n${guidelines}` : ''}

Rules:
1. Keep responses under 280 characters for Twitter compatibility
2. Be authentic and conversational
3. Stay on brand voice
4. Be helpful and positive
5. Never make promises you can't keep
6. Don't share sensitive information
7. Use emojis sparingly and appropriately`;
  }

  /**
   * Build user prompt for AI
   */
  private buildUserPrompt(context: EngagementContext): string {
    return `Platform: ${context.platform}
Original Post: ${context.content}
Author: @${context.author_username}
${context.is_influencer ? 'Note: This is from an influencer account' : ''}
${context.sentiment_score ? `Sentiment: ${context.sentiment_score > 0 ? 'Positive' : context.sentiment_score < 0 ? 'Negative' : 'Neutral'}` : ''}

Generate an appropriate response that:
1. Acknowledges their message
2. Provides value or assistance
3. Maintains brand voice
4. Encourages further engagement if appropriate`;
  }

  /**
   * Calculate confidence score for generated response
   */
  private calculateConfidenceScore(
    response: string,
    context: EngagementContext
  ): number {
    let score = 0.7; // Base score

    // Adjust based on response length
    if (response.length > 20 && response.length < 280) {
      score += 0.1;
    }

    // Adjust based on sentiment alignment
    if (context.sentiment_score !== undefined) {
      if (context.sentiment_score < -0.5 && response.includes('sorry')) {
        score += 0.1;
      }
      if (context.sentiment_score > 0.5 && (response.includes('thank') || response.includes('appreciate'))) {
        score += 0.1;
      }
    }

    // Lower confidence for influencer accounts (need more careful responses)
    if (context.is_influencer) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate voice similarity score
   * TODO: Integrate with Brand Brain's search_similar_voice when available
   */
  private async calculateVoiceSimilarity(
    _response: string,
    _brandVoice: any
  ): Promise<number> {
    // TODO: When Brand Brain is integrated, use:
    // const { data } = await this.supabase.rpc('search_similar_voice', {
    //   query_text: response,
    //   brand_id: brandVoice.id,
    //   similarity_threshold: 0.5
    // });

    // For now, return a default similarity score
    // This is a placeholder until Brand Brain integration is complete
    return 0.85;
  }

  /**
   * Generate suggested edits for low-confidence responses
   */
  private async generateSuggestedEdits(
    response: string,
    brandVoice: any,
    context: EngagementContext
  ): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a social media expert. Suggest brief improvements to make this response better align with the brand voice and context.'
          },
          {
            role: 'user',
            content: `Response: "${response}"
Brand Voice: ${brandVoice.brand_voice}
Context: Responding to @${context.author_username} on ${context.platform}

Provide 2-3 brief suggestions for improvement.`
          }
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating suggested edits:', error);
      return '';
    }
  }

  /**
   * Check if auto-response should be enabled
   */
  async shouldAutoRespond(
    context: EngagementContext,
    confidenceScore: number
  ): Promise<boolean> {
    // Don't auto-respond to influencers
    if (context.is_influencer) {
      return false;
    }

    // Don't auto-respond to very negative sentiment
    if (context.sentiment_score !== undefined && context.sentiment_score < -0.7) {
      return false;
    }

    // Only auto-respond if confidence is high
    if (confidenceScore < 0.85) {
      return false;
    }

    // Check if brand has auto-response enabled
    if (!this.supabase) {
      this.supabase = await createClient();
    }

    const { data } = await this.supabase
      .from('engagement_rules')
      .select('auto_respond')
      .eq('brand_id', context.brand_id)
      .eq('platform', context.platform)
      .eq('is_active', true)
      .limit(1);

    return data?.[0]?.auto_respond || false;
  }
}