/**
 * Facebook Platform Integration (Stub)
 *
 * TODO: Implement full Facebook Graph API integration
 * For now, this is a stub to satisfy imports.
 */

import { BasePlatform, type PlatformCredentials } from './base';
import type { PublishResult, Post, PostingAnalytics } from '../types';

export class FacebookPlatform extends BasePlatform {
  constructor(credentials: PlatformCredentials) {
    super('facebook', credentials);
  }

  async validateCredentials(): Promise<boolean> {
    throw new Error('Facebook integration not yet implemented');
  }

  async refreshAccessToken(): Promise<PlatformCredentials> {
    throw new Error('Facebook integration not yet implemented');
  }

  async uploadMedia(): Promise<any[]> {
    throw new Error('Facebook integration not yet implemented');
  }

  async publishPost(_post: Post): Promise<PublishResult> {
    throw new Error('Facebook integration not yet implemented');
  }

  async deletePost(_platformPostId: string): Promise<boolean> {
    throw new Error('Facebook integration not yet implemented');
  }

  async fetchAnalytics(_platformPostId: string): Promise<Partial<PostingAnalytics>> {
    throw new Error('Facebook integration not yet implemented');
  }

  async getAccountInfo(): Promise<any> {
    throw new Error('Facebook integration not yet implemented');
  }

  async validateContent(_post: Post): Promise<void> {
    throw new Error('Facebook integration not yet implemented');
  }

  getContentLimits() {
    return {
      max_text_length: 63206,
      max_media_count: 10,
      max_hashtags: 30,
      supported_media_types: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }

  protected handlePlatformError(error: any) {
    return {
      code: 'PLATFORM_ERROR',
      message: 'Facebook error: ' + error.message,
      retryable: false,
    };
  }

  async getRateLimitStatus(): Promise<any> {
    throw new Error('Facebook integration not yet implemented');
  }
}
