/**
 * Type definitions for Engagement Agent system
 */

export type EngagementType = 'comment' | 'dm' | 'mention' | 'reply';
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'urgent';
export type PriorityType = 'low' | 'normal' | 'high' | 'urgent';
export type EngagementStatus = 'pending' | 'processing' | 'responded' | 'ignored' | 'failed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited';
export type PostingStatus = 'queued' | 'posting' | 'posted' | 'failed';
export type Platform = 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'facebook';

/**
 * Incoming social media engagement (comment/DM)
 */
export interface EngagementItem {
  id: string;
  brand_id: string;
  platform: Platform;
  social_account_id: string;

  // Engagement Details
  engagement_type: EngagementType;
  external_id: string;
  parent_post_id?: string | null;

  // Content
  author_username: string;
  author_display_name?: string | null;
  author_profile_url?: string | null;
  content: string;

  // Context
  original_post_content?: string | null;
  conversation_context?: Array<{
    author: string;
    content: string;
    timestamp: string;
  }>;

  // Analysis
  sentiment: SentimentType;
  sentiment_score?: number | null;
  detected_intent?: string | null;
  priority: PriorityType;

  // Classification
  is_spam: boolean;
  requires_response: boolean;
  is_influencer: boolean;

  // Processing Status
  status: EngagementStatus;
  processed_at?: string | null;

  // Metadata
  raw_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * AI-generated response awaiting approval
 */
export interface GeneratedResponse {
  id: string;
  engagement_item_id: string;
  brand_id: string;

  // Response Content
  response_text: string;
  response_variant_number: number;

  // AI Metadata
  ai_model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  generation_time_ms?: number | null;

  // Brand Context
  brand_voice_similarity?: number | null;
  reference_content_ids?: string[] | null;

  // Approval Workflow
  approval_status: ApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;

  // Edited Version
  edited_response_text?: string | null;
  edit_notes?: string | null;

  // Posting Status
  posting_status: PostingStatus;
  posted_at?: string | null;
  posting_error?: string | null;
  retry_count: number;
  next_retry_at?: string | null;

  // Platform Response
  external_response_id?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Posted response with performance metrics
 */
export interface EngagementHistory {
  id: string;
  engagement_item_id: string;
  generated_response_id: string;
  brand_id: string;

  // Response Details
  response_text: string;
  was_edited: boolean;

  // Platform Details
  platform: Platform;
  external_response_id: string;
  response_url?: string | null;

  // Performance Metrics
  likes_count: number;
  replies_count: number;
  reach: number;

  // Follow-up Tracking
  generated_follow_up: boolean;
  follow_up_engagement_ids?: string[] | null;

  // Timing Analysis
  response_time_minutes?: number | null;

  // Learning Data
  user_satisfaction_rating?: number | null;
  ai_confidence_score?: number | null;

  // Metadata
  posted_at: string;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Automated response rule
 */
export interface EngagementRule {
  id: string;
  brand_id: string;

  // Rule Identification
  rule_name: string;
  description?: string | null;
  is_active: boolean;
  priority: number;

  // Matching Conditions
  conditions: {
    keywords?: string[];
    sentiment?: SentimentType | SentimentType[];
    platforms?: Platform[];
    author_follower_min?: number;
    author_follower_max?: number;
    engagement_types?: EngagementType[];
  };

  // Action
  action: 'auto_approve' | 'auto_ignore' | 'flag_urgent' | 'assign_template';
  action_config?: Record<string, any>;

  // Template
  response_template?: string | null;

  // Statistics
  times_triggered: number;
  last_triggered_at?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Approval queue item (combined engagement + response)
 */
export interface ApprovalQueueItem {
  engagement_id: string;
  response_id: string;
  author_username: string;
  content: string;
  response_text: string;
  sentiment: SentimentType;
  priority: PriorityType;
  created_at: string;
}

/**
 * Engagement analytics
 */
export interface EngagementAnalytics {
  total_engagement_items: number;
  pending_responses: number;
  approved_responses: number;
  posted_responses: number;
  avg_response_time_minutes: number | null;
  sentiment_distribution: Record<SentimentType, number>;
  platform_distribution: Record<Platform, number>;
}

/**
 * Request/Response types for API endpoints
 */

export interface CreateEngagementItemRequest {
  brand_id: string;
  platform: Platform;
  social_account_id: string;
  engagement_type: EngagementType;
  external_id: string;
  parent_post_id?: string;
  author_username: string;
  author_display_name?: string;
  author_profile_url?: string;
  content: string;
  original_post_content?: string;
  conversation_context?: Array<{
    author: string;
    content: string;
    timestamp: string;
  }>;
  raw_data?: Record<string, any>;
}

export interface GenerateResponseRequest {
  engagement_item_id: string;
  brand_id: string;
  variant_count?: number; // Number of response variants to generate
}

export interface ApproveResponseRequest {
  response_id: string;
  edited_text?: string;
}

export interface RejectResponseRequest {
  response_id: string;
  reason: string;
}

export interface PostResponseRequest {
  response_id: string;
}

export interface GetApprovalQueueRequest {
  brand_id: string;
  limit?: number;
  priority?: PriorityType;
  sentiment?: SentimentType;
}

export interface GetEngagementAnalyticsRequest {
  brand_id: string;
  days?: number;
}

export interface WebhookPayload {
  platform: Platform;
  social_account_id: string;
  event_type: 'comment' | 'dm' | 'mention';
  data: Record<string, any>;
}
