-- Engagement Agent Schema
-- Migration: 00005_engagement_agent_schema
-- Description: Tables for monitoring social engagement, generating AI responses, and managing approval workflow
-- Features: Multi-tenant isolation, sentiment analysis, rate limiting, approval queue

-- ============================================================================
-- ENGAGEMENT_ITEMS TABLE - Incoming comments/DMs to respond to
-- ============================================================================
CREATE TABLE public.engagement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Source Information
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok', 'facebook')),
    social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,

    -- Engagement Details
    engagement_type VARCHAR(50) NOT NULL CHECK (engagement_type IN ('comment', 'dm', 'mention', 'reply')),
    external_id VARCHAR(500) NOT NULL, -- Platform's ID for the comment/DM
    parent_post_id VARCHAR(500), -- ID of the post being commented on (if applicable)

    -- Content
    author_username VARCHAR(255) NOT NULL,
    author_display_name VARCHAR(255),
    author_profile_url TEXT,
    content TEXT NOT NULL,

    -- Context
    original_post_content TEXT, -- Content of the post being commented on
    conversation_context JSONB DEFAULT '[]'::jsonb, -- Thread history if applicable

    -- Analysis
    sentiment VARCHAR(50) DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
    sentiment_score FLOAT, -- -1.0 to 1.0
    detected_intent VARCHAR(100), -- "customer_service", "compliment", "question", "spam"
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Classification
    is_spam BOOLEAN DEFAULT false,
    requires_response BOOLEAN DEFAULT true,
    is_influencer BOOLEAN DEFAULT false, -- Flag for high-follower accounts

    -- Processing Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'responded', 'ignored', 'failed')),
    processed_at TIMESTAMPTZ,

    -- Metadata
    raw_data JSONB, -- Full platform API response
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique engagement items per platform
    UNIQUE(platform, external_id)
);

-- Create indexes for performance
CREATE INDEX idx_engagement_items_brand_id ON public.engagement_items(brand_id);
CREATE INDEX idx_engagement_items_social_account_id ON public.engagement_items(social_account_id);
CREATE INDEX idx_engagement_items_platform ON public.engagement_items(platform);
CREATE INDEX idx_engagement_items_status ON public.engagement_items(status);
CREATE INDEX idx_engagement_items_priority ON public.engagement_items(priority);
CREATE INDEX idx_engagement_items_sentiment ON public.engagement_items(sentiment);
CREATE INDEX idx_engagement_items_created_at ON public.engagement_items(created_at DESC);
CREATE INDEX idx_engagement_items_requires_response ON public.engagement_items(requires_response) WHERE requires_response = true;

-- Add comment
COMMENT ON TABLE public.engagement_items IS 'Incoming social media comments and DMs with sentiment analysis and priority scoring';

-- ============================================================================
-- GENERATED_RESPONSES TABLE - AI-generated replies awaiting approval
-- ============================================================================
CREATE TABLE public.generated_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_item_id UUID NOT NULL REFERENCES public.engagement_items(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Response Content
    response_text TEXT NOT NULL,
    response_variant_number INTEGER DEFAULT 1, -- If multiple variants generated

    -- AI Metadata
    ai_model VARCHAR(100), -- "gpt-4", "claude-3.5-sonnet"
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    generation_time_ms INTEGER,

    -- Brand Context Used
    brand_voice_similarity FLOAT, -- Similarity score to brand voice (0-1)
    reference_content_ids UUID[], -- IDs from brand_content_examples used for context

    -- Approval Workflow
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'edited')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Edited Version (if user modified the AI response)
    edited_response_text TEXT,
    edit_notes TEXT,

    -- Posting Status
    posting_status VARCHAR(50) DEFAULT 'queued' CHECK (posting_status IN ('queued', 'posting', 'posted', 'failed')),
    posted_at TIMESTAMPTZ,
    posting_error TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,

    -- Platform Response
    external_response_id VARCHAR(500), -- Platform's ID for the posted response

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_generated_responses_engagement_item_id ON public.generated_responses(engagement_item_id);
CREATE INDEX idx_generated_responses_brand_id ON public.generated_responses(brand_id);
CREATE INDEX idx_generated_responses_approval_status ON public.generated_responses(approval_status);
CREATE INDEX idx_generated_responses_posting_status ON public.generated_responses(posting_status);
CREATE INDEX idx_generated_responses_approved_by ON public.generated_responses(approved_by);
CREATE INDEX idx_generated_responses_next_retry_at ON public.generated_responses(next_retry_at) WHERE posting_status = 'failed';

-- Add comment
COMMENT ON TABLE public.generated_responses IS 'AI-generated responses with approval workflow and posting status tracking';

-- ============================================================================
-- ENGAGEMENT_HISTORY TABLE - Posted responses with performance tracking
-- ============================================================================
CREATE TABLE public.engagement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_item_id UUID NOT NULL REFERENCES public.engagement_items(id) ON DELETE CASCADE,
    generated_response_id UUID NOT NULL REFERENCES public.generated_responses(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Response Details
    response_text TEXT NOT NULL, -- Final text that was posted
    was_edited BOOLEAN DEFAULT false, -- Whether user edited the AI response

    -- Platform Details
    platform VARCHAR(50) NOT NULL,
    external_response_id VARCHAR(500) NOT NULL, -- Platform's ID for this response
    response_url TEXT, -- URL to view the response

    -- Performance Metrics
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,

    -- Follow-up Tracking
    generated_follow_up BOOLEAN DEFAULT false, -- Did this response spawn more engagement?
    follow_up_engagement_ids UUID[], -- IDs of subsequent engagement_items in the thread

    -- Timing Analysis
    response_time_minutes INTEGER, -- Time from original comment to response posting

    -- Learning Data
    user_satisfaction_rating INTEGER CHECK (user_satisfaction_rating BETWEEN 1 AND 5), -- User can rate the quality
    ai_confidence_score FLOAT, -- Model's confidence in the response quality

    -- Metadata
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ, -- Last time metrics were updated from platform
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_engagement_history_engagement_item_id ON public.engagement_history(engagement_item_id);
CREATE INDEX idx_engagement_history_generated_response_id ON public.engagement_history(generated_response_id);
CREATE INDEX idx_engagement_history_brand_id ON public.engagement_history(brand_id);
CREATE INDEX idx_engagement_history_platform ON public.engagement_history(platform);
CREATE INDEX idx_engagement_history_posted_at ON public.engagement_history(posted_at DESC);

-- Add comment
COMMENT ON TABLE public.engagement_history IS 'Historical record of posted responses with performance metrics and learning data';

-- ============================================================================
-- ENGAGEMENT_RULES TABLE - Auto-response and filtering rules
-- ============================================================================
CREATE TABLE public.engagement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Rule Identification
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority rules checked first

    -- Matching Conditions
    conditions JSONB NOT NULL, -- {keywords: [], sentiment: "positive", platforms: ["instagram"], author_follower_min: 1000}

    -- Action
    action VARCHAR(50) NOT NULL CHECK (action IN ('auto_approve', 'auto_ignore', 'flag_urgent', 'assign_template')),
    action_config JSONB DEFAULT '{}'::jsonb, -- Additional config for the action

    -- Template (if action is 'assign_template')
    response_template TEXT, -- Template with variables like {author_name}, {brand_name}

    -- Statistics
    times_triggered INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_engagement_rules_brand_id ON public.engagement_rules(brand_id);
CREATE INDEX idx_engagement_rules_is_active ON public.engagement_rules(is_active);
CREATE INDEX idx_engagement_rules_priority ON public.engagement_rules(priority DESC);

-- Add comment
COMMENT ON TABLE public.engagement_rules IS 'Automated rules for filtering, prioritizing, and auto-approving responses';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.engagement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_rules ENABLE ROW LEVEL SECURITY;

-- ===================
-- ENGAGEMENT_ITEMS POLICIES
-- ===================

CREATE POLICY "Users can view engagement for their brands"
    ON public.engagement_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = engagement_items.brand_id
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert engagement for their brands"
    ON public.engagement_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = engagement_items.brand_id
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update engagement for their brands"
    ON public.engagement_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = engagement_items.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- GENERATED_RESPONSES POLICIES
-- ===================

CREATE POLICY "Users can view responses for their brands"
    ON public.generated_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = generated_responses.brand_id
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert responses for their brands"
    ON public.generated_responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = generated_responses.brand_id
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update responses for their brands"
    ON public.generated_responses FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = generated_responses.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- ENGAGEMENT_HISTORY POLICIES
-- ===================

CREATE POLICY "Users can view history for their brands"
    ON public.engagement_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = engagement_history.brand_id
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert history for their brands"
    ON public.engagement_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = engagement_history.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- ENGAGEMENT_RULES POLICIES
-- ===================

CREATE POLICY "Users can manage rules for their brands"
    ON public.engagement_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = engagement_rules.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get pending approval queue for a brand
CREATE OR REPLACE FUNCTION public.get_approval_queue(p_brand_id UUID)
RETURNS TABLE (
    engagement_id UUID,
    response_id UUID,
    author_username VARCHAR,
    content TEXT,
    response_text TEXT,
    sentiment VARCHAR,
    priority VARCHAR,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    RETURN QUERY
    SELECT
        ei.id AS engagement_id,
        gr.id AS response_id,
        ei.author_username,
        ei.content,
        gr.response_text,
        ei.sentiment,
        ei.priority,
        gr.created_at
    FROM public.generated_responses gr
    JOIN public.engagement_items ei ON ei.id = gr.engagement_item_id
    WHERE gr.brand_id = p_brand_id
        AND gr.approval_status = 'pending'
        AND gr.posting_status = 'queued'
    ORDER BY
        CASE ei.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
        END,
        gr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve a response
CREATE OR REPLACE FUNCTION public.approve_response(
    p_response_id UUID,
    p_edited_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_brand_id UUID;
    v_result JSON;
BEGIN
    -- Get brand_id and verify ownership
    SELECT brand_id INTO v_brand_id
    FROM public.generated_responses
    WHERE id = p_response_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = v_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to response';
    END IF;

    -- Update response
    UPDATE public.generated_responses
    SET
        approval_status = CASE WHEN p_edited_text IS NOT NULL THEN 'edited' ELSE 'approved' END,
        approved_by = auth.uid(),
        approved_at = NOW(),
        edited_response_text = p_edited_text,
        posting_status = 'queued',
        updated_at = NOW()
    WHERE id = p_response_id;

    -- Return updated response
    SELECT json_build_object(
        'id', id,
        'approval_status', approval_status,
        'posting_status', posting_status,
        'approved_at', approved_at
    ) INTO v_result
    FROM public.generated_responses
    WHERE id = p_response_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a response
CREATE OR REPLACE FUNCTION public.reject_response(
    p_response_id UUID,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_brand_id UUID;
    v_result JSON;
BEGIN
    -- Get brand_id and verify ownership
    SELECT brand_id INTO v_brand_id
    FROM public.generated_responses
    WHERE id = p_response_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = v_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to response';
    END IF;

    -- Update response
    UPDATE public.generated_responses
    SET
        approval_status = 'rejected',
        rejection_reason = p_reason,
        posting_status = 'failed',
        updated_at = NOW()
    WHERE id = p_response_id;

    -- Update engagement item status
    UPDATE public.engagement_items
    SET
        status = 'ignored',
        updated_at = NOW()
    WHERE id = (SELECT engagement_item_id FROM public.generated_responses WHERE id = p_response_id);

    -- Return result
    SELECT json_build_object(
        'id', id,
        'approval_status', approval_status,
        'rejection_reason', rejection_reason
    ) INTO v_result
    FROM public.generated_responses
    WHERE id = p_response_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get engagement analytics for a brand
CREATE OR REPLACE FUNCTION public.get_engagement_analytics(
    p_brand_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    SELECT json_build_object(
        'total_engagement_items', (
            SELECT COUNT(*)
            FROM public.engagement_items
            WHERE brand_id = p_brand_id
                AND created_at > NOW() - INTERVAL '1 day' * p_days
        ),
        'pending_responses', (
            SELECT COUNT(*)
            FROM public.generated_responses
            WHERE brand_id = p_brand_id
                AND approval_status = 'pending'
        ),
        'approved_responses', (
            SELECT COUNT(*)
            FROM public.generated_responses
            WHERE brand_id = p_brand_id
                AND approval_status IN ('approved', 'edited')
                AND created_at > NOW() - INTERVAL '1 day' * p_days
        ),
        'posted_responses', (
            SELECT COUNT(*)
            FROM public.engagement_history
            WHERE brand_id = p_brand_id
                AND posted_at > NOW() - INTERVAL '1 day' * p_days
        ),
        'avg_response_time_minutes', (
            SELECT AVG(response_time_minutes)
            FROM public.engagement_history
            WHERE brand_id = p_brand_id
                AND posted_at > NOW() - INTERVAL '1 day' * p_days
        ),
        'sentiment_distribution', (
            SELECT json_object_agg(sentiment, count)
            FROM (
                SELECT sentiment, COUNT(*) as count
                FROM public.engagement_items
                WHERE brand_id = p_brand_id
                    AND created_at > NOW() - INTERVAL '1 day' * p_days
                GROUP BY sentiment
            ) sub
        ),
        'platform_distribution', (
            SELECT json_object_agg(platform, count)
            FROM (
                SELECT platform, COUNT(*) as count
                FROM public.engagement_items
                WHERE brand_id = p_brand_id
                    AND created_at > NOW() - INTERVAL '1 day' * p_days
                GROUP BY platform
            ) sub
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_engagement_items_updated_at
    BEFORE UPDATE ON public.engagement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generated_responses_updated_at
    BEFORE UPDATE ON public.generated_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_engagement_history_updated_at
    BEFORE UPDATE ON public.engagement_history
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_engagement_rules_updated_at
    BEFORE UPDATE ON public.engagement_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Add migration success comment
COMMENT ON SCHEMA public IS 'SMGE Engagement Agent system with approval workflow and analytics - Migration 00005 completed';
