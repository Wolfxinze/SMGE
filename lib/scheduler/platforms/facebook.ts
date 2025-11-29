/**
 * Facebook Platform Integration
 *
 * Implements Facebook Graph API v18.0 for posting to Facebook Pages.
 * Supports text posts, image posts, multi-image posts, video posts, and link shares.
 *
 * API Documentation: https://developers.facebook.com/docs/graph-api
 */

import {
  BasePlatform,
  type PlatformCredentials,
  type MediaUploadResult,
} from './base';
import type {
  PublishResult,
  Post,
  PostingAnalytics,
  PlatformSpecificData,
} from '../types';
import { ERROR_CODES } from '../types';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';

/**
 * Facebook Token Response
 */
interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

/**
 * Facebook User/Page Info
 */
interface FacebookPageInfo {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
}

/**
 * Facebook Post Data
 */
interface FacebookPostData {
  message?: string;
  link?: string;
  published?: boolean;
  scheduled_publish_time?: number;
  targeting?: {
    geo_locations?: {
      countries?: string[];
    };
  };
}

/**
 * Facebook Post Response
 */
interface FacebookPostResponse {
  id: string;
  post_id?: string;
}

/**
 * Facebook Insights Response
 */
interface FacebookInsightsResponse {
  data: Array<{
    name: string;
    period: string;
    values: Array<{
      value: number;
    }>;
  }>;
}

/**
 * Facebook Platform Implementation
 */
export class FacebookPlatform extends BasePlatform {
  private pageId: string | null = null;
  private pageAccessToken: string | null = null;

  constructor(credentials: PlatformCredentials) {
    super('facebook', credentials);
  }

  /**
   * Set the Page ID and token for page posting
   */
  setPageCredentials(pageId: string, pageAccessToken: string): void {
    this.pageId = pageId;
    this.pageAccessToken = pageAccessToken;
  }

  /**
   * Validate Facebook credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.makeRequest('/me?fields=id,name');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh Facebook access token
   * Facebook long-lived tokens last 60 days and can be exchanged for new ones
   */
  async refreshAccessToken(): Promise<PlatformCredentials> {
    const clientId = process.env.FACEBOOK_CLIENT_ID!;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!;

    // Exchange for a new long-lived token
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: this.credentials.access_token,
    });

    const response = await fetch(`${FACEBOOK_API_BASE}/oauth/access_token?${params}`);

    if (!response.ok) {
      throw new Error('Failed to refresh Facebook token');
    }

    const data: FacebookTokenResponse = await response.json();

    // Long-lived tokens typically last 60 days
    const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000);

    return {
      access_token: data.access_token,
      expires_at: expiresAt,
      account_id: this.credentials.account_id,
      scopes: this.credentials.scopes,
    };
  }

  /**
   * Get user's Facebook Pages
   */
  async getPages(): Promise<FacebookPageInfo[]> {
    await this.ensureValidToken();

    const response = await this.makeRequest('/me/accounts?fields=id,name,access_token,category,tasks');

    if (!response.ok) {
      throw new Error('Failed to fetch Facebook pages');
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Upload media to Facebook
   */
  async uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]> {
    await this.ensureValidToken();
    const results: MediaUploadResult[] = [];

    const token = this.pageAccessToken || this.credentials.access_token;
    const targetId = this.pageId || this.credentials.account_id;

    for (const url of mediaUrls) {
      try {
        if (mediaType.startsWith('video')) {
          // Video upload uses different endpoint
          const result = await this.uploadVideo(url, targetId, token);
          results.push(result);
        } else {
          // Photo upload
          const result = await this.uploadPhoto(url, targetId, token);
          results.push(result);
        }
      } catch (error) {
        console.error('Facebook media upload error:', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Upload a photo to Facebook
   */
  private async uploadPhoto(
    url: string,
    targetId: string,
    token: string
  ): Promise<MediaUploadResult> {
    const response = await fetch(`${FACEBOOK_API_BASE}/${targetId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        published: false, // Upload without publishing
        access_token: token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload photo');
    }

    const data = await response.json();
    return {
      media_id: data.id,
      media_type: 'image',
    };
  }

  /**
   * Upload a video to Facebook
   */
  private async uploadVideo(
    url: string,
    targetId: string,
    token: string
  ): Promise<MediaUploadResult> {
    // Facebook video upload uses resumable upload API
    // Start by initializing the upload session
    const initResponse = await fetch(`${FACEBOOK_API_BASE}/${targetId}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_url: url,
        access_token: token,
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error?.message || 'Failed to upload video');
    }

    const data = await initResponse.json();
    return {
      media_id: data.id,
      media_type: 'video',
    };
  }

  /**
   * Publish post to Facebook Page
   */
  async publishPost(
    post: Post,
    platformData?: PlatformSpecificData
  ): Promise<PublishResult> {
    try {
      await this.ensureValidToken();
      await this.validateContent(post);

      const token = this.pageAccessToken || this.credentials.access_token;
      const targetId = this.pageId || this.credentials.account_id;

      // Determine post type and publish accordingly
      if (post.media_urls && post.media_urls.length > 0) {
        if (post.media_urls.length === 1) {
          // Single media post
          return await this.publishMediaPost(post, targetId, token);
        } else {
          // Multi-image post (album)
          return await this.publishAlbumPost(post, targetId, token);
        }
      }

      // Check if this is a link share
      const fbData = platformData as FacebookPostData | undefined;
      if (fbData?.link) {
        return await this.publishLinkPost(post, fbData.link, targetId, token);
      }

      // Text-only post
      return await this.publishTextPost(post, targetId, token);
    } catch (error: any) {
      const platformError = this.handlePlatformError(error);
      return {
        success: false,
        error: platformError,
      };
    }
  }

  /**
   * Publish text-only post
   */
  private async publishTextPost(
    post: Post,
    targetId: string,
    token: string
  ): Promise<PublishResult> {
    const message = this.formatPostText(post, this.getContentLimits().max_text_length);

    const response = await fetch(`${FACEBOOK_API_BASE}/${targetId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        access_token: token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    const data: FacebookPostResponse = await response.json();
    const postId = data.id;

    return {
      success: true,
      platform_post_id: postId,
      platform_url: `https://www.facebook.com/${postId}`,
    };
  }

  /**
   * Publish post with single image/video
   */
  private async publishMediaPost(
    post: Post,
    targetId: string,
    token: string
  ): Promise<PublishResult> {
    const message = this.formatPostText(post, this.getContentLimits().max_text_length);
    const mediaUrl = post.media_urls[0];
    const isVideo = this.isVideoUrl(mediaUrl);

    const endpoint = isVideo ? 'videos' : 'photos';

    const body: Record<string, any> = {
      access_token: token,
    };

    if (isVideo) {
      body.file_url = mediaUrl;
      body.description = message;
    } else {
      body.url = mediaUrl;
      body.message = message;
    }

    const response = await fetch(`${FACEBOOK_API_BASE}/${targetId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    const data: FacebookPostResponse = await response.json();
    const postId = data.post_id || data.id;

    return {
      success: true,
      platform_post_id: postId,
      platform_url: `https://www.facebook.com/${postId}`,
    };
  }

  /**
   * Publish multi-image album post
   */
  private async publishAlbumPost(
    post: Post,
    targetId: string,
    token: string
  ): Promise<PublishResult> {
    const message = this.formatPostText(post, this.getContentLimits().max_text_length);

    // First, upload all photos as unpublished
    const photoIds: string[] = [];
    for (const url of post.media_urls) {
      const uploadResponse = await fetch(`${FACEBOOK_API_BASE}/${targetId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          published: false,
          access_token: token,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo for album');
      }

      const uploadData = await uploadResponse.json();
      photoIds.push(uploadData.id);
    }

    // Create the album post with all photos
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));

    const response = await fetch(`${FACEBOOK_API_BASE}/${targetId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        attached_media: attachedMedia,
        access_token: token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    const data: FacebookPostResponse = await response.json();
    const postId = data.id;

    return {
      success: true,
      platform_post_id: postId,
      platform_url: `https://www.facebook.com/${postId}`,
    };
  }

  /**
   * Publish link share post
   */
  private async publishLinkPost(
    post: Post,
    link: string,
    targetId: string,
    token: string
  ): Promise<PublishResult> {
    const message = this.formatPostText(post, this.getContentLimits().max_text_length);

    const response = await fetch(`${FACEBOOK_API_BASE}/${targetId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        link,
        access_token: token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    const data: FacebookPostResponse = await response.json();
    const postId = data.id;

    return {
      success: true,
      platform_post_id: postId,
      platform_url: `https://www.facebook.com/${postId}`,
    };
  }

  /**
   * Delete post from Facebook
   */
  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.ensureValidToken();

      const token = this.pageAccessToken || this.credentials.access_token;

      const response = await fetch(`${FACEBOOK_API_BASE}/${platformPostId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: token,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch analytics for a post
   */
  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    try {
      await this.ensureValidToken();

      const token = this.pageAccessToken || this.credentials.access_token;

      // Fetch post insights
      const response = await fetch(
        `${FACEBOOK_API_BASE}/${platformPostId}/insights?` +
        `metric=post_impressions,post_impressions_unique,post_engaged_users,` +
        `post_clicks,post_reactions_by_type_total&access_token=${token}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch post insights');
      }

      const data: FacebookInsightsResponse = await response.json();
      const metrics: Record<string, number> = {};

      for (const metric of data.data) {
        if (metric.values && metric.values.length > 0) {
          metrics[metric.name] = metric.values[0].value;
        }
      }

      // Also fetch basic engagement data
      const engagementResponse = await fetch(
        `${FACEBOOK_API_BASE}/${platformPostId}?fields=shares,comments.summary(true),reactions.summary(true)&access_token=${token}`
      );

      let shares = 0;
      let comments = 0;
      let likes = 0;

      if (engagementResponse.ok) {
        const engagementData = await engagementResponse.json();
        shares = engagementData.shares?.count || 0;
        comments = engagementData.comments?.summary?.total_count || 0;
        likes = engagementData.reactions?.summary?.total_count || 0;
      }

      return {
        platform: 'facebook',
        impressions: metrics.post_impressions || 0,
        reach: metrics.post_impressions_unique || 0,
        likes,
        comments,
        shares,
        clicks: metrics.post_clicks || 0,
        engagement_rate: this.calculateEngagementRate(
          metrics.post_engaged_users || 0,
          metrics.post_impressions || 1
        ),
      };
    } catch (error) {
      console.error('Failed to fetch Facebook analytics:', error);
      return {};
    }
  }

  /**
   * Get Facebook Page information
   */
  async getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }> {
    await this.ensureValidToken();

    const token = this.pageAccessToken || this.credentials.access_token;
    const targetId = this.pageId || 'me';

    const response = await fetch(
      `${FACEBOOK_API_BASE}/${targetId}?fields=id,name,followers_count,link&access_token=${token}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Facebook account info');
    }

    const data = await response.json();

    return {
      account_id: data.id,
      account_name: data.name,
      follower_count: data.followers_count,
      profile_url: data.link || `https://www.facebook.com/${data.id}`,
    };
  }

  /**
   * Validate post content
   */
  async validateContent(post: Post): Promise<void> {
    const limits = this.getContentLimits();

    // Check text length
    if (post.body.length > limits.max_text_length) {
      throw new Error(`Post text exceeds maximum length of ${limits.max_text_length} characters`);
    }

    // Check media count
    if (post.media_urls && post.media_urls.length > limits.max_media_count) {
      throw new Error(`Post can have maximum ${limits.max_media_count} media items`);
    }

    // Validate media URLs
    if (post.media_urls && post.media_urls.length > 0) {
      await this.validateMediaUrls(post.media_urls);
    }
  }

  /**
   * Get Facebook content limits
   */
  getContentLimits() {
    return {
      max_text_length: 63206, // Facebook's limit
      max_media_count: 10, // Max photos in an album
      max_hashtags: 30, // Recommended limit
      supported_media_types: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'],
    };
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(_endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }> {
    await this.ensureValidToken();

    // Facebook uses application-level rate limiting
    // We track this based on API responses
    const response = await this.makeRequest('/me?fields=id');

    const usageHeader = response.headers.get('x-app-usage');
    if (usageHeader) {
      try {
        const usage = JSON.parse(usageHeader);
        const percentUsed = Math.max(
          usage.call_count || 0,
          usage.total_cputime || 0,
          usage.total_time || 0
        );

        return {
          remaining: Math.floor((100 - percentUsed) * 2), // Approximate remaining calls
          limit: 200, // Facebook's typical app-level limit
          resets_at: new Date(Date.now() + 3600 * 1000), // Resets hourly
        };
      } catch {
        // Fallback if parsing fails
      }
    }

    // Default fallback
    return {
      remaining: 100,
      limit: 200,
      resets_at: new Date(Date.now() + 3600 * 1000),
    };
  }

  /**
   * Handle Facebook API errors
   */
  protected handlePlatformError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorData = error.error || error;
    const errorCode = errorData.code;
    const errorSubcode = errorData.error_subcode;

    // Rate limit errors
    if (errorCode === 4 || errorCode === 17 || errorCode === 32) {
      return {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Facebook API rate limit exceeded',
        retryable: true,
      };
    }

    // Authentication errors
    if (errorCode === 190) {
      // Token errors
      if (errorSubcode === 458 || errorSubcode === 460) {
        return {
          code: ERROR_CODES.TOKEN_EXPIRED,
          message: 'Facebook access token has expired',
          retryable: false,
        };
      }
      return {
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Facebook authentication failed',
        retryable: false,
      };
    }

    // Duplicate content
    if (errorCode === 506) {
      return {
        code: ERROR_CODES.DUPLICATE_POST,
        message: 'Duplicate post content',
        retryable: false,
      };
    }

    // Permission errors
    if (errorCode === 10 || errorCode === 200 || errorCode === 220) {
      return {
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Insufficient permissions for this action',
        retryable: false,
      };
    }

    // Media errors
    if (errorCode === 324 || errorCode === 352) {
      return {
        code: ERROR_CODES.INVALID_MEDIA,
        message: 'Invalid media format or URL',
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
      message: errorData.message || 'Facebook API error',
      retryable: false,
    };
  }

  /**
   * Helper: Make authenticated request to Facebook API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = this.pageAccessToken || this.credentials.access_token;
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${FACEBOOK_API_BASE}${endpoint}${separator}access_token=${token}`;

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * Helper: Check if URL is a video
   */
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext));
  }

  /**
   * Helper: Calculate engagement rate
   */
  private calculateEngagementRate(engagedUsers: number, impressions: number): number {
    if (impressions === 0) return 0;
    return engagedUsers / impressions;
  }
}
