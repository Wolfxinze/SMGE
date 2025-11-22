/**
 * n8n TypeScript Types
 * Type definitions for n8n workflow integration
 */

// Workflow execution statuses
export enum WorkflowExecutionStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
  WAITING = 'waiting',
  CANCELED = 'canceled'
}

// Workflow trigger types
export enum WorkflowTriggerType {
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  API = 'api'
}

// Base workflow interface
export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// Workflow execution
export interface N8NExecution {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  mode: WorkflowTriggerType;
  startedAt: string;
  stoppedAt?: string;
  data?: Record<string, any>;
  error?: N8NError;
}

// Error structure
export interface N8NError {
  message: string;
  node?: string;
  timestamp: string;
  stack?: string;
}

// Workflow trigger payload
export interface WorkflowTriggerPayload {
  workflowId: string;
  data: Record<string, any>;
  mode?: WorkflowTriggerType;
}

// Workflow response
export interface WorkflowTriggerResponse {
  executionId: string;
  status: WorkflowExecutionStatus;
  data?: Record<string, any>;
}

// SMGE-specific workflow payloads
export namespace SMGEWorkflows {
  // Content generation workflow
  export interface ContentGenerationPayload {
    userId: string;
    brandId: string;
    contentType: 'post' | 'story' | 'reel' | 'thread';
    platform: 'instagram' | 'twitter' | 'linkedin' | 'tiktok';
    tone: string;
    keywords: string[];
    includeHashtags: boolean;
    includeImage: boolean;
  }

  export interface ContentGenerationResponse {
    contentId: string;
    text: string;
    hashtags: string[];
    imageUrl?: string;
    suggestedPostTime?: string;
  }

  // Brand analysis workflow
  export interface BrandAnalysisPayload {
    userId: string;
    brandName: string;
    industry: string;
    targetAudience: string;
    competitors: string[];
    socialProfiles: {
      instagram?: string;
      twitter?: string;
      linkedin?: string;
      tiktok?: string;
    };
  }

  export interface BrandAnalysisResponse {
    brandId: string;
    analysis: {
      voiceTone: string;
      contentPillars: string[];
      audienceInsights: Record<string, any>;
      competitorAnalysis: Record<string, any>;
      recommendations: string[];
    };
  }

  // Post scheduling workflow
  export interface PostSchedulingPayload {
    userId: string;
    contentId: string;
    platforms: string[];
    scheduleTime: string;
    autoRepost: boolean;
    repostInterval?: number;
  }

  export interface PostSchedulingResponse {
    scheduleId: string;
    platforms: Array<{
      platform: string;
      scheduledTime: string;
      status: 'scheduled' | 'failed';
      error?: string;
    }>;
  }

  // Analytics collection workflow
  export interface AnalyticsCollectionPayload {
    userId: string;
    brandId: string;
    platforms: string[];
    dateRange: {
      start: string;
      end: string;
    };
    metrics: string[];
  }

  export interface AnalyticsCollectionResponse {
    analyticsId: string;
    data: Array<{
      platform: string;
      metrics: Record<string, number>;
      topPosts: Array<{
        id: string;
        engagement: number;
        reach: number;
      }>;
    }>;
  }

  // Engagement automation workflow
  export interface EngagementAutomationPayload {
    userId: string;
    brandId: string;
    platform: string;
    actions: Array<'like' | 'comment' | 'follow' | 'unfollow'>;
    targetHashtags: string[];
    targetAccounts: string[];
    limit: number;
  }

  export interface EngagementAutomationResponse {
    automationId: string;
    actionsPerformed: {
      likes: number;
      comments: number;
      follows: number;
      unfollows: number;
    };
    errors: string[];
  }
}

// n8n API response wrapper
export interface N8NApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Webhook verification
export interface WebhookVerification {
  isValid: boolean;
  signature: string;
  timestamp: string;
}

// n8n client configuration
export interface N8NClientConfig {
  baseUrl: string;
  apiKey?: string;
  webhookSecret?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}