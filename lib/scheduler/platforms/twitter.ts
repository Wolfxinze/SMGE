/**
 * Twitter/X Platform Integration
 *
 * Implements Twitter API v2 for posting tweets, threads, and media.
 * This is the proof-of-concept implementation before expanding to other platforms.
 *
 * API Documentation: https://developer.twitter.com/en/docs/twitter-api
 */

import {
  BasePlatform,
  type PlatformCredentials,
  type MediaUploadResult,
} from './base';
import type {
  PublishResult,
  Post,
  TwitterPostData,
  PostingAnalytics,
  PlatformSpecificData,
} from '../types';
import { ERROR_CODES } from '../types';

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_BASE = 'https://upload.twitter.com/1.1';

/**
 * Twitter Platform Implementation
 */
export class TwitterPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('twitter', credentials);
  }

  /**
   * Validate Twitter credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.makeRequest('/users/me');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh Twitter access token
   */
  async refreshAccessToken(): Promise<PlatformCredentials> {
    if (!this.credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.TWITTER_CLIENT_ID!;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: this.credentials.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Twitter token');
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.credentials.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      account_id: this.credentials.account_id,
    };
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]> {
    await this.ensureValidToken();
    const results: MediaUploadResult[] = [];

    for (const url of mediaUrls) {
      try {
        // Download media file
        const mediaResponse = await fetch(url);
        if (!mediaResponse.ok) {
          throw new Error(`Failed to download media: ${url}`);
        }

        const mediaBuffer = await mediaResponse.arrayBuffer();
        const mediaBase64 = Buffer.from(mediaBuffer).toString('base64');

        // Initialize upload
        const initResponse = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            command: 'INIT',
            total_bytes: mediaBuffer.byteLength.toString(),
            media_type: this.getTwitterMediaType(mediaType),
          }),
        });

        if (!initResponse.ok) {
          throw new Error('Failed to initialize media upload');
        }

        const initData = await initResponse.json();
        const mediaId = initData.media_id_string;

        // Append media
        await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            command: 'APPEND',
            media_id: mediaId,
            media_data: mediaBase64,
            segment_index: '0',
          }),
        });

        // Finalize upload
        const finalizeResponse = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            command: 'FINALIZE',
            media_id: mediaId,
          }),
        });

        if (!finalizeResponse.ok) {
          throw new Error('Failed to finalize media upload');
        }

        results.push({
          media_id: mediaId,
          media_type: mediaType,
        });
      } catch (error) {
        console.error('Twitter media upload error:', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Publish tweet to Twitter
   */
  async publishPost(
    post: Post,
    platformData?: PlatformSpecificData
  ): Promise<PublishResult> {
    try {
      await this.ensureValidToken();
      await this.validateContent(post);

      const twitterData = platformData as TwitterPostData | undefined;

      // Upload media if present
      let mediaIds: string[] = [];
      if (post.media_urls && post.media_urls.length > 0) {
        const uploadResults = await this.uploadMedia(post.media_urls, 'image');
        mediaIds = uploadResults.map(r => r.media_id);
      }

      // Format tweet text
      const text = this.formatPostText(post, this.getContentLimits().max_text_length);

      // Create tweet payload
      const payload: any = { text };

      if (mediaIds.length > 0) {
        payload.media = { media_ids: mediaIds };
      }

      // Add poll if specified
      if (twitterData?.poll_options && twitterData.poll_options.length > 0) {
        payload.poll = {
          options: twitterData.poll_options,
          duration_minutes: twitterData.poll_duration_minutes || 1440, // Default 24 hours
        };
      }

      // Add reply settings
      if (twitterData?.reply_settings) {
        payload.reply_settings = twitterData.reply_settings;
      }

      // Publish tweet
      const response = await this.makeRequest('/tweets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      const tweetId = data.data.id;

      return {
        success: true,
        platform_post_id: tweetId,
        platform_url: `https://twitter.com/i/web/status/${tweetId}`,
      };
    } catch (error: any) {
      const platformError = this.handlePlatformError(error);
      return {
        success: false,
        error: platformError,
      };
    }
  }

  /**
   * Delete tweet from Twitter
   */
  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.ensureValidToken();

      const response = await this.makeRequest(`/tweets/${platformPostId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch analytics for tweet
   */
  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    try {
      await this.ensureValidToken();

      const response = await this.makeRequest(
        `/tweets/${platformPostId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tweet analytics');
      }

      const data = await response.json();
      const metrics = data.data?.public_metrics || {};
      const organicMetrics = data.data?.organic_metrics || {};

      return {
        platform: 'twitter',
        likes: metrics.like_count || 0,
        comments: metrics.reply_count || 0,
        shares: metrics.retweet_count || 0,
        impressions: organicMetrics.impression_count || 0,
        clicks: organicMetrics.url_link_clicks || 0,
        engagement_rate: this.calculateEngagementRate(metrics),
      };
    } catch (error) {
      console.error('Failed to fetch Twitter analytics:', error);
      return {};
    }
  }

  /**
   * Get Twitter account information
   */
  async getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }> {
    await this.ensureValidToken();

    const response = await this.makeRequest('/users/me?user.fields=public_metrics,username');

    if (!response.ok) {
      throw new Error('Failed to fetch Twitter account info');
    }

    const data = await response.json();
    const user = data.data;

    return {
      account_id: user.id,
      account_name: user.username,
      follower_count: user.public_metrics?.followers_count,
      profile_url: `https://twitter.com/${user.username}`,
    };
  }

  /**
   * Validate tweet content
   */
  async validateContent(post: Post): Promise<void> {
    const limits = this.getContentLimits();

    // Check text length
    if (post.body.length > limits.max_text_length) {
      throw new Error(`Tweet text exceeds maximum length of ${limits.max_text_length} characters`);
    }

    // Check media count
    if (post.media_urls && post.media_urls.length > limits.max_media_count) {
      throw new Error(`Tweet can have maximum ${limits.max_media_count} media items`);
    }

    // Validate media URLs
    if (post.media_urls && post.media_urls.length > 0) {
      await this.validateMediaUrls(post.media_urls);
    }
  }

  /**
   * Get Twitter content limits
   */
  getContentLimits() {
    return {
      max_text_length: 280,
      max_media_count: 4,
      max_hashtags: 2, // Recommended, not enforced
      supported_media_types: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    };
  }

  /**
   * Get rate limit status for endpoint
   */
  async getRateLimitStatus(endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }> {
    await this.ensureValidToken();

    const response = await this.makeRequest('/tweets', {
      method: 'GET',
    });

    const remaining = parseInt(response.headers.get('x-rate-limit-remaining') || '0');
    const limit = parseInt(response.headers.get('x-rate-limit-limit') || '0');
    const reset = parseInt(response.headers.get('x-rate-limit-reset') || '0');

    return {
      remaining,
      limit,
      resets_at: new Date(reset * 1000),
    };
  }

  /**
   * Handle Twitter API errors
   */
  protected handlePlatformError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorData = error.errors?.[0] || error;
    const errorCode = errorData.code || errorData.type;

    // Rate limit error
    if (errorCode === 429 || errorCode === 88) {
      return {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Twitter API rate limit exceeded',
        retryable: true,
      };
    }

    // Authentication errors
    if (errorCode === 401 || errorCode === 403) {
      return {
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Twitter authentication failed',
        retryable: false,
      };
    }

    // Duplicate content
    if (errorCode === 187) {
      return {
        code: ERROR_CODES.DUPLICATE_POST,
        message: 'Duplicate tweet content',
        retryable: false,
      };
    }

    // Media errors
    if (errorCode === 324 || errorCode === 325) {
      return {
        code: ERROR_CODES.INVALID_MEDIA,
        message: 'Invalid media format',
        retryable: false,
      };
    }

    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return {
        code: ERROR_CODES.NETWORK_ERROR,
        message: 'Network connection error',
        retryable: true,
      };
    }

    // Default unknown error
    return {
      code: ERROR_CODES.PLATFORM_ERROR,
      message: errorData.message || 'Twitter API error',
      retryable: false,
    };
  }

  /**
   * Helper: Make authenticated request to Twitter API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${TWITTER_API_BASE}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * Helper: Convert generic media type to Twitter media type
   */
  private getTwitterMediaType(mediaType: string): string {
    if (mediaType.startsWith('video/')) {
      return 'video/mp4';
    }
    return 'image/jpeg'; // Default to JPEG for images
  }

  /**
   * Helper: Calculate engagement rate
   */
  private calculateEngagementRate(metrics: any): number {
    const engagements = (metrics.like_count || 0) +
                       (metrics.reply_count || 0) +
                       (metrics.retweet_count || 0);
    const impressions = metrics.impression_count || 1;

    return engagements / impressions;
  }
}
