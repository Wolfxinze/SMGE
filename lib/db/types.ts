export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      _health: {
        Row: {
          checked_at: string
          id: string
          status: string
        }
        Insert: {
          checked_at?: string
          id?: string
          status?: string
        }
        Update: {
          checked_at?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_content_examples: {
        Row: {
          approval_status: string | null
          brand_id: string
          category: string | null
          content: string
          content_type: string
          context: string | null
          created_at: string | null
          embedding: string | null
          hashtags: Json | null
          id: string
          is_top_performer: boolean | null
          key_elements: Json | null
          media_urls: Json | null
          metrics: Json | null
          platform: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string | null
          brand_id: string
          category?: string | null
          content: string
          content_type: string
          context?: string | null
          created_at?: string | null
          embedding?: string | null
          hashtags?: Json | null
          id?: string
          is_top_performer?: boolean | null
          key_elements?: Json | null
          media_urls?: Json | null
          metrics?: Json | null
          platform?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string | null
          brand_id?: string
          category?: string | null
          content?: string
          content_type?: string
          context?: string | null
          created_at?: string | null
          embedding?: string | null
          hashtags?: Json | null
          id?: string
          is_top_performer?: boolean | null
          key_elements?: Json | null
          media_urls?: Json | null
          metrics?: Json | null
          platform?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_content_examples_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_guidelines: {
        Row: {
          brand_id: string
          colors: Json | null
          compliance_notes: Json | null
          content_donts: Json | null
          content_dos: Json | null
          content_templates: Json | null
          created_at: string | null
          hashtag_banks: Json | null
          id: string
          illustration_style: string | null
          imagery_style: Json | null
          legal_requirements: string | null
          logo_urls: Json | null
          logo_usage_rules: string | null
          photo_guidelines: string | null
          platform_guidelines: Json | null
          typography: Json | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          colors?: Json | null
          compliance_notes?: Json | null
          content_donts?: Json | null
          content_dos?: Json | null
          content_templates?: Json | null
          created_at?: string | null
          hashtag_banks?: Json | null
          id?: string
          illustration_style?: string | null
          imagery_style?: Json | null
          legal_requirements?: string | null
          logo_urls?: Json | null
          logo_usage_rules?: string | null
          photo_guidelines?: string | null
          platform_guidelines?: Json | null
          typography?: Json | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          colors?: Json | null
          compliance_notes?: Json | null
          content_donts?: Json | null
          content_dos?: Json | null
          content_templates?: Json | null
          created_at?: string | null
          hashtag_banks?: Json | null
          id?: string
          illustration_style?: string | null
          imagery_style?: Json | null
          legal_requirements?: string | null
          logo_urls?: Json | null
          logo_usage_rules?: string | null
          photo_guidelines?: string | null
          platform_guidelines?: Json | null
          typography?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_guidelines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_voice: {
        Row: {
          avoided_phrases: Json | null
          brand_id: string
          created_at: string | null
          grammar_preferences: Json | null
          id: string
          key_messages: Json | null
          personality_traits: Json | null
          preferred_phrases: Json | null
          sentence_structure: string | null
          storytelling_themes: Json | null
          tone: Json | null
          updated_at: string | null
          vocabulary_level: string | null
          voice_embedding: string | null
          writing_style: string | null
        }
        Insert: {
          avoided_phrases?: Json | null
          brand_id: string
          created_at?: string | null
          grammar_preferences?: Json | null
          id?: string
          key_messages?: Json | null
          personality_traits?: Json | null
          preferred_phrases?: Json | null
          sentence_structure?: string | null
          storytelling_themes?: Json | null
          tone?: Json | null
          updated_at?: string | null
          vocabulary_level?: string | null
          voice_embedding?: string | null
          writing_style?: string | null
        }
        Update: {
          avoided_phrases?: Json | null
          brand_id?: string
          created_at?: string | null
          grammar_preferences?: Json | null
          id?: string
          key_messages?: Json | null
          personality_traits?: Json | null
          preferred_phrases?: Json | null
          sentence_structure?: string | null
          storytelling_themes?: Json | null
          tone?: Json | null
          updated_at?: string | null
          vocabulary_level?: string | null
          voice_embedding?: string | null
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_voice_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          competitors: Json | null
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          mission: string | null
          name: string
          onboarding_completed: boolean | null
          tagline: string | null
          unique_selling_points: Json | null
          updated_at: string | null
          user_id: string
          values: Json | null
          vision: string | null
          website: string | null
        }
        Insert: {
          competitors?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          mission?: string | null
          name: string
          onboarding_completed?: boolean | null
          tagline?: string | null
          unique_selling_points?: Json | null
          updated_at?: string | null
          user_id: string
          values?: Json | null
          vision?: string | null
          website?: string | null
        }
        Update: {
          competitors?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          mission?: string | null
          name?: string
          onboarding_completed?: boolean | null
          tagline?: string | null
          unique_selling_points?: Json | null
          updated_at?: string | null
          user_id?: string
          values?: Json | null
          vision?: string | null
          website?: string | null
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          brand_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          emoji: string | null
          example_posts: Json | null
          guidelines: Json | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_used_at: string | null
          name: string
          post_count: number | null
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          example_posts?: Json | null
          guidelines?: Json | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          name: string
          post_count?: number | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          example_posts?: Json | null
          guidelines?: Json | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          name?: string
          post_count?: number | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_pillars_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pillars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_analytics: {
        Row: {
          auto_approved: number | null
          avg_confidence_score: number | null
          avg_response_time: unknown
          avg_sentiment_score: number | null
          brand_id: string
          created_at: string | null
          date: string
          id: string
          manually_approved: number | null
          platform: string
          rejected: number | null
          total_engagements: number | null
          total_responses: number | null
        }
        Insert: {
          auto_approved?: number | null
          avg_confidence_score?: number | null
          avg_response_time?: unknown
          avg_sentiment_score?: number | null
          brand_id: string
          created_at?: string | null
          date: string
          id?: string
          manually_approved?: number | null
          platform: string
          rejected?: number | null
          total_engagements?: number | null
          total_responses?: number | null
        }
        Update: {
          auto_approved?: number | null
          avg_confidence_score?: number | null
          avg_response_time?: unknown
          avg_sentiment_score?: number | null
          brand_id?: string
          created_at?: string | null
          date?: string
          id?: string
          manually_approved?: number | null
          platform?: string
          rejected?: number | null
          total_engagements?: number | null
          total_responses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_analytics_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_history: {
        Row: {
          ai_confidence_score: number | null
          brand_id: string
          created_at: string | null
          engagement_item_id: string
          external_response_id: string
          follow_up_engagement_ids: string[] | null
          generated_follow_up: boolean | null
          generated_response_id: string
          id: string
          last_synced_at: string | null
          likes_count: number | null
          platform: string
          posted_at: string | null
          reach: number | null
          replies_count: number | null
          response_text: string
          response_time_minutes: number | null
          response_url: string | null
          updated_at: string | null
          user_satisfaction_rating: number | null
          was_edited: boolean | null
        }
        Insert: {
          ai_confidence_score?: number | null
          brand_id: string
          created_at?: string | null
          engagement_item_id: string
          external_response_id: string
          follow_up_engagement_ids?: string[] | null
          generated_follow_up?: boolean | null
          generated_response_id: string
          id?: string
          last_synced_at?: string | null
          likes_count?: number | null
          platform: string
          posted_at?: string | null
          reach?: number | null
          replies_count?: number | null
          response_text: string
          response_time_minutes?: number | null
          response_url?: string | null
          updated_at?: string | null
          user_satisfaction_rating?: number | null
          was_edited?: boolean | null
        }
        Update: {
          ai_confidence_score?: number | null
          brand_id?: string
          created_at?: string | null
          engagement_item_id?: string
          external_response_id?: string
          follow_up_engagement_ids?: string[] | null
          generated_follow_up?: boolean | null
          generated_response_id?: string
          id?: string
          last_synced_at?: string | null
          likes_count?: number | null
          platform?: string
          posted_at?: string | null
          reach?: number | null
          replies_count?: number | null
          response_text?: string
          response_time_minutes?: number | null
          response_url?: string | null
          updated_at?: string | null
          user_satisfaction_rating?: number | null
          was_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_history_engagement_item_id_fkey"
            columns: ["engagement_item_id"]
            isOneToOne: false
            referencedRelation: "engagement_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_history_generated_response_id_fkey"
            columns: ["generated_response_id"]
            isOneToOne: false
            referencedRelation: "generated_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_items: {
        Row: {
          author_display_name: string | null
          author_profile_url: string | null
          author_username: string
          brand_id: string
          content: string
          conversation_context: Json | null
          created_at: string | null
          detected_intent: string | null
          engagement_type: string
          external_id: string
          id: string
          is_influencer: boolean | null
          is_spam: boolean | null
          original_post_content: string | null
          parent_post_id: string | null
          platform: string
          priority: string | null
          processed_at: string | null
          raw_data: Json | null
          requires_response: boolean | null
          sentiment: string | null
          sentiment_score: number | null
          social_account_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          author_display_name?: string | null
          author_profile_url?: string | null
          author_username: string
          brand_id: string
          content: string
          conversation_context?: Json | null
          created_at?: string | null
          detected_intent?: string | null
          engagement_type: string
          external_id: string
          id?: string
          is_influencer?: boolean | null
          is_spam?: boolean | null
          original_post_content?: string | null
          parent_post_id?: string | null
          platform: string
          priority?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          requires_response?: boolean | null
          sentiment?: string | null
          sentiment_score?: number | null
          social_account_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          author_display_name?: string | null
          author_profile_url?: string | null
          author_username?: string
          brand_id?: string
          content?: string
          conversation_context?: Json | null
          created_at?: string | null
          detected_intent?: string | null
          engagement_type?: string
          external_id?: string
          id?: string
          is_influencer?: boolean | null
          is_spam?: boolean | null
          original_post_content?: string | null
          parent_post_id?: string | null
          platform?: string
          priority?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          requires_response?: boolean | null
          sentiment?: string | null
          sentiment_score?: number | null
          social_account_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_items_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_responses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          brand_id: string
          confidence_score: number | null
          content: string
          created_at: string | null
          engagement_item_id: string
          error_message: string | null
          id: string
          rejection_reason: string | null
          sent_at: string | null
          status: string | null
          suggested_edits: string | null
          updated_at: string | null
          voice_similarity: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          brand_id: string
          confidence_score?: number | null
          content: string
          created_at?: string | null
          engagement_item_id: string
          error_message?: string | null
          id?: string
          rejection_reason?: string | null
          sent_at?: string | null
          status?: string | null
          suggested_edits?: string | null
          updated_at?: string | null
          voice_similarity?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string
          confidence_score?: number | null
          content?: string
          created_at?: string | null
          engagement_item_id?: string
          error_message?: string | null
          id?: string
          rejection_reason?: string | null
          sent_at?: string | null
          status?: string | null
          suggested_edits?: string | null
          updated_at?: string | null
          voice_similarity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_responses_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_rules: {
        Row: {
          action: string
          action_config: Json | null
          brand_id: string
          conditions: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          priority: number | null
          response_template: string | null
          rule_name: string
          times_triggered: number | null
          updated_at: string | null
        }
        Insert: {
          action: string
          action_config?: Json | null
          brand_id: string
          conditions: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          priority?: number | null
          response_template?: string | null
          rule_name: string
          times_triggered?: number | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          action_config?: Json | null
          brand_id?: string
          conditions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          priority?: number | null
          response_template?: string | null
          rule_name?: string
          times_triggered?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_posts: {
        Row: {
          brand_id: string | null
          content: string
          content_html: string | null
          created_at: string | null
          edit_history: Json | null
          engagement_metrics: Json | null
          generation_cost: number | null
          generation_model: string | null
          generation_params: Json | null
          generation_prompt: string | null
          hashtags: string[] | null
          id: string
          is_edited: boolean | null
          media_type: string | null
          media_urls: Json | null
          mentions: string[] | null
          platform_variants: Json | null
          published_at: string | null
          quality_score: number | null
          scheduled_at: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          content: string
          content_html?: string | null
          created_at?: string | null
          edit_history?: Json | null
          engagement_metrics?: Json | null
          generation_cost?: number | null
          generation_model?: string | null
          generation_params?: Json | null
          generation_prompt?: string | null
          hashtags?: string[] | null
          id?: string
          is_edited?: boolean | null
          media_type?: string | null
          media_urls?: Json | null
          mentions?: string[] | null
          platform_variants?: Json | null
          published_at?: string | null
          quality_score?: number | null
          scheduled_at?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          content?: string
          content_html?: string | null
          created_at?: string | null
          edit_history?: Json | null
          engagement_metrics?: Json | null
          generation_cost?: number | null
          generation_model?: string | null
          generation_params?: Json | null
          generation_prompt?: string | null
          hashtags?: string[] | null
          id?: string
          is_edited?: boolean | null
          media_type?: string | null
          media_urls?: Json | null
          mentions?: string[] | null
          platform_variants?: Json | null
          published_at?: string | null
          quality_score?: number | null
          scheduled_at?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "post_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_responses: {
        Row: {
          ai_model: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          brand_id: string
          brand_voice_similarity: number | null
          completion_tokens: number | null
          created_at: string | null
          edit_notes: string | null
          edited_response_text: string | null
          engagement_item_id: string
          external_response_id: string | null
          generation_time_ms: number | null
          id: string
          next_retry_at: string | null
          posted_at: string | null
          posting_error: string | null
          posting_status: string | null
          prompt_tokens: number | null
          reference_content_ids: string[] | null
          rejection_reason: string | null
          response_text: string
          response_variant_number: number | null
          retry_count: number | null
          updated_at: string | null
        }
        Insert: {
          ai_model?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brand_id: string
          brand_voice_similarity?: number | null
          completion_tokens?: number | null
          created_at?: string | null
          edit_notes?: string | null
          edited_response_text?: string | null
          engagement_item_id: string
          external_response_id?: string | null
          generation_time_ms?: number | null
          id?: string
          next_retry_at?: string | null
          posted_at?: string | null
          posting_error?: string | null
          posting_status?: string | null
          prompt_tokens?: number | null
          reference_content_ids?: string[] | null
          rejection_reason?: string | null
          response_text: string
          response_variant_number?: number | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_model?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string
          brand_voice_similarity?: number | null
          completion_tokens?: number | null
          created_at?: string | null
          edit_notes?: string | null
          edited_response_text?: string | null
          engagement_item_id?: string
          external_response_id?: string | null
          generation_time_ms?: number | null
          id?: string
          next_retry_at?: string | null
          posted_at?: string | null
          posting_error?: string | null
          posting_status?: string | null
          prompt_tokens?: number | null
          reference_content_ids?: string[] | null
          rejection_reason?: string | null
          response_text?: string
          response_variant_number?: number | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_responses_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_responses_engagement_item_id_fkey"
            columns: ["engagement_item_id"]
            isOneToOne: false
            referencedRelation: "engagement_items"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_history: {
        Row: {
          ai_model: string | null
          cost: number | null
          created_at: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          post_id: string | null
          request_payload: Json
          request_type: string
          response_content: string | null
          response_metadata: Json | null
          status: string
          tokens_used: number | null
          user_id: string
          workflow_execution_id: string | null
        }
        Insert: {
          ai_model?: string | null
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          post_id?: string | null
          request_payload: Json
          request_type: string
          response_content?: string | null
          response_metadata?: Json | null
          status: string
          tokens_used?: number | null
          user_id: string
          workflow_execution_id?: string | null
        }
        Update: {
          ai_model?: string | null
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          post_id?: string | null
          request_payload?: Json
          request_type?: string
          response_content?: string | null
          response_metadata?: Json | null
          status?: string
          tokens_used?: number | null
          user_id?: string
          workflow_execution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "generated_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          attempt_count: number | null
          created_at: string | null
          currency: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf_url: string | null
          last_finalization_error: Json | null
          metadata: Json | null
          next_payment_attempt: string | null
          paid_at: string | null
          payment_intent_id: string | null
          period_end: string
          period_start: string
          status: string
          stripe_customer_id: string
          stripe_invoice_id: string
          subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          attempt_count?: number | null
          created_at?: string | null
          currency?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          last_finalization_error?: Json | null
          metadata?: Json | null
          next_payment_attempt?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          period_end: string
          period_start: string
          status: string
          stripe_customer_id: string
          stripe_invoice_id: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          attempt_count?: number | null
          created_at?: string | null
          currency?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          last_finalization_error?: Json | null
          metadata?: Json | null
          next_payment_attempt?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_customer_id?: string
          stripe_invoice_id?: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          platform: string
          requests_limit: number
          requests_made: number | null
          resets_at: string
          social_account_id: string
          updated_at: string
          window_duration_seconds: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          platform: string
          requests_limit: number
          requests_made?: number | null
          resets_at: string
          social_account_id: string
          updated_at?: string
          window_duration_seconds: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          platform?: string
          requests_limit?: number
          requests_made?: number | null
          resets_at?: string
          social_account_id?: string
          updated_at?: string
          window_duration_seconds?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_rate_limits_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          alt_text: string | null
          created_at: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          generation_model: string | null
          generation_params: Json | null
          generation_prompt: string | null
          height: number | null
          id: string
          media_type: string
          media_url: string
          mime_type: string | null
          post_id: string
          storage_path: string | null
          thumbnail_url: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          generation_model?: string | null
          generation_params?: Json | null
          generation_prompt?: string | null
          height?: number | null
          id?: string
          media_type: string
          media_url: string
          mime_type?: string | null
          post_id: string
          storage_path?: string | null
          thumbnail_url?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          generation_model?: string | null
          generation_params?: Json | null
          generation_prompt?: string | null
          height?: number | null
          id?: string
          media_type?: string
          media_url?: string
          mime_type?: string | null
          post_id?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "generated_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_templates: {
        Row: {
          content_type: string
          created_at: string | null
          description: string | null
          hashtag_strategy: Json | null
          id: string
          is_active: boolean | null
          name: string
          platform: string
          template_structure: Json
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_type: string
          created_at?: string | null
          description?: string | null
          hashtag_strategy?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          platform: string
          template_structure?: Json
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_type?: string
          created_at?: string | null
          description?: string | null
          hashtag_strategy?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          platform?: string
          template_structure?: Json
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_versions: {
        Row: {
          change_description: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          post_id: string
          version_number: number
        }
        Insert: {
          change_description?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          post_id: string
          version_number: number
        }
        Update: {
          change_description?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          post_id?: string
          version_number?: number
        }
        Relationships: []
      }
      posting_analytics: {
        Row: {
          audience_demographics: Json | null
          clicks: number | null
          comments: number | null
          created_at: string
          engagement_rate: number | null
          id: string
          impressions: number | null
          likes: number | null
          metrics_fetched_at: string
          platform: string
          post_id: string
          reach: number | null
          saves: number | null
          scheduled_post_id: string
          shares: number | null
          updated_at: string
          video_views: number | null
          video_watch_time_seconds: number | null
        }
        Insert: {
          audience_demographics?: Json | null
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metrics_fetched_at?: string
          platform: string
          post_id: string
          reach?: number | null
          saves?: number | null
          scheduled_post_id: string
          shares?: number | null
          updated_at?: string
          video_views?: number | null
          video_watch_time_seconds?: number | null
        }
        Update: {
          audience_demographics?: Json | null
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metrics_fetched_at?: string
          platform?: string
          post_id?: string
          reach?: number | null
          saves?: number | null
          scheduled_post_id?: string
          shares?: number | null
          updated_at?: string
          video_views?: number | null
          video_watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posting_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_analytics_scheduled_post_id_fkey"
            columns: ["scheduled_post_id"]
            isOneToOne: true
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          ai_model: string | null
          approval_status: string | null
          body: string
          brand_id: string
          content_type: string
          created_at: string
          generation_metadata: Json | null
          generation_prompt: string | null
          hashtags: Json | null
          id: string
          media_urls: Json | null
          mentions: Json | null
          platform_specific_data: Json | null
          published_at: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          approval_status?: string | null
          body: string
          brand_id: string
          content_type: string
          created_at?: string
          generation_metadata?: Json | null
          generation_prompt?: string | null
          hashtags?: Json | null
          id?: string
          media_urls?: Json | null
          mentions?: Json | null
          platform_specific_data?: Json | null
          published_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          approval_status?: string | null
          body?: string
          brand_id?: string
          content_type?: string
          created_at?: string
          generation_metadata?: Json | null
          generation_prompt?: string | null
          hashtags?: Json | null
          id?: string
          media_urls?: Json | null
          mentions?: Json | null
          platform_specific_data?: Json | null
          published_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_metadata: Json | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          email: string
          email_verified: boolean | null
          full_name: string | null
          id: string
          last_sign_in_at: string | null
          onboarding_completed: boolean | null
          role: string
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          auth_metadata?: Json | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          last_sign_in_at?: string | null
          onboarding_completed?: boolean | null
          role?: string
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          auth_metadata?: Json | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          onboarding_completed?: boolean | null
          role?: string
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          brand_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          next_retry_at: string | null
          platform_post_id: string | null
          platform_url: string | null
          post_id: string
          processing_completed_at: string | null
          processing_started_at: string | null
          published_at: string | null
          rate_limit_metadata: Json | null
          retry_count: number | null
          scheduled_for: string
          social_account_id: string
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          platform_post_id?: string | null
          platform_url?: string | null
          post_id: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          published_at?: string | null
          rate_limit_metadata?: Json | null
          retry_count?: number | null
          scheduled_for: string
          social_account_id: string
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          platform_post_id?: string | null
          platform_url?: string | null
          post_id?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          published_at?: string | null
          rate_limit_metadata?: Json | null
          retry_count?: number | null
          scheduled_for?: string
          social_account_id?: string
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token_encrypted: string | null
          account_id: string
          account_name: string
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          platform: string
          refresh_token_encrypted: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_id: string
          account_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform: string
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_id?: string
          account_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform?: string
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          limits: Json
          name: string
          plan_id: string
          price_monthly_cents: number
          price_yearly_cents: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          limits?: Json
          name: string
          plan_id: string
          price_monthly_cents: number
          price_yearly_cents?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          limits?: Json
          name?: string
          plan_id?: string
          price_monthly_cents?: number
          price_yearly_cents?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          default_payment_method: string | null
          id: string
          latest_invoice_id: string | null
          metadata: Json | null
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          default_payment_method?: string | null
          id?: string
          latest_invoice_id?: string | null
          metadata?: Json | null
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          default_payment_method?: string | null
          id?: string
          latest_invoice_id?: string | null
          metadata?: Json | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      target_audiences: {
        Row: {
          brand_id: string
          content_types: Json | null
          created_at: string | null
          demographics: Json | null
          goals: Json | null
          id: string
          is_primary: boolean | null
          messaging_preferences: string | null
          motivations: Json | null
          online_behavior: Json | null
          pain_points: Json | null
          persona_name: string
          preferred_channels: Json | null
          psychographics: Json | null
          purchase_behavior: Json | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          content_types?: Json | null
          created_at?: string | null
          demographics?: Json | null
          goals?: Json | null
          id?: string
          is_primary?: boolean | null
          messaging_preferences?: string | null
          motivations?: Json | null
          online_behavior?: Json | null
          pain_points?: Json | null
          persona_name: string
          preferred_channels?: Json | null
          psychographics?: Json | null
          purchase_behavior?: Json | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          content_types?: Json | null
          created_at?: string | null
          demographics?: Json | null
          goals?: Json | null
          id?: string
          is_primary?: boolean | null
          messaging_preferences?: string | null
          motivations?: Json | null
          online_behavior?: Json | null
          pain_points?: Json | null
          persona_name?: string
          preferred_channels?: Json | null
          psychographics?: Json | null
          purchase_behavior?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_audiences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          ai_content_generations: number | null
          ai_credits_consumed: number | null
          ai_image_generations: number | null
          api_calls: number | null
          brands_created: number | null
          created_at: string | null
          id: string
          media_files_count: number | null
          metadata: Json | null
          period_end: string
          period_start: string
          posts_created: number | null
          posts_published: number | null
          posts_scheduled: number | null
          social_accounts_connected: number | null
          storage_bytes: number | null
          subscription_id: string | null
          updated_at: string | null
          user_id: string
          webhook_calls: number | null
        }
        Insert: {
          ai_content_generations?: number | null
          ai_credits_consumed?: number | null
          ai_image_generations?: number | null
          api_calls?: number | null
          brands_created?: number | null
          created_at?: string | null
          id?: string
          media_files_count?: number | null
          metadata?: Json | null
          period_end: string
          period_start: string
          posts_created?: number | null
          posts_published?: number | null
          posts_scheduled?: number | null
          social_accounts_connected?: number | null
          storage_bytes?: number | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
          webhook_calls?: number | null
        }
        Update: {
          ai_content_generations?: number | null
          ai_credits_consumed?: number | null
          ai_image_generations?: number | null
          api_calls?: number | null
          brands_created?: number | null
          created_at?: string | null
          id?: string
          media_files_count?: number | null
          metadata?: Json | null
          period_end?: string
          period_start?: string
          posts_created?: number | null
          posts_published?: number | null
          posts_scheduled?: number | null
          social_accounts_connected?: number | null
          storage_bytes?: number | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_calls?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          api_version: string | null
          created_at: string | null
          error_message: string | null
          error_stack: string | null
          event_data: Json
          event_type: string
          id: string
          processed: boolean | null
          processed_at: string | null
          processing_attempts: number | null
          request_id: string | null
          stripe_event_id: string
          updated_at: string | null
        }
        Insert: {
          api_version?: string | null
          created_at?: string | null
          error_message?: string | null
          error_stack?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          processing_attempts?: number | null
          request_id?: string | null
          stripe_event_id: string
          updated_at?: string | null
        }
        Update: {
          api_version?: string | null
          created_at?: string | null
          error_message?: string | null
          error_stack?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          processing_attempts?: number | null
          request_id?: string | null
          stripe_event_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_response: {
        Args: { p_edited_text?: string; p_response_id: string }
        Returns: Json
      }
      calculate_engagement_metrics: {
        Args: { p_brand_id: string; p_date: string }
        Returns: undefined
      }
      calculate_next_retry: { Args: { p_retry_count: number }; Returns: string }
      can_perform_action: {
        Args: { p_action: string; p_user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_limit: number
          p_platform: string
          p_social_account_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_old_engagements: { Args: never; Returns: undefined }
      complete_onboarding: { Args: { user_id: string }; Returns: boolean }
      decrypt_token: {
        Args: { encrypted_token: string; secret: string }
        Returns: string
      }
      encrypt_token: {
        Args: { secret: string; token: string }
        Returns: string
      }
      get_active_subscription: {
        Args: { p_user_id: string }
        Returns: {
          current_period_end: string
          limits: Json
          plan_id: string
          status: string
          subscription_id: string
        }[]
      }
      get_approval_queue: {
        Args: { p_brand_id: string }
        Returns: {
          author_username: string
          content: string
          created_at: string
          engagement_id: string
          priority: string
          response_id: string
          response_text: string
          sentiment: string
        }[]
      }
      get_brand_context: { Args: { p_brand_id: string }; Returns: Json }
      get_current_usage: {
        Args: { p_user_id: string }
        Returns: {
          ai_credits_consumed: number
          brands_created: number
          posts_created: number
          social_accounts_connected: number
        }[]
      }
      get_engagement_analytics: {
        Args: { p_brand_id: string; p_days?: number }
        Returns: Json
      }
      get_posts_due_for_publishing: {
        Args: { p_lookahead_minutes?: number }
        Returns: {
          content: string
          media_urls: Json
          platform: string
          post_id: string
          scheduled_for: string
          scheduled_post_id: string
          social_account_id: string
        }[]
      }
      get_posts_due_for_retry: {
        Args: never
        Returns: {
          error_message: string
          platform: string
          post_id: string
          retry_count: number
          scheduled_post_id: string
          social_account_id: string
        }[]
      }
      get_subscription_tier: { Args: { user_id: string }; Returns: string }
      increment_pillar_usage: {
        Args: { pillar_id: string }
        Returns: undefined
      }
      increment_rate_limit: {
        Args: { p_endpoint: string; p_social_account_id: string }
        Returns: undefined
      }
      increment_usage: {
        Args: { p_amount?: number; p_metric: string; p_user_id: string }
        Returns: boolean
      }
      is_onboarding_complete: { Args: { user_id: string }; Returns: boolean }
      reject_response: {
        Args: { p_reason: string; p_response_id: string }
        Returns: Json
      }
      search_global_content: {
        Args: { p_limit?: number; p_query_embedding: string; p_user_id: string }
        Returns: {
          brand_id: string
          brand_name: string
          content: string
          content_type: string
          id: string
          similarity: number
        }[]
      }
      search_similar_content: {
        Args: {
          p_brand_id: string
          p_limit?: number
          p_query_embedding: string
        }
        Returns: {
          content: string
          content_type: string
          id: string
          similarity: number
        }[]
      }
      search_similar_voice: {
        Args: { p_limit?: number; p_query_embedding: string }
        Returns: {
          brand_id: string
          brand_name: string
          similarity: number
        }[]
      }
      update_profile_from_oauth: {
        Args: { oauth_data: Json; provider: string; user_id: string }
        Returns: undefined
      }
      update_scheduled_post_status: {
        Args: {
          p_error_message?: string
          p_new_status: string
          p_platform_post_id?: string
          p_platform_url?: string
          p_scheduled_post_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
