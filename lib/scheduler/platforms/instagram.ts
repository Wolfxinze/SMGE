/**
 * Instagram Platform Integration (Stub)
 *
 * TODO: Implement full Instagram Graph API integration
 * For now, this is a stub to satisfy imports.
 */

import { BasePlatform, type PlatformCredentials } from './base';
import type { PublishResult, Post, PostingAnalytics } from '../types';

export class InstagramPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('instagram', credentials);
  }

  async validateCredentials(): Promise<boolean> {
    throw new Error('Instagram integration not yet implemented');
  }

  async refreshAccessToken(): Promise<PlatformCredentials> {
    throw new Error('Instagram integration not yet implemented');
  }

  async uploadMedia(): Promise<any[]> {
    throw new Error('Instagram integration not yet implemented');
  }

  async publishPost(post: Post): Promise<PublishResult> {
    throw new Error('Instagram integration not yet implemented');
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    throw new Error('Instagram integration not yet implemented');
  }

  async fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>> {
    throw new Error('Instagram integration not yet implemented');
  }

  async getAccountInfo(): Promise<any> {
    throw new Error('Instagram integration not yet implemented');
  }

  async validateContent(post: Post): Promise<void> {
    throw new Error('Instagram integration not yet implemented');
  }

  getContentLimits() {
    return {
      max_text_length: 2200,
      max_media_count: 10,
      max_hashtags: 30,
      supported_media_types: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }

  protected handlePlatformError(error: any) {
    return {
      code: 'PLATFORM_ERROR',
      message: 'Instagram error: ' + error.message,
      retryable: false,
    };
  }

  async getRateLimitStatus(): Promise<any> {
    throw new Error('Instagram integration not yet implemented');
  }
}
