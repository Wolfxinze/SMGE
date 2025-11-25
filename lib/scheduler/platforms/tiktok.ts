/**
 * TikTok Platform Integration (Stub)
 *
 * TODO: Implement full TikTok API integration
 * For now, this is a stub to satisfy imports.
 */

import { BasePlatform, type PlatformCredentials } from './base';
import type { PublishResult, Post, PostingAnalytics } from '../types';

export class TikTokPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('tiktok', credentials);
  }

  async validateCredentials(): Promise<boolean> {
    throw new Error('TikTok integration not yet implemented');
  }

  async refreshAccessToken(): Promise<PlatformCredentials> {
    throw new Error('TikTok integration not yet implemented');
  }

  async uploadMedia(): Promise<any[]> {
    throw new Error('TikTok integration not yet implemented');
  }

  async publishPost(post: Post): Promise<PublishResult> {
    throw new Error('TikTok integration not yet implemented');
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    throw new Error('TikTok integration not yet implemented');
  }

  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    throw new Error('TikTok integration not yet implemented');
  }

  async getAccountInfo(): Promise<any> {
    throw new Error('TikTok integration not yet implemented');
  }

  async validateContent(post: Post): Promise<void> {
    throw new Error('TikTok integration not yet implemented');
  }

  getContentLimits() {
    return {
      max_text_length: 2200,
      max_media_count: 1,
      max_hashtags: 10,
      supported_media_types: ['video/mp4'],
    };
  }

  protected handlePlatformError(error: any) {
    return {
      code: 'PLATFORM_ERROR',
      message: 'TikTok error: ' + error.message,
      retryable: false,
    };
  }

  async getRateLimitStatus(): Promise<any> {
    throw new Error('TikTok integration not yet implemented');
  }
}
