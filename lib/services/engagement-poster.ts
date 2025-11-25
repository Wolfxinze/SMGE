import { createClient } from '@/lib/supabase/server';

export interface PostEngagementRequest {
  engagement_item_id: string;
  response_content: string;
  platform: string;
}

export class EngagementPosterService {
  private supabase: any;

  constructor() {
    this.initSupabase();
  }

  private async initSupabase() {
    this.supabase = await createClient();
  }

  /**
   * Post engagement response to social platform
   */
  async postResponse(request: PostEngagementRequest): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        this.supabase = await createClient();
      }

      // Get the engagement item details
      const { data: engagement, error: engagementError } = await this.supabase
        .from('engagement_items')
        .select('*, brand:brands(*)')
        .eq('id', request.engagement_item_id)
        .single();

      if (engagementError || !engagement) {
        throw new Error('Engagement item not found');
      }

      // Get social account credentials
      const { data: socialAccount, error: accountError } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('brand_id', engagement.brand_id)
        .eq('platform', request.platform)
        .single();

      if (accountError || !socialAccount) {
        throw new Error(`No ${request.platform} account connected for this brand`);
      }

      // Decrypt the access token
      // Note: decrypt_token function exists in 00001_initial_schema.sql
      const { data: decryptedToken, error: decryptError } = await this.supabase
        .rpc('decrypt_token', {
          encrypted_token: socialAccount.encrypted_access_token,
          secret: process.env.ENCRYPTION_SECRET
        });

      if (decryptError || !decryptedToken) {
        throw new Error('Failed to decrypt access token');
      }

      // Post to the appropriate platform
      let result;
      switch (request.platform) {
        case 'twitter':
          result = await this.postToTwitter(
            decryptedToken,
            request.response_content,
            engagement.external_id
          );
          break;
        case 'instagram':
          result = await this.postToInstagram(
            decryptedToken,
            request.response_content,
            engagement.external_id
          );
          break;
        case 'linkedin':
          result = await this.postToLinkedIn(
            decryptedToken,
            request.response_content,
            engagement.external_id
          );
          break;
        case 'tiktok':
          result = await this.postToTikTok(
            decryptedToken,
            request.response_content,
            engagement.external_id
          );
          break;
        default:
          throw new Error(`Unsupported platform: ${request.platform}`);
      }

      if (result.success) {
        // Update engagement item status
        await this.supabase
          .from('engagement_items')
          .update({
            status: 'responded',
            responded_at: new Date().toISOString()
          })
          .eq('id', request.engagement_item_id);

        // Update response status
        await this.supabase
          .from('engagement_responses')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('engagement_item_id', request.engagement_item_id);
      }

      return result;
    } catch (error) {
      console.error('Error posting engagement response:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Post response to Twitter
   */
  private async postToTwitter(
    _accessToken: string,
    content: string,
    replyToId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement Twitter API v2 reply
      // For now, return a simulated success
      console.log('Posting to Twitter:', { content, replyToId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Twitter post failed'
      };
    }
  }

  /**
   * Post response to Instagram
   */
  private async postToInstagram(
    _accessToken: string,
    content: string,
    replyToId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement Instagram Graph API comment
      // For now, return a simulated success
      console.log('Posting to Instagram:', { content, replyToId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Instagram post failed'
      };
    }
  }

  /**
   * Post response to LinkedIn
   */
  private async postToLinkedIn(
    _accessToken: string,
    content: string,
    replyToId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement LinkedIn API comment
      // For now, return a simulated success
      console.log('Posting to LinkedIn:', { content, replyToId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LinkedIn post failed'
      };
    }
  }

  /**
   * Post response to TikTok
   */
  private async postToTikTok(
    _accessToken: string,
    content: string,
    replyToId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement TikTok API comment
      // For now, return a simulated success
      console.log('Posting to TikTok:', { content, replyToId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'TikTok post failed'
      };
    }
  }

  /**
   * Validate response before posting
   */
  async validateResponse(content: string, platform: string): Promise<{ valid: boolean; reason?: string }> {
    // Check content length based on platform limits
    const platformLimits: Record<string, number> = {
      twitter: 280,
      instagram: 2200,
      linkedin: 3000,
      tiktok: 150
    };

    const limit = platformLimits[platform] || 280;

    if (content.length > limit) {
      return {
        valid: false,
        reason: `Content exceeds ${platform} character limit (${content.length}/${limit})`
      };
    }

    // Check for prohibited content
    const prohibitedTerms = [
      'guaranteed', 'promise', 'definitely',
      'cure', 'miracle', 'exclusive'
    ];

    const contentLower = content.toLowerCase();
    for (const term of prohibitedTerms) {
      if (contentLower.includes(term)) {
        return {
          valid: false,
          reason: `Content contains prohibited term: "${term}"`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get posting rate limit status
   */
  async getRateLimitStatus(brandId: string, platform: string): Promise<{ canPost: boolean; resetAt?: Date }> {
    if (!this.supabase) {
      this.supabase = await createClient();
    }

    // Check recent posts count
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('engagement_responses')
      .select('id')
      .eq('brand_id', brandId)
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo);

    if (error) {
      console.error('Error checking rate limit:', error);
      return { canPost: true };
    }

    // Get rate limit from rules
    const { data: rules } = await this.supabase
      .from('engagement_rules')
      .select('max_responses_per_hour')
      .eq('brand_id', brandId)
      .eq('platform', platform)
      .eq('is_active', true)
      .limit(1);

    const maxPerHour = rules?.[0]?.max_responses_per_hour || 10;
    const currentCount = data?.length || 0;

    if (currentCount >= maxPerHour) {
      const oldestPost = data?.[0];
      if (oldestPost) {
        const resetAt = new Date(Date.now() + 60 * 60 * 1000);
        return { canPost: false, resetAt };
      }
    }

    return { canPost: true };
  }
}