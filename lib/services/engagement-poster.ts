/**
 * Social Media Posting Service for Engagement Agent
 * Posts approved responses to social platforms with retry logic
 */

import { createClient } from '@/lib/supabase/server';
import type { EngagementItem, Platform } from '@/lib/types/engagement';

interface PostResult {
  success: boolean;
  external_id?: string;
  response_url?: string;
  error?: string;
}

interface SocialAccountCredentials {
  access_token: string;
  refresh_token?: string;
  account_id: string;
}

/**
 * Decrypt social account credentials from database
 */
async function getAccountCredentials(
  socialAccountId: string
): Promise<SocialAccountCredentials> {
  const supabase = await createClient();

  const { data: account, error } = await supabase
    .from('social_accounts')
    .select('account_id, access_token_encrypted, refresh_token_encrypted')
    .eq('id', socialAccountId)
    .single();

  if (error || !account) {
    throw new Error('Social account not found');
  }

  // Decrypt tokens using the encryption secret
  const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET!;

  if (!account.access_token_encrypted) {
    throw new Error('No access token available for account');
  }

  const { data: accessTokenData } = await supabase.rpc('decrypt_token', {
    encrypted_token: account.access_token_encrypted,
    secret: encryptionSecret,
  });

  let refreshTokenData;
  if (account.refresh_token_encrypted) {
    const result = await supabase.rpc('decrypt_token', {
      encrypted_token: account.refresh_token_encrypted,
      secret: encryptionSecret,
    });
    refreshTokenData = result.data;
  }

  return {
    access_token: accessTokenData || '',
    refresh_token: refreshTokenData || undefined,
    account_id: account.account_id,
  };
}

/**
 * Post comment reply to Instagram
 */
async function postToInstagram(
  credentials: SocialAccountCredentials,
  engagement: EngagementItem,
  responseText: string
): Promise<PostResult> {
  try {
    // Instagram Graph API - Reply to comment
    const url = `https://graph.facebook.com/v18.0/${engagement.external_id}/replies`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: responseText,
        access_token: credentials.access_token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Instagram API error',
      };
    }

    return {
      success: true,
      external_id: data.id,
      response_url: `https://www.instagram.com/p/${engagement.parent_post_id}/`, // Approximate
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Instagram posting failed: ${error.message}`,
    };
  }
}

/**
 * Post reply to Twitter
 */
async function postToTwitter(
  credentials: SocialAccountCredentials,
  engagement: EngagementItem,
  responseText: string
): Promise<PostResult> {
  try {
    // Twitter API v2 - Reply to tweet
    const url = 'https://api.twitter.com/2/tweets';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        text: responseText,
        reply: {
          in_reply_to_tweet_id: engagement.external_id,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.detail || data.title || 'Twitter API error',
      };
    }

    return {
      success: true,
      external_id: data.data.id,
      response_url: `https://twitter.com/${credentials.account_id}/status/${data.data.id}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Twitter posting failed: ${error.message}`,
    };
  }
}

/**
 * Post reply to LinkedIn
 */
async function postToLinkedIn(
  credentials: SocialAccountCredentials,
  engagement: EngagementItem,
  responseText: string
): Promise<PostResult> {
  try {
    // LinkedIn API - Create comment reply
    const url = `https://api.linkedin.com/v2/socialActions/${engagement.external_id}/comments`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        actor: `urn:li:person:${credentials.account_id}`,
        message: {
          text: responseText,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'LinkedIn API error',
      };
    }

    return {
      success: true,
      external_id: data.id || engagement.external_id,
      response_url: engagement.original_post_content
        ? `https://www.linkedin.com/feed/update/${engagement.parent_post_id}/`
        : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `LinkedIn posting failed: ${error.message}`,
    };
  }
}

/**
 * Post reply to TikTok
 */
async function postToTikTok(
  credentials: SocialAccountCredentials,
  engagement: EngagementItem,
  responseText: string
): Promise<PostResult> {
  try {
    // TikTok API - Reply to comment
    const url = `https://open.tiktokapis.com/v2/comment/reply/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        comment_id: engagement.external_id,
        text: responseText,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error?.message || 'TikTok API error',
      };
    }

    return {
      success: true,
      external_id: data.data?.comment_id || engagement.external_id,
      response_url: data.data?.share_url,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `TikTok posting failed: ${error.message}`,
    };
  }
}

/**
 * Route posting to the appropriate platform
 */
async function postToPlatform(
  platform: Platform,
  credentials: SocialAccountCredentials,
  engagement: EngagementItem,
  responseText: string
): Promise<PostResult> {
  switch (platform) {
    case 'instagram':
      return postToInstagram(credentials, engagement, responseText);
    case 'twitter':
      return postToTwitter(credentials, engagement, responseText);
    case 'linkedin':
      return postToLinkedIn(credentials, engagement, responseText);
    case 'tiktok':
      return postToTikTok(credentials, engagement, responseText);
    default:
      return {
        success: false,
        error: `Unsupported platform: ${platform}`,
      };
  }
}

/**
 * Calculate exponential backoff for retries
 */
function calculateRetryDelay(retryCount: number): Date {
  const baseDelayMinutes = 5;
  const delayMinutes = baseDelayMinutes * Math.pow(2, retryCount); // Exponential backoff
  const maxDelayMinutes = 240; // Max 4 hours

  const finalDelay = Math.min(delayMinutes, maxDelayMinutes);
  return new Date(Date.now() + finalDelay * 60 * 1000);
}

/**
 * Post approved response to social platform
 */
export async function postResponse(responseId: string): Promise<void> {
  const supabase = await createClient();

  // Fetch generated response
  const { data: response, error: responseError } = await supabase
    .from('generated_responses')
    .select('*, engagement_items(*)')
    .eq('id', responseId)
    .single();

  if (responseError || !response) {
    throw new Error('Generated response not found');
  }

  // Check if already posted
  if (response.posting_status === 'posted') {
    console.log(`Response ${responseId} already posted`);
    return;
  }

  // Check if approved
  if (response.approval_status !== 'approved' && response.approval_status !== 'edited') {
    throw new Error('Response not approved for posting');
  }

  // Update status to posting
  await supabase
    .from('generated_responses')
    .update({ posting_status: 'posting' })
    .eq('id', responseId);

  const engagement = response.engagement_items as unknown as EngagementItem;

  // Get credentials
  let credentials: SocialAccountCredentials;
  try {
    credentials = await getAccountCredentials(engagement.social_account_id);
  } catch (error: any) {
    await supabase
      .from('generated_responses')
      .update({
        posting_status: 'failed',
        posting_error: `Credential error: ${error.message}`,
      })
      .eq('id', responseId);
    throw error;
  }

  // Determine final response text (use edited version if available)
  const responseText = response.edited_response_text || response.response_text;

  // Post to platform
  const result = await postToPlatform(
    engagement.platform,
    credentials,
    engagement,
    responseText
  );

  if (result.success) {
    // Calculate response time
    const responseTimeMinutes = Math.floor(
      (Date.now() - new Date(engagement.created_at).getTime()) / 60000
    );

    // Update response status
    await supabase
      .from('generated_responses')
      .update({
        posting_status: 'posted',
        posted_at: new Date().toISOString(),
        external_response_id: result.external_id,
      })
      .eq('id', responseId);

    // Update engagement item status
    await supabase
      .from('engagement_items')
      .update({
        status: 'responded',
        processed_at: new Date().toISOString(),
      })
      .eq('id', engagement.id);

    // Create history record
    await supabase.from('engagement_history').insert({
      engagement_item_id: engagement.id,
      generated_response_id: responseId,
      brand_id: response.brand_id,
      response_text: responseText,
      was_edited: response.approval_status === 'edited',
      platform: engagement.platform,
      external_response_id: result.external_id || '',
      response_url: result.response_url,
      response_time_minutes: responseTimeMinutes,
      posted_at: new Date().toISOString(),
    });

    console.log(`Successfully posted response ${responseId} to ${engagement.platform}`);
  } else {
    // Handle failure with retry logic
    const newRetryCount = (response.retry_count ?? 0) + 1;
    const maxRetries = 5;

    if (newRetryCount < maxRetries) {
      // Schedule retry
      const nextRetryAt = calculateRetryDelay(newRetryCount);

      await supabase
        .from('generated_responses')
        .update({
          posting_status: 'failed',
          posting_error: result.error,
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt.toISOString(),
        })
        .eq('id', responseId);

      console.log(
        `Posting failed for ${responseId}. Retry ${newRetryCount}/${maxRetries} scheduled for ${nextRetryAt}`
      );
    } else {
      // Max retries reached
      await supabase
        .from('generated_responses')
        .update({
          posting_status: 'failed',
          posting_error: `Max retries exceeded: ${result.error}`,
        })
        .eq('id', responseId);

      await supabase
        .from('engagement_items')
        .update({ status: 'failed' })
        .eq('id', engagement.id);

      throw new Error(`Failed to post response after ${maxRetries} retries: ${result.error}`);
    }
  }
}

/**
 * Retry failed postings that are due for retry
 */
export async function retryFailedPostings(): Promise<void> {
  const supabase = await createClient();

  const { data: failedResponses, error } = await supabase
    .from('generated_responses')
    .select('id')
    .eq('posting_status', 'failed')
    .lte('next_retry_at', new Date().toISOString())
    .limit(10);

  if (error || !failedResponses) {
    console.error('Failed to fetch retry queue:', error);
    return;
  }

  console.log(`Retrying ${failedResponses.length} failed postings`);

  for (const response of failedResponses) {
    try {
      await postResponse(response.id);
    } catch (error) {
      console.error(`Retry failed for response ${response.id}:`, error);
    }
  }
}
