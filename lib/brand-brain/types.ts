// Brand Brain System Types
export interface Brand {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  website_url?: string;
  industry?: string;
  primary_color?: string;
  secondary_color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandVoice {
  id: string;
  brand_id: string;
  tone?: string[];
  writing_style?: string[];
  communication_preferences?: Record<string, any>;
  keywords?: string[];
  avoid_phrases?: string[];
  content_themes?: string[];
  brand_values?: string[];
  unique_selling_points?: string[];
  voice_embedding?: number[];
  embedding_version?: number;
  last_trained_at?: string;
  training_sample_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ContentExample {
  id: string;
  brand_id: string;
  content_type: 'post' | 'caption' | 'story' | 'article' | 'email' | 'other';
  platform?: string;
  content_text: string;
  content_metadata?: Record<string, any>;
  embedding?: number[];
  performance_score?: number;
  engagement_metrics?: Record<string, any>;
  created_at: string;
}

export interface TargetAudience {
  id: string;
  brand_id: string;
  name: string;
  demographics?: Record<string, any>;
  interests?: string[];
  pain_points?: string[];
  goals?: string[];
  preferred_platforms?: string[];
  content_preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BrandGuideline {
  id: string;
  brand_id: string;
  guideline_type: 'visual' | 'content' | 'tone' | 'legal' | 'other';
  title: string;
  description?: string;
  rules?: Record<string, any>;
  examples?: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

export interface BrandLearningHistory {
  id: string;
  brand_id: string;
  learning_type: 'initial_training' | 'content_update' | 'voice_refinement' | 'manual_adjustment';
  training_data?: Record<string, any>;
  samples_used?: number;
  model_version?: string;
  performance_metrics?: Record<string, any>;
  created_at: string;
}

// API Request/Response Types
export interface CreateBrandRequest {
  name: string;
  description?: string;
  website_url?: string;
  industry?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface UpdateBrandVoiceRequest {
  tone?: string[];
  writing_style?: string[];
  communication_preferences?: Record<string, any>;
  keywords?: string[];
  avoid_phrases?: string[];
  content_themes?: string[];
  brand_values?: string[];
  unique_selling_points?: string[];
}

export interface AddContentExampleRequest {
  content_type: 'post' | 'caption' | 'story' | 'article' | 'email' | 'other';
  platform?: string;
  content_text: string;
  content_metadata?: Record<string, any>;
  performance_score?: number;
  engagement_metrics?: Record<string, any>;
}

export interface TrainBrandVoiceRequest {
  examples?: Array<{
    content: string;
    weight?: number;
  }>;
  use_existing_examples?: boolean;
  min_performance_score?: number;
}

export interface SimilaritySearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

export interface SimilaritySearchResult {
  id: string;
  content_text: string;
  similarity_score: number;
  platform?: string;
  performance_score?: number;
}