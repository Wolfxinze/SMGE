/**
 * Queue Processor
 *
 * Core engine for processing scheduled posts and publishing to social platforms.
 * This would typically run as a Supabase Edge Function triggered by cron.
 *
 * Following Linus's principle: "Simple and reliable beats complex and theoretical."
 */

import { createClient } from '@supabase/supabase-js';
import { PlatformFactory } from './platforms/base';
import type { QueueItem, PlatformCredentials } from './types';

/**
 * Process posts due for publishing
 *
 * This function is designed to be called by a cron job (e.g., every minute)
 * It fetches posts due for publishing, attempts to post them, and handles retries.
 */
export async function processScheduledPosts(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Fetch posts due for publishing (using database function for atomicity)
    const { data: queueItems, error: fetchError } = await supabase
      .rpc('get_posts_due_for_publishing', { p_lookahead_minutes: 5 });

    if (fetchError) {
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No posts due for publishing');
      return stats;
    }

    console.log(`Processing ${queueItems.length} scheduled posts`);

    // Process each post
    for (const item of queueItems as QueueItem[]) {
      stats.processed++;

      try {
        // Mark as processing
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString(),
          })
          .eq('id', item.scheduled_post_id);

        // Get social account credentials
        const { data: socialAccount, error: accountError } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('id', item.social_account_id)
          .single();

        if (accountError || !socialAccount) {
          throw new Error('Social account not found or inactive');
        }

        // Decrypt tokens
        const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;
        if (!encryptionSecret) {
          throw new Error('Encryption secret not configured');
        }

        const { data: accessToken } = await supabase.rpc('decrypt_token', {
          encrypted_token: socialAccount.access_token_encrypted,
          secret: encryptionSecret,
        });

        let refreshToken = null;
        if (socialAccount.refresh_token_encrypted) {
          const { data } = await supabase.rpc('decrypt_token', {
            encrypted_token: socialAccount.refresh_token_encrypted,
            secret: encryptionSecret,
          });
          refreshToken = data;
        }

        const credentials: PlatformCredentials = {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: socialAccount.token_expires_at
            ? new Date(socialAccount.token_expires_at)
            : undefined,
          account_id: socialAccount.account_id,
          scopes: socialAccount.scopes,
        };

        // Get platform instance
        const platform = await PlatformFactory.getPlatform(
          item.platform as any,
          credentials
        );

        // Fetch full post data
        const { data: post, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('id', item.post_id)
          .single();

        if (postError || !post) {
          throw new Error('Post not found');
        }

        // Publish to platform
        const result = await platform.publishPost(post, post.platform_specific_data);

        if (result.success) {
          // Update status to published
          await supabase.rpc('update_scheduled_post_status', {
            p_scheduled_post_id: item.scheduled_post_id,
            p_new_status: 'published',
            p_platform_post_id: result.platform_post_id,
            p_platform_url: result.platform_url,
          });

          stats.succeeded++;
          console.log(`✓ Published post ${item.post_id} to ${item.platform}`);

          // Schedule analytics fetch (after 24 hours)
          // TODO: Implement analytics fetching cron job
        } else {
          // Handle failure
          throw new Error(result.error?.message || 'Publishing failed');
        }
      } catch (error: any) {
        stats.failed++;
        const errorMessage = error.message || 'Unknown error';
        stats.errors.push(`Post ${item.post_id}: ${errorMessage}`);

        console.error(`✗ Failed to publish post ${item.post_id}:`, errorMessage);

        // Update status to failed
        await supabase.rpc('update_scheduled_post_status', {
          p_scheduled_post_id: item.scheduled_post_id,
          p_new_status: 'failed',
          p_error_message: errorMessage,
        });
      }
    }

    return stats;
  } catch (error: any) {
    console.error('Queue processor error:', error);
    stats.errors.push(`Queue processor: ${error.message}`);
    return stats;
  }
}

/**
 * Process failed posts that are due for retry
 */
export async function processRetries(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  try {
    // Fetch failed posts due for retry
    const { data: retryItems, error: fetchError } = await supabase
      .rpc('get_posts_due_for_retry');

    if (fetchError) {
      throw fetchError;
    }

    if (!retryItems || retryItems.length === 0) {
      console.log('No posts due for retry');
      return stats;
    }

    console.log(`Processing ${retryItems.length} retry attempts`);

    // Reset to pending status so main processor picks them up
    for (const item of retryItems) {
      stats.processed++;

      await supabase
        .from('scheduled_posts')
        .update({
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.scheduled_post_id);

      stats.succeeded++;
    }

    return stats;
  } catch (error: any) {
    console.error('Retry processor error:', error);
    return stats;
  }
}

/**
 * Fetch and update analytics for published posts
 */
export async function fetchAnalytics(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  try {
    // Fetch published posts from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: publishedPosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select(`
        *,
        social_accounts (
          platform,
          access_token_encrypted,
          refresh_token_encrypted,
          account_id,
          token_expires_at,
          scopes
        )
      `)
      .eq('status', 'published')
      .gte('published_at', thirtyDaysAgo.toISOString())
      .not('platform_post_id', 'is', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!publishedPosts || publishedPosts.length === 0) {
      console.log('No posts to fetch analytics for');
      return stats;
    }

    console.log(`Fetching analytics for ${publishedPosts.length} posts`);

    const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      throw new Error('Encryption secret not configured');
    }

    for (const scheduledPost of publishedPosts) {
      stats.processed++;

      try {
        // Decrypt credentials
        const { data: accessToken } = await supabase.rpc('decrypt_token', {
          encrypted_token: scheduledPost.social_accounts.access_token_encrypted,
          secret: encryptionSecret,
        });

        let refreshToken = null;
        if (scheduledPost.social_accounts.refresh_token_encrypted) {
          const { data } = await supabase.rpc('decrypt_token', {
            encrypted_token: scheduledPost.social_accounts.refresh_token_encrypted,
            secret: encryptionSecret,
          });
          refreshToken = data;
        }

        const credentials: PlatformCredentials = {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: scheduledPost.social_accounts.token_expires_at
            ? new Date(scheduledPost.social_accounts.token_expires_at)
            : undefined,
          account_id: scheduledPost.social_accounts.account_id,
          scopes: scheduledPost.social_accounts.scopes,
        };

        // Get platform instance
        const platform = await PlatformFactory.getPlatform(
          scheduledPost.social_accounts.platform as any,
          credentials
        );

        // Fetch analytics
        const analytics = await platform.fetchAnalytics(scheduledPost.platform_post_id!);

        // Upsert analytics
        await supabase
          .from('posting_analytics')
          .upsert({
            scheduled_post_id: scheduledPost.id,
            post_id: scheduledPost.post_id,
            platform: scheduledPost.social_accounts.platform,
            ...analytics,
            metrics_fetched_at: new Date().toISOString(),
          }, {
            onConflict: 'scheduled_post_id',
          });

        stats.succeeded++;
      } catch (error: any) {
        stats.failed++;
        console.error(`Failed to fetch analytics for post ${scheduledPost.id}:`, error.message);
      }
    }

    return stats;
  } catch (error: any) {
    console.error('Analytics fetcher error:', error);
    return stats;
  }
}
