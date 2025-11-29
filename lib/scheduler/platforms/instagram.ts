/**
 * Instagram Platform Integration
 *
 * Implements Instagram Graph API for publishing posts, reels, and carousels.
 * Uses Facebook Business account connection and Container-based media uploads.
 *
 * API Documentation: https://developers.facebook.com/docs/instagram-api/
 *
 * Key Requirements:
 * - Instagram Business or Creator account connected to Facebook Page
 * - Facebook App with instagram_basic, instagram_content_publish permissions
 * - Long-lived tokens via Facebook token exchange (60 days validity)
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

  async refreshAccessToken(): Promise<PlatformCredentials> {
    const clientId = process.env.FACEBOOK_APP_ID!;
    const clientSecret = process.env.FACEBOOK_APP_SECRET!;

    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: this.credentials.access_token,
      })
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to refresh Instagram token: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: this.credentials.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      account_id: this.credentials.account_id,
      scopes: this.credentials.scopes,
    };
  }

  async uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]> {
    await this.ensureValidToken();
    const results: MediaUploadResult[] = [];

    for (const url of mediaUrls) {
      const igMediaType = mediaType.startsWith('video') ? 'VIDEO' : 'IMAGE';

      const containerParams: Record<string, string> = {
        access_token: this.credentials.access_token,
      };

      if (igMediaType === 'IMAGE') {
        containerParams.image_url = url;
      } else {
        containerParams.video_url = url;
        containerParams.media_type = 'REELS';
      }

      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(containerParams),
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

      if (post.media_urls.length === 1) {
        containerId = await this.createSingleMediaContainer(post.media_urls[0], caption, igData);
      } else {
        containerId = await this.createCarouselContainer(post.media_urls, caption, igData);
      }

      const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${this.credentials.account_id}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            creation_id: containerId,
            access_token: this.credentials.access_token,
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

  async deletePost(_platformPostId: string): Promise<boolean> {
    console.warn('Instagram API does not support programmatic post deletion');
    return false;
  }

  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    try {
      await this.ensureValidToken();

      const response = await this.makeRequest(
        `/${platformPostId}/insights?metric=impressions,reach,engagement,saved,video_views&access_token=${this.credentials.access_token}`
      );

      if (!response.ok) {
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
      const metrics: Record<string, number> = {};

      for (const insight of data.data || []) {
        if (insight.values && insight.values.length > 0) {
          metrics[insight.name] = insight.values[0].value;
        }
      }

      const basicResponse = await this.makeRequest(`/${platformPostId}?fields=like_count,comments_count`);
      const basicData = await basicResponse.json();

      return {
        platform: 'instagram',
        impressions: metrics.impressions || 0,
        reach: metrics.reach || 0,
        likes: basicData.like_count || 0,
        comments: basicData.comments_count || 0,
        saves: metrics.saved || 0,
        engagement_rate: this.calculateEngagementRate(metrics, basicData),
        video_views: metrics.video_views || null,
      };
    } catch (error) {
      console.error('Failed to fetch Instagram analytics:', error);
      return {};
    }
  }

  async getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }> {
    await this.ensureValidToken();

    const response = await this.makeRequest(
      `/${this.credentials.account_id}?fields=id,username,followers_count,profile_picture_url`
    );

    if (!response.ok) throw new Error('Failed to fetch Instagram account info');

    const data = await response.json();

    return {
      account_id: data.id,
      account_name: data.username,
      follower_count: data.followers_count,
      profile_url: `https://instagram.com/${data.username}`,
    };
  }

  async validateContent(post: Post): Promise<void> {
    const limits = this.getContentLimits();

    if (post.body.length > limits.max_text_length) {
      throw new Error(`Caption exceeds maximum length of ${limits.max_text_length} characters`);
    }

    if (post.media_urls && post.media_urls.length > limits.max_media_count) {
      throw new Error(`Post can have maximum ${limits.max_media_count} media items`);
    }

    if (post.hashtags && post.hashtags.length > limits.max_hashtags) {
      throw new Error(`Post can have maximum ${limits.max_hashtags} hashtags`);
    }

    if (!post.media_urls || post.media_urls.length === 0) {
      throw new Error('Instagram posts require at least one image or video');
    }

    await this.validateMediaUrls(post.media_urls);
  }

  getContentLimits() {
    return {
      max_text_length: 2200,
      max_media_count: 10,
      max_hashtags: 30,
      supported_media_types: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }

  async getRateLimitStatus(_endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?fields=id&access_token=${this.credentials.access_token}`
    );

    const rateLimitUsage = response.headers.get('x-app-usage');
    let remaining = 200;

    if (rateLimitUsage) {
      try {
        const usage = JSON.parse(rateLimitUsage);
        const callCount = usage.call_count || 0;
        remaining = Math.max(0, 200 - (200 * callCount / 100));
      } catch {
        // Use defaults
      }
    }

    return { remaining, limit: 200, resets_at: new Date(Date.now() + 3600000) };
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

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE}${endpoint}`;
    const urlWithToken = url.includes('access_token')
      ? url
      : `${url}${url.includes('?') ? '&' : '?'}access_token=${this.credentials.access_token}`;

    return fetch(urlWithToken, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  }

  private async createSingleMediaContainer(
    mediaUrl: string,
    caption: string,
    igData?: InstagramPostData
  ): Promise<string> {
    const isVideo = this.isVideoUrl(mediaUrl);
    const params: Record<string, string> = { caption, access_token: this.credentials.access_token };

    if (isVideo) {
      params.video_url = mediaUrl;
      params.media_type = 'REELS';
    } else {
      params.image_url = mediaUrl;
    }

    if (igData?.location_id) params.location_id = igData.location_id;

    if (igData?.user_tags && igData.user_tags.length > 0) {
      params.user_tags = JSON.stringify(igData.user_tags.map(tag => ({
        username: tag.username, x: tag.x, y: tag.y,
      })));
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create media container: ${error.error?.message}`);
    }

    const data = await response.json();
    if (isVideo) await this.pollContainerStatus(data.id);
    return data.id;
  }

  private async createCarouselContainer(
    mediaUrls: string[],
    caption: string,
    igData?: InstagramPostData
  ): Promise<string> {
    const childContainerIds: string[] = [];

    for (const url of mediaUrls) {
      const isVideo = this.isVideoUrl(url);
      const params: Record<string, string> = {
        is_carousel_item: 'true',
        access_token: this.credentials.access_token,
      };

      if (isVideo) {
        params.video_url = url;
        params.media_type = 'VIDEO';
      } else {
        params.image_url = url;
      }

      const response = await fetch(
        `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create carousel item: ${error.error?.message}`);
      }

      const data = await response.json();
      if (isVideo) await this.pollContainerStatus(data.id);
      childContainerIds.push(data.id);
    }

    const carouselParams: Record<string, string> = {
      media_type: 'CAROUSEL',
      caption,
      children: childContainerIds.join(','),
      access_token: this.credentials.access_token,
    };

    if (igData?.location_id) carouselParams.location_id = igData.location_id;

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.credentials.account_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(carouselParams),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create carousel container: ${error.error?.message}`);
    }

    return (await response.json()).id;
  }

  private async pollContainerStatus(containerId: string, maxAttempts = 30, intervalMs = 5000): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.makeRequest(`/${containerId}?fields=status_code,status`);
      if (!response.ok) throw new Error('Failed to check container status');

      const data: ContainerStatusResponse = await response.json();

      switch (data.status_code) {
        case 'FINISHED': return;
        case 'ERROR': throw new Error(`Media processing failed: ${data.status || 'Unknown error'}`);
        case 'EXPIRED': throw new Error('Media container expired before publishing');
        case 'IN_PROGRESS': await this.sleep(intervalMs); break;
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

export class InstagramOAuthHelper {
  private static readonly GRAPH_API_BASE = GRAPH_API_BASE;

  static getAuthorizationUrl(appId: string, redirectUri: string, state: string): string {
    const scopes = [
      'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments',
      'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement', 'business_management',
    ];

    const params = new URLSearchParams({
      client_id: appId, redirect_uri: redirectUri, scope: scopes.join(','), response_type: 'code', state,
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params}`;
  }

  static async exchangeCodeForToken(
    code: string, appId: string, appSecret: string, redirectUri: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch(
      `${this.GRAPH_API_BASE}/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error?.message}`);
    }
    return response.json();
  }

  static async getLongLivedToken(
    shortLivedToken: string, appId: string, appSecret: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch(
      `${this.GRAPH_API_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken,
      })
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Long-lived token exchange failed: ${error.error?.message}`);
    }
    return response.json();
  }

  static async getInstagramBusinessAccounts(userAccessToken: string): Promise<Array<{
    id: string; username: string; name: string; profile_picture_url?: string;
    followers_count?: number; page_id: string; page_name: string;
  }>> {
    const pagesResponse = await fetch(
      `${this.GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${userAccessToken}`
    );

    if (!pagesResponse.ok) {
      const error = await pagesResponse.json();
      throw new Error(`Failed to get Facebook Pages: ${error.error?.message}`);
    }

    const pagesData = await pagesResponse.json();
    const accounts: Array<{
      id: string; username: string; name: string; profile_picture_url?: string;
      followers_count?: number; page_id: string; page_name: string;
    }> = [];

    for (const page of pagesData.data || []) {
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        accounts.push({
          id: ig.id, username: ig.username, name: ig.name || ig.username,
          profile_picture_url: ig.profile_picture_url, followers_count: ig.followers_count,
          page_id: page.id, page_name: page.name,
        });
      }
    }
    return accounts;
  }

  static async getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
    const response = await fetch(
      `${this.GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${userAccessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Page access token: ${error.error?.message}`);
    }
    return (await response.json()).access_token;
  }
}
