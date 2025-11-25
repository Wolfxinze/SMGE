import { createClient } from '@supabase/supabase-js';
import { Platform, PlatformConfig, SocialAccount, ScheduledPost } from './types';
import { TwitterPlatform } from './platforms/twitter';
import { InstagramPlatform } from './platforms/instagram';
import { LinkedInPlatform } from './platforms/linkedin';
import { TikTokPlatform } from './platforms/tiktok';
import { FacebookPlatform } from './platforms/facebook';

// Platform factory to get the correct platform implementation
export class PlatformFactory {
  static getPlatform(platform: Platform, credentials: any): any {
    switch (platform) {
      case 'twitter':
        return new TwitterPlatform(credentials);
      case 'instagram':
        return new InstagramPlatform(credentials);
      case 'linkedin':
        return new LinkedInPlatform(credentials);
      case 'tiktok':
        return new TikTokPlatform(credentials);
      case 'facebook':
        return new FacebookPlatform(credentials);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

export class QueueProcessor {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Process all scheduled posts that are ready to be published
   */
  async processQueue(lookaheadMinutes: number = 5): Promise<any[]> {
    try {
      // Call the database function to get and lock posts for processing
      const { data: posts, error } = await this.supabase.rpc('process_scheduled_posts', {
        p_lookahead_minutes: lookaheadMinutes
      });

      if (error) {
        console.error('Error fetching scheduled posts:', error);
        throw error;
      }

      if (!posts || posts.length === 0) {
        console.log('No posts to process');
        return [];
      }

      console.log(`Processing ${posts.length} scheduled posts`);

      // Process each post
      const results = await Promise.allSettled(
        posts.map((post: any) => this.processPost(post))
      );

      // Log results
      results.forEach((result, index) => {
        const post = posts[index];
        if (result.status === 'fulfilled') {
          console.log(`Successfully processed post ${post.id}`);
        } else {
          console.error(`Failed to process post ${post.id}:`, result.reason);
        }
      });

      return results;
    } catch (error) {
      console.error('Queue processing error:', error);
      throw error;
    }
  }

  /**
   * Process a single scheduled post
   */
  private async processPost(scheduledPost: any): Promise<void> {
    try {
      // Get the social account details
      const { data: socialAccount, error: accountError } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('id', scheduledPost.social_account_id)
        .single();

      if (accountError || !socialAccount) {
        throw new Error(`Social account not found: ${scheduledPost.social_account_id}`);
      }

      // Decrypt the access token
      const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET!;
      const { data: decryptedToken, error: decryptError } = await this.supabase.rpc('decrypt_token', {
        encrypted_token: socialAccount.access_token_encrypted,
        secret: encryptionSecret
      });

      if (decryptError || !decryptedToken) {
        throw new Error('Failed to decrypt access token');
      }

      // Prepare credentials
      let credentials = {
        access_token: decryptedToken,
        refresh_token: socialAccount.refresh_token_encrypted ?
          await this.decryptToken(socialAccount.refresh_token_encrypted) : null,
        expires_at: socialAccount.token_expires_at
      };

      // Get the platform implementation
      const platform = PlatformFactory.getPlatform(
        socialAccount.platform as Platform,
        credentials
      );

      // Check if token needs refresh (within 5 minutes of expiry)
      if (credentials.expires_at) {
        const expiresAt = new Date(credentials.expires_at);
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (expiresAt <= fiveMinutesFromNow) {
          console.log(`Refreshing token for account ${socialAccount.id} (expires at ${expiresAt.toISOString()})`);

          try {
            // Refresh the token
            const newCredentials = await platform.refreshAccessToken();

            // Encrypt and update the new tokens in database
            const { data: encryptedAccessToken } = await this.supabase.rpc('encrypt_token', {
              token: newCredentials.access_token,
              secret: encryptionSecret
            });

            const updateData: any = {
              access_token_encrypted: encryptedAccessToken,
              token_expires_at: newCredentials.expires_at
            };

            // Also update refresh token if provided
            if (newCredentials.refresh_token) {
              const { data: encryptedRefreshToken } = await this.supabase.rpc('encrypt_token', {
                token: newCredentials.refresh_token,
                secret: encryptionSecret
              });
              updateData.refresh_token_encrypted = encryptedRefreshToken;
            }

            const { error: updateError } = await this.supabase
              .from('social_accounts')
              .update(updateData)
              .eq('id', socialAccount.id);

            if (updateError) {
              console.error('Failed to update tokens in database:', updateError);
              // Continue with new tokens even if DB update fails
            }

            // Update credentials for this request
            credentials = newCredentials;
            console.log(`Successfully refreshed token for account ${socialAccount.id}`);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // Try to continue with existing token
            console.log('Attempting to continue with existing token');
          }
        }
      }

      // Check rate limits before publishing
      const { data: canPublish, error: rateLimitError } = await this.supabase.rpc('check_rate_limit', {
        p_account_id: socialAccount.id,
        p_limit: this.getRateLimitForPlatform(socialAccount.platform),
        p_window_minutes: this.getRateLimitWindowForPlatform(socialAccount.platform)
      });

      if (rateLimitError) {
        console.error('Rate limit check failed:', rateLimitError);
        // Continue anyway if rate limit check fails
      } else if (!canPublish) {
        throw new Error(`Rate limit exceeded for account ${socialAccount.id}. Will retry later.`);
      }

      // Publish the post
      console.log(`Publishing post ${scheduledPost.id} to ${socialAccount.platform}`);
      const result = await platform.publishPost({
        content: scheduledPost.content,
        media_urls: scheduledPost.media_urls || []
      });

      // Increment rate limit counter
      await this.supabase.rpc('increment_rate_limit', {
        p_account_id: socialAccount.id
      }).catch((err: any) => console.error('Failed to increment rate limit:', err));

      // Update the scheduled post status to published
      const { error: updateError } = await this.supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_id: result.post_id || null,
          publish_response: result
        })
        .eq('id', scheduledPost.id);

      if (updateError) {
        console.error('Failed to update post status:', updateError);
        throw updateError;
      }

      console.log(`Successfully published post ${scheduledPost.id}`);
    } catch (error) {
      console.error(`Error processing post ${scheduledPost.id}:`, error);

      // Update the post status to failed
      await this.supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: String(error),
          failed_at: new Date().toISOString()
        })
        .eq('id', scheduledPost.id)
        .catch((updateErr: any) => console.error('Failed to update error status:', updateErr));

      throw error;
    }
  }

  /**
   * Helper to decrypt a token
   */
  private async decryptToken(encryptedToken: string): Promise<string | null> {
    try {
      const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET!;
      const { data, error } = await this.supabase.rpc('decrypt_token', {
        encrypted_token: encryptedToken,
        secret: encryptionSecret
      });

      if (error || !data) {
        console.error('Failed to decrypt token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Token decryption error:', error);
      return null;
    }
  }

  /**
   * Get rate limit for platform
   */
  private getRateLimitForPlatform(platform: string): number {
    switch (platform) {
      case 'twitter':
        return 300; // 300 posts per 3 hours
      case 'instagram':
        return 25; // 25 posts per day
      case 'linkedin':
        return 100; // 100 posts per day
      case 'tiktok':
        return 50; // Estimated limit
      case 'facebook':
        return 60; // 60 posts per hour
      default:
        return 50; // Conservative default
    }
  }

  /**
   * Get rate limit window in minutes for platform
   */
  private getRateLimitWindowForPlatform(platform: string): number {
    switch (platform) {
      case 'twitter':
        return 180; // 3 hours
      case 'instagram':
        return 1440; // 24 hours
      case 'linkedin':
        return 1440; // 24 hours
      case 'tiktok':
        return 1440; // 24 hours
      case 'facebook':
        return 60; // 1 hour
      default:
        return 1440; // 24 hours default
    }
  }
}