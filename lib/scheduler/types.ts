/**
 * Social Scheduler Type Definitions
 *
 * Type-safe interfaces for social media scheduling, posting queue,
 * and platform integrations.
 */

// ============================================================================
// PLATFORM TYPES
// ============================================================================

export type SocialPlatform = 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'facebook';

export type ContentType = 'post' | 'story' | 'reel' | 'video' | 'article' | 'thread';

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ScheduledPostStatus = 'pending' | 'processing' | 'published' | 'failed' | 'cancelled';

// ============================================================================
// PLATFORM CREDENTIALS
// ============================================================================

export interface PlatformCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: Date | string;
  account_id: string;  // Required - used for cache keys and API calls
  scopes?: string[];
}

export interface QueueItem {
  id: string;
  scheduled_post_id: string;
  post_id: string;
  social_account_id: string;
  brand_id: string;
  content: string;
  media_urls?: string[];
  scheduled_for: string;
  platform: SocialPlatform;
  status: ScheduledPostStatus;
  retry_count: number;
  max_retries: number;
}

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  account_name: string;
  account_id?: string;
  is_active: boolean;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export type Platform = SocialPlatform; // Alias for backward compatibility

// ============================================================================
// DATABASE TABLE INTERFACES
// ============================================================================

export interface Post {
  id: string;
  brand_id: string;
  user_id: string;

  // Content
  content_type: ContentType;
  title: string | null;
  body: string;
  media_urls: string[];

  // Metadata
  hashtags: string[];
  mentions: string[];
  platform_specific_data: Record<string, any>;

  // Status
  status: PostStatus;
  approval_status: ApprovalStatus;

  // AI Generation
  generation_prompt: string | null;
  ai_model: string | null;
  generation_metadata: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface ScheduledPost {
  id: string;
  post_id: string;
  social_account_id: string;
  brand_id: string;

  // Scheduling
  scheduled_for: string;
  timezone: string;

  // Status
  status: ScheduledPostStatus;
  platform_post_id: string | null;
  platform_url: string | null;

  // Error Handling
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;

  // Publishing Metadata
  published_at: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;

  // Rate Limiting
  rate_limit_metadata: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PlatformRateLimit {
  id: string;
  social_account_id: string;
  platform: SocialPlatform;

  // Rate Limit Tracking
  endpoint: string;
  requests_made: number;
  requests_limit: number;
  window_start: string;
  window_duration_seconds: number;

  // Reset
  resets_at: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PostingAnalytics {
  id: string;
  scheduled_post_id: string;
  post_id: string;
  platform: SocialPlatform;

  // Engagement Metrics
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;

  // Advanced Metrics
  engagement_rate: number | null;
  video_views: number | null;
  video_watch_time_seconds: number | null;

  // Demographics
  audience_demographics: Record<string, any>;

  // Timestamps
  metrics_fetched_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EXTENDED TYPES WITH RELATIONSHIPS
// ============================================================================

export interface ScheduledPostWithDetails extends ScheduledPost {
  post: Post;
  social_account: {
    id: string;
    platform: SocialPlatform;
    account_name: string;
    is_active: boolean;
  };
  analytics?: PostingAnalytics;
}

export interface PostWithSchedules extends Post {
  scheduled_posts: ScheduledPost[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreatePostRequest {
  brand_id: string;
  content_type: ContentType;
  title?: string;
  body: string;
  media_urls?: string[];
  hashtags?: string[];
  mentions?: string[];
  platform_specific_data?: Record<string, any>;
  generation_prompt?: string;
  ai_model?: string;
}

export interface SchedulePostRequest {
  post_id: string;
  social_account_ids: string[]; // Can schedule to multiple accounts
  scheduled_for: string; // ISO 8601 datetime
  timezone?: string;
}

export interface UpdateScheduleRequest {
  scheduled_post_id: string;
  scheduled_for?: string;
  timezone?: string;
}

export interface RetryPostRequest {
  scheduled_post_id: string;
  force?: boolean; // Force retry even if max retries reached
}

export interface CancelScheduleRequest {
  scheduled_post_id: string;
  reason?: string;
}

// ============================================================================
// PLATFORM-SPECIFIC TYPES
// ============================================================================

export interface InstagramPostData {
  caption: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  children?: Array<{ media_url: string; media_type: 'IMAGE' | 'VIDEO' }>;
  location_id?: string;
  user_tags?: Array<{ username: string; x: number; y: number }>;
}

export interface TwitterPostData {
  text: string;
  media_ids?: string[];
  poll_options?: string[];
  poll_duration_minutes?: number;
  reply_settings?: 'everyone' | 'mentionedUsers' | 'following';
  quote_tweet_id?: string;
  in_reply_to_status_id?: string;
}

export interface LinkedInPostData {
  commentary: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
  content?: {
    article: {
      source: string;
      title: string;
      description?: string;
    };
  };
  media?: Array<{
    status: 'READY';
    description: string;
    media: string; // URN
    title?: string;
  }>;
}

export interface TikTokPostData {
  video_url: string;
  caption: string;
  privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disable_comment?: boolean;
  disable_duet?: boolean;
  disable_stitch?: boolean;
}

export type PlatformSpecificData =
  | InstagramPostData
  | TwitterPostData
  | LinkedInPostData
  | TikTokPostData;

// ============================================================================
// QUEUE PROCESSING TYPES
// ============================================================================

export interface PublishResult {
  success: boolean;
  platform_post_id?: string;
  platform_url?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// ============================================================================
// CALENDAR VIEW TYPES
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  platform: SocialPlatform;
  status: ScheduledPostStatus;
  content: string;
  media_count: number;
  scheduled_post: ScheduledPostWithDetails;
}

export interface CalendarFilter {
  brand_ids?: string[];
  platforms?: SocialPlatform[];
  statuses?: ScheduledPostStatus[];
  start_date?: string;
  end_date?: string;
}

// ============================================================================
// RATE LIMITING TYPES
// ============================================================================

export interface RateLimitConfig {
  platform: SocialPlatform;
  endpoint: string;
  limit: number;
  window_seconds: number;
}

export const PLATFORM_RATE_LIMITS: Record<SocialPlatform, RateLimitConfig[]> = {
  instagram: [
    { platform: 'instagram', endpoint: '/posts', limit: 25, window_seconds: 86400 }, // 25 posts per day
    { platform: 'instagram', endpoint: '/stories', limit: 100, window_seconds: 86400 },
  ],
  twitter: [
    { platform: 'twitter', endpoint: '/tweets', limit: 300, window_seconds: 10800 }, // 300 per 3 hours
    { platform: 'twitter', endpoint: '/media', limit: 300, window_seconds: 10800 },
  ],
  linkedin: [
    { platform: 'linkedin', endpoint: '/ugcPosts', limit: 100, window_seconds: 86400 },
  ],
  tiktok: [
    { platform: 'tiktok', endpoint: '/video/upload', limit: 10, window_seconds: 86400 },
  ],
  facebook: [
    { platform: 'facebook', endpoint: '/posts', limit: 50, window_seconds: 86400 },
  ],
};

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface SchedulerError {
  code: string;
  message: string;
  retryable: boolean;
  platform?: SocialPlatform;
  details?: Record<string, any>;
}

export const ERROR_CODES = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_MEDIA: 'INVALID_MEDIA',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  DUPLICATE_POST: 'DUPLICATE_POST',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PLATFORM_ERROR: 'PLATFORM_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
