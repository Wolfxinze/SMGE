/**
 * TikTok Platform Integration
 *
 * Implements TikTok Content Posting API for video uploads and publishing.
 * TikTok is a video-only platform with specific requirements:
 * - Videos: MP4/MOV, 3s-10min duration, 720p+, 9:16 aspect ratio, max 4GB
 * - No static image support (use video only)
 * - Chunked upload for large files
 *
 * API Documentation: https://developers.tiktok.com/doc/content-posting-api-get-started
 */

import {
  BasePlatform,
  type PlatformCredentials,
  type MediaUploadResult,
} from './base';
import type {
  PublishResult,
  Post,
  TikTokPostData,
  PostingAnalytics,
  PlatformSpecificData,
} from '../types';
import { ERROR_CODES } from '../types';

// TikTok API endpoints
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';
const TIKTOK_OAUTH_BASE = 'https://open.tiktokapis.com/v2/oauth';

// Video upload constants
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for large files
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024; // 4GB
const MIN_VIDEO_DURATION = 3; // seconds
const MAX_VIDEO_DURATION = 600; // 10 minutes in seconds
const MAX_CAPTION_LENGTH = 2200;
const MAX_HASHTAGS = 10;

// Polling constants for video processing
const UPLOAD_POLL_INTERVAL = 3000; // 3 seconds
const UPLOAD_MAX_POLLS = 60; // 3 minutes max wait

/**
 * TikTok upload status response
 */
interface TikTokUploadStatus {
  status: 'PROCESSING_UPLOAD' | 'PROCESSING_DOWNLOAD' | 'SEND_TO_USER_INBOX' | 'PUBLISH_COMPLETE' | 'FAILED';
  fail_reason?: string;
  publicaly_available_post_id?: string[];
  uploaded_bytes?: number;
  upload_url?: string;
}

/**
 * TikTok video info response
 */
interface TikTokVideoInfo {
  id: string;
  title: string;
  video_description: string;
  duration: number;
  cover_image_url: string;
  create_time: number;
  share_url: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
}

/**
 * TikTok Platform Implementation
 */
export class TikTokPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('tiktok', credentials);
  }

  /**
   * Validate TikTok credentials by fetching user info
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.makeRequest('/user/info/', {
        method: 'GET',
        params: { fields: 'open_id,display_name' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh TikTok access token using refresh token
   */
  async refreshAccessToken(): Promise<PlatformCredentials> {
    if (!this.credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;

    const response = await fetch(`${TIKTOK_OAUTH_BASE}/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh TikTok token: ${error}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`TikTok token refresh error: ${data.error.message}`);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.credentials.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      account_id: data.open_id || this.credentials.account_id,
      scopes: data.scope?.split(','),
    };
  }

  /**
   * Upload video to TikTok
   * TikTok uses a multi-step upload process:
   * 1. Initialize upload (get upload URL)
   * 2. Upload video chunks
   * 3. Poll for processing completion
   */
  async uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]> {
    await this.ensureValidToken();

    // TikTok only supports video
    if (!mediaType.startsWith('video/')) {
      throw new Error('TikTok only supports video content');
    }

    if (mediaUrls.length === 0) {
      throw new Error('No media URLs provided');
    }

    // TikTok only allows one video per post
    const videoUrl = mediaUrls[0];

    try {
      // Step 1: Download video to get size
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoUrl}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const videoSize = videoBuffer.byteLength;

      if (videoSize > MAX_VIDEO_SIZE) {
        throw new Error(`Video exceeds maximum size of 4GB`);
      }

      // Step 2: Initialize upload
      const initResponse = await this.makeRequest('/post/publish/inbox/video/init/', {
        method: 'POST',
        body: JSON.stringify({
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize > CHUNK_SIZE ? CHUNK_SIZE : videoSize,
            total_chunk_count: Math.ceil(videoSize / CHUNK_SIZE),
          },
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw new Error(`Failed to initialize TikTok upload: ${error.error?.message || 'Unknown error'}`);
      }

      const initData = await initResponse.json();
      const publishId = initData.data.publish_id;
      const uploadUrl = initData.data.upload_url;

      // Step 3: Upload video chunks
      const videoUint8Array = new Uint8Array(videoBuffer);
      if (videoSize <= CHUNK_SIZE) {
        // Single chunk upload
        await this.uploadVideoChunk(uploadUrl, videoUint8Array, 0, videoSize - 1, videoSize);
      } else {
        // Multi-chunk upload
        await this.uploadLargeVideo(uploadUrl, videoUint8Array);
      }

      // Step 4: Poll for processing completion
      await this.pollUploadStatus(publishId);

      return [{
        media_id: publishId,
        media_type: mediaType,
      }];
    } catch (error) {
      console.error('TikTok video upload error:', error);
      throw error;
    }
  }

  /**
   * Upload a single video chunk
   */
  private async uploadVideoChunk(
    uploadUrl: string,
    data: Uint8Array,
    start: number,
    end: number,
    total: number
  ): Promise<void> {
    const chunkData = data.slice(start, end + 1);
    // Create a Blob from the ArrayBuffer to ensure proper type compatibility
    const blob = new Blob([chunkData.buffer.slice(chunkData.byteOffset, chunkData.byteOffset + chunkData.byteLength)], {
      type: 'video/mp4',
    });

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': chunkData.length.toString(),
      },
      body: blob,
    });

    if (!response.ok && response.status !== 201 && response.status !== 206) {
      const error = await response.text();
      throw new Error(`Failed to upload video chunk: ${error}`);
    }
  }

  /**
   * Upload large video in chunks
   */
  private async uploadLargeVideo(uploadUrl: string, videoBuffer: Uint8Array): Promise<void> {
    const totalSize = videoBuffer.length;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);

      await this.uploadVideoChunk(uploadUrl, videoBuffer, start, end, totalSize);

      // Small delay between chunks to avoid rate limiting
      if (i < totalChunks - 1) {
        await this.delay(500);
      }
    }
  }

  /**
   * Poll for upload processing status
   */
  private async pollUploadStatus(publishId: string): Promise<TikTokUploadStatus> {
    for (let i = 0; i < UPLOAD_MAX_POLLS; i++) {
      const response = await this.makeRequest('/post/publish/status/fetch/', {
        method: 'POST',
        body: JSON.stringify({ publish_id: publishId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch upload status');
      }

      const data = await response.json();
      const status = data.data as TikTokUploadStatus;

      if (status.status === 'PUBLISH_COMPLETE' || status.status === 'SEND_TO_USER_INBOX') {
        return status;
      }

      if (status.status === 'FAILED') {
        throw new Error(`Video processing failed: ${status.fail_reason || 'Unknown error'}`);
      }

      // Still processing, wait and poll again
      await this.delay(UPLOAD_POLL_INTERVAL);
    }

    throw new Error('Video processing timed out');
  }

  /**
   * Publish video post to TikTok
   */
  async publishPost(
    post: Post,
    platformData?: PlatformSpecificData
  ): Promise<PublishResult> {
    try {
      await this.ensureValidToken();
      await this.validateContent(post);

      const tiktokData = platformData as TikTokPostData | undefined;

      // Validate video URL
      if (!post.media_urls || post.media_urls.length === 0) {
        throw new Error('TikTok requires a video for posting');
      }

      const videoUrl = post.media_urls[0];

      // Format caption with hashtags
      const caption = this.formatCaption(post);

      // Initialize direct post (vs inbox post)
      const initResponse = await this.makeRequest('/post/publish/video/init/', {
        method: 'POST',
        body: JSON.stringify({
          post_info: {
            title: caption,
            privacy_level: tiktokData?.privacy_level || 'PUBLIC_TO_EVERYONE',
            disable_comment: tiktokData?.disable_comment || false,
            disable_duet: tiktokData?.disable_duet || false,
            disable_stitch: tiktokData?.disable_stitch || false,
            video_cover_timestamp_ms: 1000, // Use 1 second as cover
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw error;
      }

      const initData = await initResponse.json();
      const publishId = initData.data.publish_id;

      // Poll for publish completion
      const status = await this.pollUploadStatus(publishId);

      // Get the published post ID
      const platformPostId = status.publicaly_available_post_id?.[0] || publishId;

      return {
        success: true,
        platform_post_id: platformPostId,
        platform_url: `https://www.tiktok.com/@${this.credentials.account_id}/video/${platformPostId}`,
      };
    } catch (error: unknown) {
      const platformError = this.handlePlatformError(error);
      return {
        success: false,
        error: platformError,
      };
    }
  }

  /**
   * Delete a published TikTok video
   * Note: TikTok API does not support deleting videos programmatically
   */
  async deletePost(_platformPostId: string): Promise<boolean> {
    // TikTok Content Posting API does not support deleting posts
    console.warn('TikTok API does not support programmatic post deletion');
    return false;
  }

  /**
   * Fetch analytics for a TikTok video
   */
  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    try {
      await this.ensureValidToken();

      const response = await this.makeRequest('/video/query/', {
        method: 'POST',
        body: JSON.stringify({
          filters: {
            video_ids: [platformPostId],
          },
          fields: [
            'id',
            'title',
            'video_description',
            'duration',
            'create_time',
            'share_url',
            'like_count',
            'comment_count',
            'share_count',
            'view_count',
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch TikTok video analytics');
      }

      const data = await response.json();
      const video = data.data?.videos?.[0] as TikTokVideoInfo | undefined;

      if (!video) {
        return {};
      }

      return {
        platform: 'tiktok',
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        video_views: video.view_count || 0,
        engagement_rate: this.calculateEngagementRate(video),
      };
    } catch (error) {
      console.error('Failed to fetch TikTok analytics:', error);
      return {};
    }
  }

  /**
   * Get TikTok account information
   */
  async getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }> {
    await this.ensureValidToken();

    const response = await this.makeRequest('/user/info/', {
      method: 'GET',
      params: {
        fields: 'open_id,union_id,avatar_url,display_name,follower_count,profile_deep_link',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch TikTok account info');
    }

    const data = await response.json();
    const user = data.data.user;

    return {
      account_id: user.open_id,
      account_name: user.display_name,
      follower_count: user.follower_count,
      profile_url: user.profile_deep_link,
    };
  }

  /**
   * Validate post content against TikTok limits
   */
  async validateContent(post: Post): Promise<void> {
    const limits = this.getContentLimits();

    // TikTok requires video content
    if (!post.media_urls || post.media_urls.length === 0) {
      throw new Error('TikTok requires video content');
    }

    // Check caption length
    const caption = this.formatCaption(post);
    if (caption.length > limits.max_text_length) {
      throw new Error(`Caption exceeds maximum length of ${limits.max_text_length} characters`);
    }

    // Check hashtag count
    if (post.hashtags && post.hashtags.length > limits.max_hashtags) {
      throw new Error(`TikTok posts can have maximum ${limits.max_hashtags} hashtags`);
    }

    // Validate media URLs
    await this.validateMediaUrls(post.media_urls);
  }

  /**
   * Get TikTok content limits
   */
  getContentLimits() {
    return {
      max_text_length: MAX_CAPTION_LENGTH,
      max_media_count: 1, // TikTok only allows one video per post
      max_hashtags: MAX_HASHTAGS,
      supported_media_types: ['video/mp4', 'video/quicktime'], // MP4 and MOV
      min_video_duration: MIN_VIDEO_DURATION,
      max_video_duration: MAX_VIDEO_DURATION,
      max_video_size: MAX_VIDEO_SIZE,
      recommended_aspect_ratio: '9:16',
      min_resolution: '720p',
    };
  }

  /**
   * Get rate limit status for TikTok endpoint
   */
  async getRateLimitStatus(_endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }> {
    // TikTok API includes rate limit headers in responses
    // Return conservative defaults
    return {
      remaining: 10, // TikTok allows ~10 uploads per day per user
      limit: 10,
      resets_at: new Date(Date.now() + 86400000), // Resets daily
    };
  }

  /**
   * Handle TikTok API errors and map to standard error codes
   */
  protected handlePlatformError(error: unknown): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorObj = error as { error?: { code?: string; message?: string }; code?: string; message?: string };
    const errorCode = errorObj?.error?.code || errorObj?.code;
    const errorMessage = errorObj?.error?.message || errorObj?.message || 'Unknown TikTok error';

    // Rate limit errors
    if (errorCode === 'rate_limit_exceeded' || errorCode === 'spam_risk_too_many_requests') {
      return {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'TikTok API rate limit exceeded',
        retryable: true,
      };
    }

    // Authentication errors
    if (errorCode === 'access_token_invalid' || errorCode === 'access_token_expired') {
      return {
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'TikTok authentication failed or token expired',
        retryable: false,
      };
    }

    // Token expired (should trigger refresh)
    if (errorCode === 'token_expired') {
      return {
        code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'TikTok access token expired',
        retryable: true,
      };
    }

    // Media format errors
    if (errorCode === 'invalid_video_format' || errorCode === 'video_processing_failed') {
      return {
        code: ERROR_CODES.INVALID_MEDIA,
        message: 'Invalid video format or processing failed',
        retryable: false,
      };
    }

    // Duplicate content
    if (errorCode === 'duplicate_content') {
      return {
        code: ERROR_CODES.DUPLICATE_POST,
        message: 'Duplicate video content detected',
        retryable: false,
      };
    }

    // Account issues
    if (errorCode === 'user_has_no_permission' || errorCode === 'account_not_eligible') {
      return {
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'TikTok account does not have posting permissions',
        retryable: false,
      };
    }

    // Network errors
    if (errorObj && typeof errorObj === 'object' && 'code' in errorObj) {
      const nodeError = errorObj as { code?: string };
      if (nodeError.code === 'ECONNRESET' || nodeError.code === 'ETIMEDOUT') {
        return {
          code: ERROR_CODES.NETWORK_ERROR,
          message: 'Network connection error',
          retryable: true,
        };
      }
    }

    // Default to platform error
    return {
      code: ERROR_CODES.PLATFORM_ERROR,
      message: errorMessage,
      retryable: false,
    };
  }

  /**
   * Make authenticated request to TikTok API
   */
  private async makeRequest(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      params?: Record<string, string>;
    } = {}
  ): Promise<Response> {
    let url = `${TIKTOK_API_BASE}${endpoint}`;

    // Add query parameters
    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    return fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: options.body,
    });
  }

  /**
   * Format caption with hashtags for TikTok
   */
  private formatCaption(post: Post): string {
    let caption = post.body;

    // Add hashtags if present
    if (post.hashtags && post.hashtags.length > 0) {
      const hashtagText = '\n\n' + post.hashtags
        .slice(0, MAX_HASHTAGS)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');

      if ((caption + hashtagText).length <= MAX_CAPTION_LENGTH) {
        caption += hashtagText;
      }
    }

    // Truncate if needed
    if (caption.length > MAX_CAPTION_LENGTH) {
      caption = caption.substring(0, MAX_CAPTION_LENGTH - 3) + '...';
    }

    return caption;
  }

  /**
   * Calculate engagement rate from video metrics
   */
  private calculateEngagementRate(video: TikTokVideoInfo): number {
    const engagements = (video.like_count || 0) +
                       (video.comment_count || 0) +
                       (video.share_count || 0);
    const views = video.view_count || 1;

    return engagements / views;
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * TikTok OAuth Helper
 * Utility functions for TikTok OAuth flow
 */
export class TikTokOAuthHelper {
  /**
   * Generate TikTok authorization URL
   */
  static getAuthorizationUrl(state: string): string {
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/auth/callback/tiktok`;

    const params = new URLSearchParams({
      client_key: clientKey,
      scope: 'user.info.basic,video.upload,video.publish',
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });

    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    open_id: string;
    scope: string;
  }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;

    const response = await fetch(`${TIKTOK_OAUTH_BASE}/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok token exchange failed: ${error}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`TikTok OAuth error: ${data.error.message}`);
    }

    return data;
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    open_id: string;
    scope: string;
  }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;

    const response = await fetch(`${TIKTOK_OAUTH_BASE}/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok token refresh failed: ${error}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`TikTok refresh error: ${data.error.message}`);
    }

    return data;
  }
}
