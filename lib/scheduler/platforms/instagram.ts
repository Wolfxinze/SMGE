/**
 * Instagram Platform Integration
 *
 * Implements Instagram Graph API v18.0 for publishing posts, reels, stories, and carousels.
 * Uses Facebook Business account connection and Container-based media uploads.
 *
 * API Documentation: https://developers.facebook.com/docs/instagram-api/
 *
 * Supported content types:
 * - FEED: Single image/video or carousel (up to 10 items)
 * - STORIES: Single image/video (24-hour ephemeral content)
 * - REELS: Short-form video (up to 15 minutes)
 *
 * Publishing flow (Container API):
 * 1. Create media container with content URL
 * 2. Wait for container to be ready (status check)
 * 3. Publish the container
 *
 * Key Requirements:
 * - Instagram Business or Creator account connected to Facebook Page
 * - Facebook App with instagram_basic, instagram_content_publish permissions
 * - Long-lived tokens via Facebook token exchange (60 days validity)
 *
 * SECURITY: All API calls use Authorization header instead of URL parameters
 * to prevent token leakage in logs and browser history.
 */

import {
  BasePlatform,
  type PlatformCredentials,
  type MediaUploadResult,
} from './base';
import type {
  PublishResult,
  Post,
  InstagramPostData,
  PostingAnalytics,
  PlatformSpecificData,
} from '../types';
import { ERROR_CODES } from '../types';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Content limits
const MAX_CAPTION_LENGTH = 2200;
const MAX_HASHTAGS = 30;
const MAX_CAROUSEL_ITEMS = 10;
const MAX_MENTIONS = 20;

// Video duration limits (in seconds)
const FEED_VIDEO_MIN_DURATION = 3;
const FEED_VIDEO_MAX_DURATION = 3600; // 60 minutes for feed
const STORY_VIDEO_MAX_DURATION = 60; // 60 seconds for stories
const REEL_VIDEO_MIN_DURATION = 3;
const REEL_VIDEO_MAX_DURATION = 900; // 15 minutes for reels

// Container status polling
const CONTAINER_POLL_INTERVAL = 5000; // 5 seconds
const CONTAINER_MAX_POLLS = 30; // 2.5 minutes max wait

type ContainerStatus = 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED';

interface ContainerStatusResponse {
  id: string;
  status_code: ContainerStatus;
  status?: string;
}

export class InstagramPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('instagram', credentials);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.makeRequest(`/${this.credentials.account_id}?fields=id,username`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh Instagram access token
   * Instagram uses Facebook's OAuth system - long-lived tokens last 60 days
   * SECURITY: Uses POST with body parameters instead of URL query params
   */
  async refreshAccessToken(): Promise<PlatformCredentials> {
    const clientId = process.env.FACEBOOK_APP_ID!;
    const clientSecret = process.env.FACEBOOK_APP_SECRET!;

    const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: this.credentials.access_token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to refresh Instagram token: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Long-lived tokens typically last 60 days (5184000 seconds)
    return {
      access_token: data.access_token,
      refresh_token: this.credentials.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      account_id: this.credentials.account_id,
      scopes: this.credentials.scopes,
    };
  }

  /**
   * Upload media to Instagram
   * Note: Instagram requires publicly accessible URLs for media
   * This method creates containers for the media items
   * SECURITY: Uses Authorization header instead of URL/body token parameter
   */
  async uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]> {
    await this.ensureValidToken();
    const results: MediaUploadResult[] = [];

    for (const url of mediaUrls) {
      const igMediaType = mediaType.startsWith('video') ? 'VIDEO' : 'IMAGE';

      const containerBody: Record<string, string> = {};

      if (igMediaType === 'IMAGE') {
        containerBody.image_url = url;
      } else {
        containerBody.video_url = url;
        containerBody.media_type = 'REELS';
      }

      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(containerBody),
        }
      );

      if (!containerResponse.ok) {
        const error = await containerResponse.json();
        throw new Error(`Failed to create media container: ${error.error?.message}`);
      }

      const containerData = await containerResponse.json();
      const containerId = containerData.id;

      if (igMediaType === 'VIDEO') {
        await this.pollContainerStatus(containerId);
      }

      results.push({
        media_id: containerId,
        media_url: url,
        media_type: igMediaType,
      });
    }

    return results;
  }

  /**
   * Publish post to Instagram
   * Supports: Feed posts (single/carousel), Reels, Stories
   * SECURITY: Uses Authorization header for all API calls
   */
  async publishPost(
    post: Post,
    platformData?: PlatformSpecificData
  ): Promise<PublishResult> {
    try {
      await this.ensureValidToken();
      await this.validateContent(post);

      const igData = platformData as InstagramPostData | undefined;
      const caption = this.formatPostText(post, this.getContentLimits().max_text_length);

      if (!post.media_urls || post.media_urls.length === 0) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_MEDIA,
            message: 'Instagram posts require at least one image or video',
            retryable: false,
          },
        };
      }

      let containerId: string;

      // Determine content type based on post data
      const contentType = this.determineContentType(post, igData);

      switch (contentType) {
        case 'STORIES':
          containerId = await this.createStoryContainer(post.media_urls[0]);
          break;
        case 'REELS':
          containerId = await this.createReelContainer(post.media_urls[0], caption, igData);
          break;
        case 'CAROUSEL_ALBUM':
          containerId = await this.createCarouselContainer(post.media_urls, caption, igData);
          break;
        default:
          containerId = await this.createSingleMediaContainer(post.media_urls[0], caption, igData);
      }

      // Publish the container
      const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${this.credentials.account_id}/media_publish`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creation_id: containerId,
          }),
        }
      );

      if (!publishResponse.ok) {
        const error = await publishResponse.json();
        throw error;
      }

      const publishData = await publishResponse.json();
      const mediaId = publishData.id;

      const permalinkResponse = await this.makeRequest(`/${mediaId}?fields=permalink`);
      const permalinkData = await permalinkResponse.json();

      return {
        success: true,
        platform_post_id: mediaId,
        platform_url: permalinkData.permalink,
      };
    } catch (error: unknown) {
      const platformError = this.handlePlatformError(error);
      return { success: false, error: platformError };
    }
  }

  /**
   * Determine Instagram content type based on post and platform data
   */
  private determineContentType(
    post: Post,
    igData?: InstagramPostData
  ): 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORIES' | 'REELS' {
    // Check if explicitly specified in platform data
    if (igData?.media_type) {
      return igData.media_type;
    }

    // Check content_type from post
    if (post.content_type === 'reel') {
      return 'REELS';
    }

    if (post.content_type === 'story') {
      return 'STORIES';
    }

    // Multiple media items = carousel
    if (post.media_urls.length > 1) {
      return 'CAROUSEL_ALBUM';
    }

    // Single media - check if video
    const mediaUrl = post.media_urls[0];
    return this.isVideoUrl(mediaUrl) ? 'VIDEO' : 'IMAGE';
  }

  /**
   * Create a Story container
   * SECURITY: Uses Authorization header
   */
  private async createStoryContainer(mediaUrl: string): Promise<string> {
    const isVideo = this.isVideoUrl(mediaUrl);
    const body: Record<string, string> = {
      media_type: 'STORIES',
    };

    if (isVideo) {
      body.video_url = mediaUrl;
    } else {
      body.image_url = mediaUrl;
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Story container: ${error.error?.message}`);
    }

    const data = await response.json();
    if (isVideo) {
      await this.pollContainerStatus(data.id);
    }
    return data.id;
  }

  /**
   * Create a Reel container
   * SECURITY: Uses Authorization header
   */
  private async createReelContainer(
    videoUrl: string,
    caption: string,
    igData?: InstagramPostData
  ): Promise<string> {
    const body: Record<string, any> = {
      video_url: videoUrl,
      media_type: 'REELS',
      caption,
      share_to_feed: true,
    };

    if (igData?.location_id) {
      body.location_id = igData.location_id;
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Reel container: ${error.error?.message}`);
    }

    const data = await response.json();
    await this.pollContainerStatus(data.id);
    return data.id;
  }

  /**
   * Delete post from Instagram
   * Note: Instagram API supports deletion for Business accounts
   * SECURITY: Uses Authorization header
   */
  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${GRAPH_API_BASE}/${platformPostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch analytics for an Instagram post
   * SECURITY: Uses Authorization header for all API calls
   */
  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    try {
      await this.ensureValidToken();

      // Request insights - different metrics available for different media types
      const metrics = 'impressions,reach,engagement,saved,video_views,plays,shares';
      const response = await this.makeRequest(
        `/${platformPostId}/insights?metric=${metrics}`
      );

      if (!response.ok) {
        // Fall back to basic engagement data if insights not available
        const basicResponse = await this.makeRequest(`/${platformPostId}?fields=like_count,comments_count`);
        if (!basicResponse.ok) throw new Error('Failed to fetch Instagram analytics');

        const basicData = await basicResponse.json();
        return {
          platform: 'instagram',
          likes: basicData.like_count || 0,
          comments: basicData.comments_count || 0,
        };
      }

      const data = await response.json();
      const insightMetrics: Record<string, number> = {};

      for (const insight of data.data || []) {
        if (insight.values && insight.values.length > 0) {
          insightMetrics[insight.name] = insight.values[0].value;
        }
      }

      // Also fetch basic engagement data
      const basicResponse = await this.makeRequest(`/${platformPostId}?fields=like_count,comments_count`);
      const basicData = await basicResponse.json();

      return {
        platform: 'instagram',
        impressions: insightMetrics.impressions || 0,
        reach: insightMetrics.reach || 0,
        likes: basicData.like_count || 0,
        comments: basicData.comments_count || 0,
        saves: insightMetrics.saved || 0,
        shares: insightMetrics.shares || 0,
        engagement_rate: this.calculateEngagementRate(insightMetrics, basicData),
        video_views: insightMetrics.video_views || insightMetrics.plays || null,
      };
    } catch (error) {
      console.error('Failed to fetch Instagram analytics:', error);
      return {};
    }
  }

  /**
   * Get Instagram account information
   * SECURITY: Uses Authorization header
   */
  async getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }> {
    await this.ensureValidToken();

    const response = await this.makeRequest(
      `/${this.credentials.account_id}?fields=id,username,name,followers_count,profile_picture_url,biography`
    );

    if (!response.ok) throw new Error('Failed to fetch Instagram account info');

    const data = await response.json();

    return {
      account_id: data.id,
      account_name: data.username,
      follower_count: data.followers_count,
      profile_url: `https://www.instagram.com/${data.username}/`,
    };
  }

  /**
   * Validate post content against Instagram limits
   */
  async validateContent(post: Post): Promise<void> {
    const limits = this.getContentLimits();

    // Instagram requires media
    if (!post.media_urls || post.media_urls.length === 0) {
      throw new Error('Instagram posts require at least one image or video');
    }

    // Check caption length (including hashtags)
    const fullCaption = this.formatPostText(post, limits.max_text_length + 1); // +1 to detect overflow
    if (fullCaption.length > limits.max_text_length) {
      throw new Error(`Caption exceeds maximum length of ${limits.max_text_length} characters`);
    }

    // Check media count
    if (post.media_urls.length > limits.max_media_count) {
      throw new Error(`Instagram carousel can have maximum ${limits.max_media_count} items`);
    }

    // Check hashtag count
    if (post.hashtags && post.hashtags.length > limits.max_hashtags) {
      throw new Error(`Instagram posts can have maximum ${limits.max_hashtags} hashtags`);
    }

    // Check mention count
    if (post.mentions && post.mentions.length > MAX_MENTIONS) {
      throw new Error(`Instagram posts can have maximum ${MAX_MENTIONS} mentions`);
    }

    // Validate media URLs are accessible
    await this.validateMediaUrls(post.media_urls);
  }

  /**
   * Get Instagram content limits
   */
  getContentLimits() {
    return {
      max_text_length: MAX_CAPTION_LENGTH,
      max_media_count: MAX_CAROUSEL_ITEMS,
      max_hashtags: MAX_HASHTAGS,
      supported_media_types: [
        'image/jpeg',
        'image/png',
        'image/gif', // Will be converted to static image
        'video/mp4',
        'video/quicktime',
      ],
      // Extended limits for reference
      feed_video_duration: {
        min: FEED_VIDEO_MIN_DURATION,
        max: FEED_VIDEO_MAX_DURATION,
      },
      story_video_duration: {
        max: STORY_VIDEO_MAX_DURATION,
      },
      reel_video_duration: {
        min: REEL_VIDEO_MIN_DURATION,
        max: REEL_VIDEO_MAX_DURATION,
      },
      max_mentions: MAX_MENTIONS,
    };
  }

  /**
   * Get rate limit status for Instagram
   * SECURITY: Uses Authorization header
   */
  async getRateLimitStatus(_endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }> {
    await this.ensureValidToken();

    // Instagram uses the same app-level rate limiting as Facebook
    const response = await this.makeRequest('/me?fields=id');

    const rateLimitUsage = response.headers.get('x-app-usage');
    let remaining = 25; // Default for content publishing

    if (rateLimitUsage) {
      try {
        const usage = JSON.parse(rateLimitUsage);
        const percentUsed = Math.max(
          usage.call_count || 0,
          usage.total_cputime || 0,
          usage.total_time || 0
        );
        // Instagram has a 25 posts/day limit for content publishing
        remaining = Math.floor((100 - percentUsed) * 0.25);
      } catch {
        // Use defaults
      }
    }

    return {
      remaining,
      limit: 25, // Instagram's content publishing limit per day
      resets_at: new Date(Date.now() + 86400 * 1000), // Resets daily
    };
  }

  protected handlePlatformError(error: unknown): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorObj = error as Record<string, unknown>;
    const errorData = (errorObj.error || errorObj) as Record<string, unknown>;
    const errorCode = errorData.code as number | undefined;
    const errorSubcode = errorData.error_subcode as number | undefined;

    if (errorCode === 4 || errorCode === 17 || errorCode === 32) {
      return { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: 'Instagram API rate limit exceeded', retryable: true };
    }

    if (errorCode === 190) {
      if (errorSubcode === 463 || errorSubcode === 467) {
        return { code: ERROR_CODES.TOKEN_EXPIRED, message: 'Instagram access token has expired', retryable: false };
      }
      return { code: ERROR_CODES.INVALID_TOKEN, message: 'Instagram authentication failed', retryable: false };
    }

    if (errorCode === 200 || errorCode === 10) {
      return { code: ERROR_CODES.INVALID_TOKEN, message: 'Insufficient permissions for Instagram', retryable: false };
    }

    if (errorCode === 36003) {
      return { code: ERROR_CODES.INVALID_MEDIA, message: 'Invalid media format for Instagram', retryable: false };
    }

    if (errorCode === 36000) {
      return { code: ERROR_CODES.DUPLICATE_POST, message: 'Duplicate content detected', retryable: false };
    }

    if (errorCode === 368) {
      return { code: ERROR_CODES.ACCOUNT_SUSPENDED, message: 'Instagram account is restricted', retryable: false };
    }

    if (errorCode === 1 || errorCode === 2) {
      return { code: ERROR_CODES.NETWORK_ERROR, message: 'Instagram API service unavailable', retryable: true };
    }

    return {
      code: ERROR_CODES.PLATFORM_ERROR,
      message: (errorData.message as string) || 'Instagram API error',
      retryable: false,
    };
  }

  /**
   * Helper: Make authenticated request to Instagram Graph API
   * SECURITY: Uses Authorization header instead of URL parameters to prevent token leakage
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE}${endpoint}`;

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
   * Create a single image or video container
   * SECURITY: Uses Authorization header
   */
  private async createSingleMediaContainer(
    mediaUrl: string,
    caption: string,
    igData?: InstagramPostData
  ): Promise<string> {
    const isVideo = this.isVideoUrl(mediaUrl);
    const body: Record<string, any> = { caption };

    if (isVideo) {
      body.video_url = mediaUrl;
      body.media_type = 'VIDEO';
    } else {
      body.image_url = mediaUrl;
    }

    if (igData?.location_id) {
      body.location_id = igData.location_id;
    }

    if (igData?.user_tags && igData.user_tags.length > 0) {
      body.user_tags = igData.user_tags.map(tag => ({
        username: tag.username,
        x: tag.x,
        y: tag.y,
      }));
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create media container: ${error.error?.message}`);
    }

    const data = await response.json();
    if (isVideo) {
      await this.pollContainerStatus(data.id);
    }
    return data.id;
  }

  /**
   * Create a carousel container from multiple media items
   * SECURITY: Uses Authorization header
   */
  private async createCarouselContainer(
    mediaUrls: string[],
    caption: string,
    igData?: InstagramPostData
  ): Promise<string> {
    const childContainerIds: string[] = [];

    // Create containers for each carousel item (max 10)
    for (const url of mediaUrls.slice(0, MAX_CAROUSEL_ITEMS)) {
      const isVideo = this.isVideoUrl(url);
      const childBody: Record<string, any> = {
        is_carousel_item: true,
      };

      if (isVideo) {
        childBody.video_url = url;
        childBody.media_type = 'VIDEO';
      } else {
        childBody.image_url = url;
      }

      const response = await fetch(
        `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(childBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create carousel item: ${error.error?.message}`);
      }

      const data = await response.json();
      if (isVideo) {
        await this.pollContainerStatus(data.id);
      }
      childContainerIds.push(data.id);
    }

    // Create the carousel parent container
    const carouselBody: Record<string, any> = {
      media_type: 'CAROUSEL',
      caption,
      children: childContainerIds.join(','),
    };

    if (igData?.location_id) {
      carouselBody.location_id = igData.location_id;
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(carouselBody),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create carousel container: ${error.error?.message}`);
    }

    return (await response.json()).id;
  }

  /**
   * Poll for container processing status
   * Instagram requires waiting for video processing before publishing
   * SECURITY: Uses makeRequest which includes Authorization header
   */
  private async pollContainerStatus(
    containerId: string,
    maxAttempts = CONTAINER_MAX_POLLS,
    intervalMs = CONTAINER_POLL_INTERVAL
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.makeRequest(`/${containerId}?fields=status_code,status`);
      if (!response.ok) throw new Error('Failed to check container status');

      const data: ContainerStatusResponse = await response.json();

      switch (data.status_code) {
        case 'FINISHED':
          return;
        case 'ERROR':
          throw new Error(`Media processing failed: ${data.status || 'Unknown error'}`);
        case 'EXPIRED':
          throw new Error('Media container expired before publishing');
        case 'IN_PROGRESS':
          await this.sleep(intervalMs);
          break;
      }
    }
    throw new Error('Media processing timeout - container did not finish in time');
  }

  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  private calculateEngagementRate(insights: Record<string, number>, basicData: Record<string, unknown>): number {
    const engagements = ((basicData.like_count as number) || 0) +
      ((basicData.comments_count as number) || 0) + (insights.saved || 0);
    return engagements / (insights.reach || 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Instagram OAuth Helper
 * Utility functions for Instagram OAuth flow via Facebook
 *
 * Instagram Business/Creator accounts must be linked to Facebook Pages,
 * so authentication goes through Facebook's OAuth system.
 *
 * SECURITY: All methods use Authorization header where possible
 */
export class InstagramOAuthHelper {
  private static readonly GRAPH_API_BASE = GRAPH_API_BASE;

  /**
   * Generate Instagram authorization URL (via Facebook OAuth)
   */
  static getAuthorizationUrl(appId: string, redirectUri: string, state: string): string {
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ];

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params}`;
  }

  /**
   * Exchange authorization code for access token
   * SECURITY: Uses POST with body parameters instead of URL query params
   */
  static async exchangeCodeForToken(
    code: string,
    appId: string,
    appSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch(`${this.GRAPH_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error?.message}`);
    }
    return response.json();
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   * SECURITY: Uses POST with body parameters instead of URL query params
   */
  static async getLongLivedToken(
    shortLivedToken: string,
    appId: string,
    appSecret: string
  ): Promise<{ access_token: string; expires_in: number; token_type: string }> {
    const response = await fetch(`${this.GRAPH_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Long-lived token exchange failed: ${error.error?.message}`);
    }
    return response.json();
  }

  /**
   * Get all Instagram Business accounts linked to user's Facebook pages
   * SECURITY: Uses Authorization header
   */
  static async getInstagramBusinessAccounts(userAccessToken: string): Promise<Array<{
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
    followers_count?: number;
    page_id: string;
    page_name: string;
    page_access_token: string;
  }>> {
    const pagesResponse = await fetch(
      `${this.GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}`,
      {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
        },
      }
    );

    if (!pagesResponse.ok) {
      const error = await pagesResponse.json();
      throw new Error(`Failed to get Facebook Pages: ${error.error?.message}`);
    }

    const pagesData = await pagesResponse.json();
    const accounts: Array<{
      id: string;
      username: string;
      name: string;
      profile_picture_url?: string;
      followers_count?: number;
      page_id: string;
      page_name: string;
      page_access_token: string;
    }> = [];

    for (const page of pagesData.data || []) {
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        accounts.push({
          id: ig.id,
          username: ig.username,
          name: ig.name || ig.username,
          profile_picture_url: ig.profile_picture_url,
          followers_count: ig.followers_count,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
        });
      }
    }
    return accounts;
  }

  /**
   * Get Page access token for a specific Facebook page
   * SECURITY: Uses Authorization header
   */
  static async getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
    const response = await fetch(
      `${this.GRAPH_API_BASE}/${pageId}?fields=access_token`,
      {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Page access token: ${error.error?.message}`);
    }
    return (await response.json()).access_token;
  }

  /**
   * Verify Instagram permissions are granted
   * SECURITY: Uses Authorization header
   */
  static async verifyPermissions(
    accessToken: string
  ): Promise<{
    valid: boolean;
    granted_permissions: string[];
    missing_permissions: string[];
  }> {
    const requiredPermissions = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
    ];

    const response = await fetch(
      `${this.GRAPH_API_BASE}/me/permissions`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to verify permissions');
    }

    const data = await response.json();
    const permissions = data.data || [];
    const grantedPermissions = permissions
      .filter((p: { status: string }) => p.status === 'granted')
      .map((p: { permission: string }) => p.permission);

    const missingRequired = requiredPermissions.filter(
      p => !grantedPermissions.includes(p)
    );

    return {
      valid: missingRequired.length === 0,
      granted_permissions: grantedPermissions,
      missing_permissions: missingRequired,
    };
  }
}
