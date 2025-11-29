/**
 * LinkedIn Platform Integration
 *
 * Implements LinkedIn Marketing API for posting to personal profiles and company pages.
 * Uses OAuth 2.0 with 3-legged flow and supports text, images, articles, and documents.
 *
 * API Documentation: https://learn.microsoft.com/en-us/linkedin/marketing/
 *
 * Required Scopes:
 * - w_member_social: Post to personal profile
 * - r_liteprofile: Read profile info
 * - w_organization_social: Post to company pages (requires admin)
 *
 * Token Expiration: 60 days (refresh tokens valid for 1 year)
 */

import {
  BasePlatform,
  type PlatformCredentials,
  type MediaUploadResult,
} from './base';
import type {
  PublishResult,
  Post,
  LinkedInPostData,
  PostingAnalytics,
  PlatformSpecificData,
} from '../types';
import { ERROR_CODES } from '../types';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_API_REST = 'https://api.linkedin.com/rest';

/**
 * LinkedIn share content types
 */
type LinkedInShareType = 'NONE' | 'ARTICLE' | 'IMAGE' | 'MULTI_IMAGE' | 'DOCUMENT';

/**
 * LinkedIn Platform Implementation
 *
 * Supports:
 * - Personal profile posting (w_member_social)
 * - Company page posting (w_organization_social)
 * - Image uploads (single and multi-image)
 * - Article/link shares with commentary
 * - Document shares (PDF, PPT)
 */
export class LinkedInPlatform extends BasePlatform {
  private personUrn: string | null = null;

  constructor(credentials: PlatformCredentials) {
    super('linkedin', credentials);
  }

  /**
   * Validate LinkedIn credentials
   * Tests token validity by fetching user profile
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.makeRequest('/userinfo');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh LinkedIn access token
   * LinkedIn tokens expire after 60 days; refresh tokens last 1 year
   */
  async refreshAccessToken(): Promise<PlatformCredentials> {
    if (!this.credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh LinkedIn token: ${error}`);
    }

    const data = await response.json();

    // LinkedIn tokens expire in 60 days (5184000 seconds)
    const expiresIn = data.expires_in || 5184000;

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.credentials.refresh_token,
      expires_at: new Date(Date.now() + expiresIn * 1000),
      account_id: this.credentials.account_id,
      scopes: this.credentials.scopes,
    };
  }

  /**
   * Upload media to LinkedIn
   * Uses the Assets API for images and documents
   */
  async uploadMedia(
    mediaUrls: string[],
    mediaType: string
  ): Promise<MediaUploadResult[]> {
    await this.ensureValidToken();
    const personUrn = await this.getPersonUrn();
    const results: MediaUploadResult[] = [];

    for (const url of mediaUrls) {
      try {
        // Step 1: Register upload
        const registerResponse = await this.makeRequest('/assets?action=registerUpload', {
          method: 'POST',
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: [this.getRecipeForMediaType(mediaType)],
              owner: personUrn,
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          }),
        });

        if (!registerResponse.ok) {
          const error = await registerResponse.json();
          throw new Error(`Failed to register upload: ${JSON.stringify(error)}`);
        }

        const registerData = await registerResponse.json();
        const uploadUrl = registerData.value.uploadMechanism[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ].uploadUrl;
        const asset = registerData.value.asset;

        // Step 2: Download media file
        const mediaResponse = await fetch(url);
        if (!mediaResponse.ok) {
          throw new Error(`Failed to download media: ${url}`);
        }
        const mediaBuffer = await mediaResponse.arrayBuffer();

        // Step 3: Upload to LinkedIn
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': this.getContentTypeForMedia(mediaType),
          },
          body: mediaBuffer,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload media to LinkedIn');
        }

        results.push({
          media_id: asset,
          media_url: url,
          media_type: mediaType,
        });
      } catch (error) {
        console.error('LinkedIn media upload error:', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Publish post to personal LinkedIn profile
   */
  async publishPost(
    post: Post,
    platformData?: PlatformSpecificData
  ): Promise<PublishResult> {
    try {
      await this.ensureValidToken();
      await this.validateContent(post);

      const linkedInData = platformData as LinkedInPostData | undefined;
      const personUrn = await this.getPersonUrn();

      // Upload media if present
      let mediaAssets: string[] = [];
      if (post.media_urls && post.media_urls.length > 0) {
        const uploadResults = await this.uploadMedia(post.media_urls, 'image');
        mediaAssets = uploadResults.map(r => r.media_id);
      }

      // Build share content
      const shareType = this.determineShareType(post, linkedInData);
      const shareContent = this.buildShareContent(post, linkedInData, mediaAssets, shareType);

      // Build the UGC post payload
      const payload = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': shareContent,
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility':
            linkedInData?.visibility || 'PUBLIC',
        },
      };

      // Publish post
      const response = await this.makeRequest('/ugcPosts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const postId = response.headers.get('x-restli-id') || '';
      const postUrn = postId.startsWith('urn:li:share:') ? postId : `urn:li:share:${postId}`;

      return {
        success: true,
        platform_post_id: postUrn,
        platform_url: this.buildPostUrl(postUrn),
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
   * Publish post to LinkedIn Company Page
   * Requires w_organization_social scope and admin access to the page
   */
  async publishToCompanyPage(
    post: Post,
    pageId: string,
    platformData?: LinkedInPostData
  ): Promise<PublishResult> {
    try {
      await this.ensureValidToken();
      await this.validateContent(post);

      const organizationUrn = `urn:li:organization:${pageId}`;

      // Upload media if present
      let mediaAssets: string[] = [];
      if (post.media_urls && post.media_urls.length > 0) {
        // For organization posts, owner is the organization
        const uploadResults = await this.uploadMediaForOrganization(
          post.media_urls,
          'image',
          organizationUrn
        );
        mediaAssets = uploadResults.map(r => r.media_id);
      }

      // Build share content
      const shareType = this.determineShareType(post, platformData);
      const shareContent = this.buildShareContent(post, platformData, mediaAssets, shareType);

      // Build the UGC post payload for organization
      const payload = {
        author: organizationUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': shareContent,
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      // Publish post
      const response = await this.makeRequest('/ugcPosts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const postId = response.headers.get('x-restli-id') || '';
      const postUrn = postId.startsWith('urn:li:share:') ? postId : `urn:li:share:${postId}`;

      return {
        success: true,
        platform_post_id: postUrn,
        platform_url: this.buildCompanyPostUrl(pageId),
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
   * Delete post from LinkedIn
   */
  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.ensureValidToken();

      // LinkedIn uses URN format for deletion
      const postUrn = platformPostId.startsWith('urn:li:')
        ? encodeURIComponent(platformPostId)
        : encodeURIComponent(`urn:li:share:${platformPostId}`);

      const response = await this.makeRequest(`/ugcPosts/${postUrn}`, {
        method: 'DELETE',
      });

      return response.ok || response.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Fetch analytics for LinkedIn post
   * Returns impressions, clicks, engagement metrics
   */
  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    try {
      await this.ensureValidToken();

      // LinkedIn requires the share URN for analytics
      const shareUrn = platformPostId.startsWith('urn:li:share:')
        ? platformPostId
        : `urn:li:share:${platformPostId}`;

      // Fetch share statistics
      const response = await this.makeRequest(
        `/socialActions/${encodeURIComponent(shareUrn)}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch LinkedIn analytics');
      }

      const data = await response.json();

      // Fetch organization share statistics if applicable
      const statsResponse = await this.makeRequest(
        `/shares/${encodeURIComponent(shareUrn)}/statistics`,
        { method: 'GET' }
      );

      let impressions = 0;
      let clicks = 0;

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        impressions = statsData.totalShareStatistics?.impressionCount || 0;
        clicks = statsData.totalShareStatistics?.clickCount || 0;
      }

      const likes = data.likesSummary?.totalLikes || 0;
      const comments = data.commentsSummary?.totalFirstLevelComments || 0;
      const shares = data.totalShareCount || 0;

      return {
        platform: 'linkedin',
        likes,
        comments,
        shares,
        impressions,
        clicks,
        engagement_rate: this.calculateEngagementRate(likes, comments, shares, impressions),
      };
    } catch (error) {
      console.error('Failed to fetch LinkedIn analytics:', error);
      return {};
    }
  }

  /**
   * Get LinkedIn account information
   */
  async getAccountInfo(): Promise<{
    account_id: string;
    account_name: string;
    follower_count?: number;
    profile_url?: string;
  }> {
    await this.ensureValidToken();

    // Use OpenID Connect userinfo endpoint
    const response = await this.makeRequest('/userinfo');

    if (!response.ok) {
      throw new Error('Failed to fetch LinkedIn account info');
    }

    const data = await response.json();

    // Cache the person URN
    this.personUrn = data.sub;

    return {
      account_id: data.sub,
      account_name: data.name || `${data.given_name} ${data.family_name}`,
      follower_count: undefined, // Requires additional API call
      profile_url: `https://www.linkedin.com/in/${data.sub}`,
    };
  }

  /**
   * Validate LinkedIn post content
   */
  async validateContent(post: Post): Promise<void> {
    const limits = this.getContentLimits();

    // Check text length
    if (post.body.length > limits.max_text_length) {
      throw new Error(
        `LinkedIn post text exceeds maximum length of ${limits.max_text_length} characters`
      );
    }

    // Check media count
    if (post.media_urls && post.media_urls.length > limits.max_media_count) {
      throw new Error(
        `LinkedIn post can have maximum ${limits.max_media_count} media items`
      );
    }

    // Validate media URLs
    if (post.media_urls && post.media_urls.length > 0) {
      await this.validateMediaUrls(post.media_urls);
    }
  }

  /**
   * Get LinkedIn content limits
   */
  getContentLimits() {
    return {
      max_text_length: 3000, // LinkedIn post limit
      max_media_count: 9, // Up to 9 images in a carousel
      max_hashtags: 3, // Recommended for optimal engagement
      supported_media_types: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'video/mp4',
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
    };
  }

  /**
   * Get rate limit status for LinkedIn
   * LinkedIn has a 100 posts per day limit
   */
  async getRateLimitStatus(_endpoint: string): Promise<{
    remaining: number;
    limit: number;
    resets_at: Date;
  }> {
    // LinkedIn doesn't provide rate limit headers like Twitter
    // We track this internally in our database
    // Return default values here
    return {
      remaining: 100,
      limit: 100,
      resets_at: new Date(Date.now() + 86400000), // 24 hours from now
    };
  }

  /**
   * Get list of company pages the user administers
   */
  async getAdministeredPages(): Promise<Array<{
    id: string;
    name: string;
    vanityName: string;
  }>> {
    await this.ensureValidToken();

    const response = await this.makeRequest(
      '/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(id,localizedName,vanityName)))'
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.elements || []).map((element: Record<string, unknown>) => {
      const org = element['organizationalTarget~'] as Record<string, unknown> || {};
      return {
        id: String((org.id as number) || 0),
        name: String(org.localizedName || ''),
        vanityName: String(org.vanityName || ''),
      };
    });
  }

  /**
   * Handle LinkedIn API errors
   */
  protected handlePlatformError(error: unknown): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const err = error as { status?: number; serviceErrorCode?: number; message?: string; code?: string };
    const statusCode = err.status;
    const serviceErrorCode = err.serviceErrorCode;

    // Rate limit error
    if (statusCode === 429) {
      return {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'LinkedIn API rate limit exceeded',
        retryable: true,
      };
    }

    // Authentication errors
    if (statusCode === 401) {
      return {
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'LinkedIn authentication failed',
        retryable: false,
      };
    }

    // Forbidden - permissions issue
    if (statusCode === 403) {
      return {
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'LinkedIn permission denied - check scopes',
        retryable: false,
      };
    }

    // Duplicate content
    if (serviceErrorCode === 400 || serviceErrorCode === 65600) {
      return {
        code: ERROR_CODES.DUPLICATE_POST,
        message: 'Duplicate post content detected',
        retryable: false,
      };
    }

    // Media errors
    if (serviceErrorCode === 100 || serviceErrorCode === 65603) {
      return {
        code: ERROR_CODES.INVALID_MEDIA,
        message: 'Invalid media format for LinkedIn',
        retryable: false,
      };
    }

    // Network errors
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return {
        code: ERROR_CODES.NETWORK_ERROR,
        message: 'Network connection error',
        retryable: true,
      };
    }

    // Default unknown error
    return {
      code: ERROR_CODES.PLATFORM_ERROR,
      message: err.message || 'LinkedIn API error',
      retryable: false,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Make authenticated request to LinkedIn API
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Use REST API base for newer endpoints, v2 for legacy
    const isRestEndpoint = endpoint.startsWith('/userinfo') || endpoint.startsWith('/rest');
    const baseUrl = isRestEndpoint ? LINKEDIN_API_REST : LINKEDIN_API_BASE;
    const cleanEndpoint = endpoint.replace('/rest', '');

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${baseUrl}${cleanEndpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401', // API version
        ...options.headers,
      },
    });
  }

  /**
   * Get the person URN for the authenticated user
   */
  private async getPersonUrn(): Promise<string> {
    if (this.personUrn) {
      return this.personUrn;
    }

    const accountInfo = await this.getAccountInfo();
    this.personUrn = `urn:li:person:${accountInfo.account_id}`;
    return this.personUrn;
  }

  /**
   * Determine the share content type based on post content
   */
  private determineShareType(
    post: Post,
    platformData?: LinkedInPostData
  ): LinkedInShareType {
    // Article share
    if (platformData?.content?.article) {
      return 'ARTICLE';
    }

    // Image shares
    if (post.media_urls && post.media_urls.length > 0) {
      return post.media_urls.length > 1 ? 'MULTI_IMAGE' : 'IMAGE';
    }

    // Document share (check for PDF/PPT in media)
    if (platformData?.media?.some(m =>
      m.media.includes('document') || m.media.includes('digitalmediaAsset')
    )) {
      return 'DOCUMENT';
    }

    // Text-only
    return 'NONE';
  }

  /**
   * Build the share content structure based on type
   */
  private buildShareContent(
    post: Post,
    platformData: LinkedInPostData | undefined,
    mediaAssets: string[],
    shareType: LinkedInShareType
  ): Record<string, unknown> {
    const commentary = this.formatPostText(post, this.getContentLimits().max_text_length);

    const shareContent: Record<string, unknown> = {
      shareCommentary: {
        text: commentary,
      },
      shareMediaCategory: shareType,
    };

    // Add media based on type
    switch (shareType) {
      case 'ARTICLE':
        if (platformData?.content?.article) {
          shareContent.media = [{
            status: 'READY',
            originalUrl: platformData.content.article.source,
            title: {
              text: platformData.content.article.title,
            },
            description: platformData.content.article.description
              ? { text: platformData.content.article.description }
              : undefined,
          }];
        }
        break;

      case 'IMAGE':
      case 'MULTI_IMAGE':
        shareContent.media = mediaAssets.map((asset, index) => ({
          status: 'READY',
          media: asset,
          title: {
            text: platformData?.media?.[index]?.title || '',
          },
          description: {
            text: platformData?.media?.[index]?.description || '',
          },
        }));
        break;

      case 'DOCUMENT':
        if (platformData?.media?.[0]) {
          shareContent.media = [{
            status: 'READY',
            media: platformData.media[0].media,
            title: {
              text: platformData.media[0].title || 'Document',
            },
            description: {
              text: platformData.media[0].description || '',
            },
          }];
        }
        break;
    }

    return shareContent;
  }

  /**
   * Upload media for organization (company page)
   */
  private async uploadMediaForOrganization(
    mediaUrls: string[],
    mediaType: string,
    organizationUrn: string
  ): Promise<MediaUploadResult[]> {
    const results: MediaUploadResult[] = [];

    for (const url of mediaUrls) {
      try {
        // Step 1: Register upload with organization as owner
        const registerResponse = await this.makeRequest('/assets?action=registerUpload', {
          method: 'POST',
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: [this.getRecipeForMediaType(mediaType)],
              owner: organizationUrn,
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          }),
        });

        if (!registerResponse.ok) {
          const error = await registerResponse.json();
          throw new Error(`Failed to register upload: ${JSON.stringify(error)}`);
        }

        const registerData = await registerResponse.json();
        const uploadUrl = registerData.value.uploadMechanism[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ].uploadUrl;
        const asset = registerData.value.asset;

        // Step 2: Download and upload media
        const mediaResponse = await fetch(url);
        if (!mediaResponse.ok) {
          throw new Error(`Failed to download media: ${url}`);
        }
        const mediaBuffer = await mediaResponse.arrayBuffer();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': this.getContentTypeForMedia(mediaType),
          },
          body: mediaBuffer,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload media to LinkedIn');
        }

        results.push({
          media_id: asset,
          media_url: url,
          media_type: mediaType,
        });
      } catch (error) {
        console.error('LinkedIn organization media upload error:', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Get the recipe type for media upload registration
   */
  private getRecipeForMediaType(mediaType: string): string {
    if (mediaType.startsWith('video/')) {
      return 'urn:li:digitalmediaRecipe:feedshare-video';
    }
    if (mediaType.includes('pdf') || mediaType.includes('powerpoint') || mediaType.includes('presentation')) {
      return 'urn:li:digitalmediaRecipe:feedshare-document';
    }
    return 'urn:li:digitalmediaRecipe:feedshare-image';
  }

  /**
   * Get content type header for media upload
   */
  private getContentTypeForMedia(mediaType: string): string {
    if (mediaType.startsWith('video/')) {
      return 'video/mp4';
    }
    if (mediaType.includes('pdf')) {
      return 'application/pdf';
    }
    if (mediaType.includes('powerpoint') || mediaType.includes('presentation')) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    return 'image/jpeg';
  }

  /**
   * Build post URL for personal profile share
   */
  private buildPostUrl(shareUrn: string): string {
    return `https://www.linkedin.com/feed/update/${shareUrn}`;
  }

  /**
   * Build post URL for company page share
   */
  private buildCompanyPostUrl(pageId: string): string {
    return `https://www.linkedin.com/company/${pageId}/posts/`;
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(
    likes: number,
    comments: number,
    shares: number,
    impressions: number
  ): number {
    const engagements = likes + comments + shares;
    const effectiveImpressions = impressions || 1;
    return engagements / effectiveImpressions;
  }
}
