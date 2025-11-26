/**
 * Base Platform Interface
 *
 * Unified abstraction for social media platform integrations.
 * Following Linus's principle: "Eliminate special cases through proper abstraction."
 *
 * All platform implementations MUST adhere to this interface to ensure
 * consistent behavior across different social media APIs.
 */

import type {
  SocialPlatform,
  PublishResult,
  Post,
  PlatformSpecificData,
  PostingAnalytics,
} from '../types';

/**
 * OAuth configuration for platform authentication
 */
export interface PlatformOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

/**
 * Social account credentials
 */
export interface PlatformCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: Date | string;
  account_id: string;  // Required - used for cache keys and API calls
  scopes?: string[];
}

/**
 * Media upload result
 */
export interface MediaUploadResult {
  media_id: string;
  media_url?: string;
  media_type: string;
}

/**
 * Base Platform Integration Interface
 *
 * All platform implementations must implement this interface.
 * This ensures a consistent API across all social media platforms.
 */
export abstract class BasePlatform {
  protected platform: SocialPlatform;
  protected credentials: PlatformCredentials;

  constructor(platform: SocialPlatform, credentials: PlatformCredentials) {
    this.platform = platform;
    this.credentials = credentials;
  }

  /**
   * Get platform name
   */
  getPlatform(): SocialPlatform {
    return this.platform;
  }

  /**
   * Validate credentials are still valid
   * Returns true if valid, false if expired/revoked
   */
  abstract validateCredentials(): Promise<boolean>;

  /**
   * Refresh access token using refresh token
   * Returns new credentials or throws error
   */
  abstract refreshAccessToken(): Promise<PlatformCredentials>;

  /**
   * Upload media file(s) to platform
   * Returns media ID(s) that can be used in post creation
   *
   * @param mediaUrls - Array of media URLs or file paths
   * @param mediaType - Type of media (image, video, etc.)
   */
  abstract uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]>;

  /**
   * Publish post to platform
   *
   * @param post - Post content from database
   * @param platformData - Platform-specific data
   * @returns Publish result with platform post ID and URL
   */
  abstract publishPost(
    post: Post,
    platformData?: PlatformSpecificData
  ): Promise<PublishResult>;

  /**
   * Delete post from platform
   *
   * @param platformPostId - Platform's post ID
   */
  abstract deletePost(platformPostId: string): Promise<boolean>;

  /**
   * Fetch analytics for a published post
   *
   * @param platformPostId - Platform's post ID
   * @returns Analytics data
   */
  abstract fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>>;

  /**
   * Get account information
   * Returns account details (name, ID, follower count, etc.)
   */
  abstract getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }>;

  /**
   * Check if content meets platform requirements
   * Throws error with specific validation message if invalid
   *
   * @param post - Post to validate
   */
  abstract validateContent(post: Post): Promise<void>;

  /**
   * Get platform-specific content limits
   */
  abstract getContentLimits(): {
    max_text_length: number;
    max_media_count: number;
    max_hashtags: number;
    supported_media_types: string[];
  };

  /**
   * Handle platform-specific error codes
   * Maps platform errors to our standardized error codes
   */
  protected abstract handlePlatformError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  };

  /**
   * Get current rate limit status
   * Returns remaining requests and reset time
   */
  abstract getRateLimitStatus(endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }>;

  /**
   * Common helper: Format post text with hashtags
   */
  protected formatPostText(post: Post, maxLength: number): string {
    let text = post.body;

    // Add hashtags if they fit
    if (post.hashtags && post.hashtags.length > 0) {
      const hashtagText = '\n\n' + post.hashtags.map(tag =>
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');

      if ((text + hashtagText).length <= maxLength) {
        text += hashtagText;
      }
    }

    // Truncate if needed
    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 3) + '...';
    }

    return text;
  }

  /**
   * Common helper: Validate media URLs
   */
  protected async validateMediaUrls(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        new URL(url); // Validate URL format
      } catch {
        throw new Error(`Invalid media URL: ${url}`);
      }
    }
  }

  /**
   * Common helper: Check token expiration
   */
  protected isTokenExpired(): boolean {
    if (!this.credentials.expires_at) {
      return false; // No expiration set
    }

    // Add 5-minute buffer to refresh before actual expiration
    const bufferMs = 5 * 60 * 1000;
    return new Date(this.credentials.expires_at).getTime() - bufferMs < Date.now();
  }

  /**
   * Common helper: Ensure valid token
   * Automatically refreshes if expired
   */
  protected async ensureValidToken(): Promise<void> {
    if (this.isTokenExpired() && this.credentials.refresh_token) {
      const newCredentials = await this.refreshAccessToken();
      this.credentials = newCredentials;
    }
  }
}

/**
 * Platform Factory
 * Creates appropriate platform instance based on platform type
 */
export class PlatformFactory {
  private static instances = new Map<string, BasePlatform>();

  /**
   * Get or create platform instance
   * Uses singleton pattern per account to avoid redundant API calls
   */
  static async getPlatform(
    platform: SocialPlatform,
    credentials: PlatformCredentials
  ): Promise<BasePlatform> {
    const key = `${platform}:${credentials.account_id}`;

    if (!this.instances.has(key)) {
      const instance = await this.createPlatform(platform, credentials);
      this.instances.set(key, instance);
    }

    return this.instances.get(key)!;
  }

  /**
   * Create new platform instance
   */
  private static async createPlatform(
    platform: SocialPlatform,
    credentials: PlatformCredentials
  ): Promise<BasePlatform> {
    // Dynamically import platform implementation
    switch (platform) {
      case 'instagram':
        const { InstagramPlatform } = await import('./instagram');
        return new InstagramPlatform(credentials);

      case 'twitter':
        const { TwitterPlatform } = await import('./twitter');
        return new TwitterPlatform(credentials);

      case 'linkedin':
        const { LinkedInPlatform } = await import('./linkedin');
        return new LinkedInPlatform(credentials);

      case 'tiktok':
        const { TikTokPlatform } = await import('./tiktok');
        return new TikTokPlatform(credentials);

      case 'facebook':
        const { FacebookPlatform } = await import('./facebook');
        return new FacebookPlatform(credentials);

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Clear cached instance (useful for credential updates)
   */
  static clearCache(platform: SocialPlatform, accountId: string): void {
    const key = `${platform}:${accountId}`;
    this.instances.delete(key);
  }

  /**
   * Clear all cached instances
   */
  static clearAllCaches(): void {
    this.instances.clear();
  }
}

/**
 * Platform OAuth Manager
 * Handles OAuth flow for all platforms
 */
export class PlatformOAuthManager {
  /**
   * Get OAuth configuration for platform
   */
  static getOAuthConfig(platform: SocialPlatform): PlatformOAuthConfig {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    switch (platform) {
      case 'instagram':
        return {
          clientId: process.env.INSTAGRAM_CLIENT_ID!,
          clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
          redirectUri: `${baseUrl}/api/scheduler/oauth/callback/instagram`,
          scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
          authorizationUrl: 'https://api.instagram.com/oauth/authorize',
          tokenUrl: 'https://api.instagram.com/oauth/access_token',
        };

      case 'twitter':
        return {
          clientId: process.env.TWITTER_CLIENT_ID!,
          clientSecret: process.env.TWITTER_CLIENT_SECRET!,
          redirectUri: `${baseUrl}/api/scheduler/oauth/callback/twitter`,
          scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
          authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
          tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        };

      case 'linkedin':
        return {
          clientId: process.env.LINKEDIN_CLIENT_ID!,
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
          redirectUri: `${baseUrl}/api/scheduler/oauth/callback/linkedin`,
          scopes: ['w_member_social', 'r_liteprofile', 'r_basicprofile'],
          authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        };

      case 'tiktok':
        return {
          clientId: process.env.TIKTOK_CLIENT_ID!,
          clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
          redirectUri: `${baseUrl}/api/scheduler/oauth/callback/tiktok`,
          scopes: ['user.info.basic', 'video.upload', 'video.publish'],
          authorizationUrl: 'https://www.tiktok.com/auth/authorize',
          tokenUrl: 'https://open-api.tiktok.com/oauth/access_token',
        };

      case 'facebook':
        return {
          clientId: process.env.FACEBOOK_CLIENT_ID!,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
          redirectUri: `${baseUrl}/api/scheduler/oauth/callback/facebook`,
          scopes: ['pages_manage_posts', 'pages_read_engagement', 'public_profile'],
          authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
          tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
        };

      default:
        throw new Error(`OAuth config not found for platform: ${platform}`);
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(platform: SocialPlatform, state: string): string {
    const config = this.getOAuthConfig(platform);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(
    platform: SocialPlatform,
    code: string
  ): Promise<PlatformCredentials> {
    const config = this.getOAuthConfig(platform);

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      account_id: data.user_id || data.id || '',
      scopes: data.scope?.split(' '),
    };
  }
}
