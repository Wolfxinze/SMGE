/**
 * LinkedIn Platform Integration (Stub)
 *
 * TODO: Implement full LinkedIn API integration
 * For now, this is a stub to satisfy imports.
 */

import { BasePlatform, type PlatformCredentials } from './base';
import type { PublishResult, Post, PostingAnalytics } from '../types';

export class LinkedInPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('linkedin', credentials);
  }

  async validateCredentials(): Promise<boolean> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async refreshAccessToken(): Promise<PlatformCredentials> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async uploadMedia(): Promise<any[]> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async publishPost(_post: Post): Promise<PublishResult> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async deletePost(_platformPostId: string): Promise<boolean> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async fetchAnalytics(_platformPostId: string): Promise<Partial<PostingAnalytics>> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async getAccountInfo(): Promise<any> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  async validateContent(_post: Post): Promise<void> {
    throw new Error('LinkedIn integration not yet implemented');
  }

  getContentLimits() {
    return {
      max_text_length: 3000,
      max_media_count: 9,
      max_hashtags: 3,
      supported_media_types: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }

  protected handlePlatformError(error: any) {
    return {
      code: 'PLATFORM_ERROR',
      message: 'LinkedIn error: ' + error.message,
      retryable: false,
    };
  }

  async getRateLimitStatus(): Promise<any> {
    throw new Error('LinkedIn integration not yet implemented');
  }
}
