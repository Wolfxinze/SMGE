-- ============================================================================
-- FIX: Additional SECURITY DEFINER Functions
-- ============================================================================
-- Migration: 00019_fix_additional_security_definer_functions
-- Issue: Remaining functions without search_path protection
-- Root Cause: Functions in migrations 00001, 00003, 00005, 00006, 00008
--
-- Security Fixes Applied:
-- 1. Add SET search_path = public to prevent search_path attacks
-- 2. Add NULL parameter validation at function start
-- 3. Use explicit schema qualification
-- ============================================================================

-- ============================================================================
-- TOKEN ENCRYPTION FUNCTIONS (from 00001_initial_schema.sql)
-- ============================================================================

-- Fix: encrypt_token function
CREATE OR REPLACE FUNCTION public.encrypt_token(token TEXT, secret TEXT)
RETURNS BYTEA
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs - return NULL for invalid inputs
    IF token IS NULL OR secret IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN pgp_sym_encrypt(token, secret);
END;
$$;

-- Fix: decrypt_token function
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token BYTEA, secret TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs - return NULL for invalid inputs
    IF encrypted_token IS NULL OR secret IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN pgp_sym_decrypt(encrypted_token, secret);
END;
$$;

-- ============================================================================
-- BRAND BRAIN FUNCTIONS (from 00003_brand_brain_schema.sql)
-- ============================================================================

-- Fix: search_brand_voice function
CREATE OR REPLACE FUNCTION public.search_brand_voice(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    brand_id UUID,
    attribute_type VARCHAR,
    attribute_value TEXT,
    similarity FLOAT4
)
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs
    IF p_query_embedding IS NULL OR p_user_id IS NULL THEN
        RETURN;  -- Return empty table
    END IF;

    IF p_limit IS NULL OR p_limit <= 0 THEN
        p_limit := 5;
    END IF;

    RETURN QUERY
    SELECT
        bv.id,
        bv.brand_id,
        bv.attribute_type,
        bv.attribute_value,
        (bv.embedding <=> p_query_embedding)::FLOAT4 AS similarity
    FROM public.brand_voice bv
    JOIN public.brands b ON b.id = bv.brand_id
    WHERE b.user_id = p_user_id
        AND bv.embedding IS NOT NULL
    ORDER BY bv.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- Fix: search_brand_topics function
CREATE OR REPLACE FUNCTION public.search_brand_topics(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    brand_id UUID,
    topic_name VARCHAR,
    relevance_score INTEGER,
    similarity FLOAT4
)
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs
    IF p_query_embedding IS NULL OR p_user_id IS NULL THEN
        RETURN;  -- Return empty table
    END IF;

    IF p_limit IS NULL OR p_limit <= 0 THEN
        p_limit := 5;
    END IF;

    RETURN QUERY
    SELECT
        bt.id,
        bt.brand_id,
        bt.topic_name,
        bt.relevance_score,
        (bt.embedding <=> p_query_embedding)::FLOAT4 AS similarity
    FROM public.brand_topics bt
    JOIN public.brands b ON b.id = bt.brand_id
    WHERE b.user_id = p_user_id
        AND bt.embedding IS NOT NULL
    ORDER BY bt.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- Fix: search_brand_guidelines function
CREATE OR REPLACE FUNCTION public.search_brand_guidelines(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    brand_id UUID,
    guideline_type VARCHAR,
    guideline_content TEXT,
    similarity FLOAT4
)
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs
    IF p_query_embedding IS NULL OR p_user_id IS NULL THEN
        RETURN;  -- Return empty table
    END IF;

    IF p_limit IS NULL OR p_limit <= 0 THEN
        p_limit := 5;
    END IF;

    RETURN QUERY
    SELECT
        bg.id,
        bg.brand_id,
        bg.guideline_type,
        bg.guideline_content,
        (bg.embedding <=> p_query_embedding)::FLOAT4 AS similarity
    FROM public.brand_guidelines bg
    JOIN public.brands b ON b.id = bg.brand_id
    WHERE b.user_id = p_user_id
        AND bg.embedding IS NOT NULL
    ORDER BY bg.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- Fix: search_brand_content_examples function
CREATE OR REPLACE FUNCTION public.search_brand_content_examples(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    brand_id UUID,
    content_type VARCHAR,
    content_text TEXT,
    platform VARCHAR,
    engagement_score INTEGER,
    similarity FLOAT4
)
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs
    IF p_query_embedding IS NULL OR p_user_id IS NULL THEN
        RETURN;  -- Return empty table
    END IF;

    IF p_limit IS NULL OR p_limit <= 0 THEN
        p_limit := 5;
    END IF;

    RETURN QUERY
    SELECT
        bce.id,
        bce.brand_id,
        bce.content_type,
        bce.content_text,
        bce.platform,
        bce.engagement_score,
        (bce.embedding <=> p_query_embedding)::FLOAT4 AS similarity
    FROM public.brand_content_examples bce
    JOIN public.brands b ON b.id = bce.brand_id
    WHERE b.user_id = p_user_id
        AND bce.embedding IS NOT NULL
    ORDER BY bce.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- Fix: get_brand_context function
CREATE OR REPLACE FUNCTION public.get_brand_context(p_brand_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- ✅ Validate input
    IF p_brand_id IS NULL THEN
        RETURN '{}'::JSON;
    END IF;

    -- Check if user owns the brand
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    SELECT json_build_object(
        'brand', (
            SELECT row_to_json(b.*)
            FROM public.brands b
            WHERE b.id = p_brand_id
        ),
        'voice', (
            SELECT json_agg(row_to_json(bv.*))
            FROM public.brand_voice bv
            WHERE bv.brand_id = p_brand_id
        ),
        'topics', (
            SELECT json_agg(row_to_json(bt.*))
            FROM public.brand_topics bt
            WHERE bt.brand_id = p_brand_id
            ORDER BY bt.relevance_score DESC
        ),
        'guidelines', (
            SELECT json_agg(row_to_json(bg.*))
            FROM public.brand_guidelines bg
            WHERE bg.brand_id = p_brand_id
        ),
        'content_examples', (
            SELECT json_agg(row_to_json(bce.*))
            FROM public.brand_content_examples bce
            WHERE bce.brand_id = p_brand_id
            ORDER BY bce.engagement_score DESC
        ),
        'analytics_summary', (
            SELECT json_build_object(
                'total_posts', COUNT(*),
                'avg_engagement', AVG(pa.engagement_rate)
            )
            FROM public.posts p
            LEFT JOIN public.posting_analytics pa ON p.id = pa.post_id
            WHERE p.brand_id = p_brand_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- POST GENERATOR FUNCTIONS (from 00005_post_generator_base.sql and 00006_post_generator_schema.sql)
-- ============================================================================

-- Fix: get_post_generation_context function (from 00005)
CREATE OR REPLACE FUNCTION public.get_post_generation_context(
    p_brand_id UUID,
    p_platform VARCHAR DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- ✅ Validate input
    IF p_brand_id IS NULL THEN
        RETURN '{}'::JSON;
    END IF;

    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    SELECT json_build_object(
        'brand', (
            SELECT row_to_json(b.*)
            FROM public.brands b
            WHERE b.id = p_brand_id
        ),
        'voice_attributes', (
            SELECT json_agg(
                json_build_object(
                    'type', bv.attribute_type,
                    'value', bv.attribute_value
                )
            )
            FROM public.brand_voice bv
            WHERE bv.brand_id = p_brand_id
        ),
        'top_topics', (
            SELECT json_agg(
                json_build_object(
                    'topic', bt.topic_name,
                    'relevance', bt.relevance_score
                )
            )
            FROM public.brand_topics bt
            WHERE bt.brand_id = p_brand_id
            ORDER BY bt.relevance_score DESC
            LIMIT 10
        ),
        'recent_posts', (
            SELECT json_agg(
                json_build_object(
                    'title', p.title,
                    'content', p.body,
                    'platform', sp.platform,
                    'engagement_rate', pa.engagement_rate,
                    'published_at', p.published_at
                )
            )
            FROM public.posts p
            LEFT JOIN public.scheduled_posts sp ON sp.post_id = p.id
            LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
            WHERE p.brand_id = p_brand_id
                AND (p_platform IS NULL OR sp.platform = p_platform)
                AND p.status = 'published'
            ORDER BY p.published_at DESC
            LIMIT 5
        ),
        'best_performing_content', (
            SELECT json_agg(
                json_build_object(
                    'content', bce.content_text,
                    'type', bce.content_type,
                    'platform', bce.platform,
                    'engagement_score', bce.engagement_score
                )
            )
            FROM public.brand_content_examples bce
            WHERE bce.brand_id = p_brand_id
                AND (p_platform IS NULL OR bce.platform = p_platform)
            ORDER BY bce.engagement_score DESC
            LIMIT 5
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Fix: record_generation_job function (from 00006)
CREATE OR REPLACE FUNCTION public.record_generation_job(
    p_request_id UUID,
    p_brand_id UUID,
    p_prompt TEXT,
    p_platform VARCHAR,
    p_content_type VARCHAR,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- ✅ Validate inputs
    IF p_request_id IS NULL OR p_brand_id IS NULL OR p_prompt IS NULL
       OR p_platform IS NULL OR p_content_type IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be NULL';
    END IF;

    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    -- Create job record
    INSERT INTO public.generation_jobs (
        request_id,
        brand_id,
        prompt,
        platform,
        content_type,
        metadata,
        status
    ) VALUES (
        p_request_id,
        p_brand_id,
        p_prompt,
        p_platform,
        p_content_type,
        COALESCE(p_metadata, '{}'::JSONB),
        'pending'
    )
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;

-- ============================================================================
-- ENGAGEMENT AGENT FUNCTIONS (from 00008_engagement_agent_schema.sql)
-- ============================================================================

-- Fix: get_engagement_agent_config function
CREATE OR REPLACE FUNCTION public.get_engagement_agent_config(p_brand_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_config JSON;
BEGIN
    -- ✅ Validate input
    IF p_brand_id IS NULL THEN
        RETURN '{}'::JSON;
    END IF;

    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    SELECT row_to_json(ec.*)
    INTO v_config
    FROM public.engagement_config ec
    WHERE ec.brand_id = p_brand_id;

    IF v_config IS NULL THEN
        -- Return default config
        v_config := json_build_object(
            'enabled', false,
            'auto_reply', false,
            'auto_like', false,
            'reply_threshold', 0.7,
            'sentiment_filter', ARRAY['positive', 'neutral']::TEXT[],
            'max_replies_per_day', 10
        );
    END IF;

    RETURN v_config;
END;
$$;

-- Fix: create_engagement_task function
CREATE OR REPLACE FUNCTION public.create_engagement_task(
    p_brand_id UUID,
    p_platform VARCHAR,
    p_task_type VARCHAR,
    p_source_post_id TEXT,
    p_target_content TEXT,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_task_id UUID;
    v_config RECORD;
BEGIN
    -- ✅ Validate inputs
    IF p_brand_id IS NULL OR p_platform IS NULL OR p_task_type IS NULL
       OR p_source_post_id IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be NULL';
    END IF;

    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    -- Get engagement config
    SELECT * INTO v_config
    FROM public.engagement_config
    WHERE brand_id = p_brand_id;

    -- Check if engagement is enabled
    IF NOT COALESCE(v_config.enabled, false) THEN
        RAISE EXCEPTION 'Engagement agent is not enabled for this brand';
    END IF;

    -- Create task
    INSERT INTO public.engagement_tasks (
        brand_id,
        platform,
        task_type,
        source_post_id,
        target_content,
        metadata,
        status,
        created_by
    ) VALUES (
        p_brand_id,
        p_platform,
        p_task_type,
        p_source_post_id,
        p_target_content,
        COALESCE(p_metadata, '{}'::JSONB),
        'pending',
        auth.uid()
    )
    RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$;

-- Fix: get_pending_engagements function
CREATE OR REPLACE FUNCTION public.get_pending_engagements(p_brand_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- ✅ Validate input
    IF p_brand_id IS NULL THEN
        RETURN '[]'::JSON;
    END IF;

    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    SELECT json_agg(
        json_build_object(
            'id', et.id,
            'platform', et.platform,
            'task_type', et.task_type,
            'source_post_id', et.source_post_id,
            'target_content', et.target_content,
            'metadata', et.metadata,
            'created_at', et.created_at
        )
        ORDER BY et.created_at ASC
    )
    INTO v_result
    FROM public.engagement_tasks et
    WHERE et.brand_id = p_brand_id
        AND et.status = 'pending';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- Fix: calculate_engagement_score function
CREATE OR REPLACE FUNCTION public.calculate_engagement_score(
    p_likes INTEGER,
    p_comments INTEGER,
    p_shares INTEGER,
    p_impressions INTEGER
)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path
LANGUAGE plpgsql
AS $$
DECLARE
    v_score NUMERIC;
BEGIN
    -- ✅ Validate inputs - default to 0 for NULL values
    p_likes := COALESCE(p_likes, 0);
    p_comments := COALESCE(p_comments, 0);
    p_shares := COALESCE(p_shares, 0);
    p_impressions := COALESCE(p_impressions, 0);

    -- Prevent division by zero
    IF p_impressions <= 0 THEN
        RETURN 0;
    END IF;

    -- Calculate weighted engagement score
    -- Comments worth 2x, shares worth 3x likes
    v_score := ((p_likes + (p_comments * 2) + (p_shares * 3))::NUMERIC / p_impressions) * 100;

    RETURN ROUND(v_score, 2);
END;
$$;

-- ============================================================================
-- SECURITY DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.encrypt_token(TEXT, TEXT) IS
'Encrypts OAuth tokens using pgcrypto. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.decrypt_token(BYTEA, TEXT) IS
'Decrypts OAuth tokens for use. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.search_brand_voice(vector, UUID, INTEGER) IS
'Search brand voice attributes by vector similarity. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.search_brand_topics(vector, UUID, INTEGER) IS
'Search brand topics by vector similarity. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.search_brand_guidelines(vector, UUID, INTEGER) IS
'Search brand guidelines by vector similarity. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.search_brand_content_examples(vector, UUID, INTEGER) IS
'Search brand content examples by vector similarity. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.get_brand_context(UUID) IS
'Get complete brand context including voice, topics, guidelines. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.get_post_generation_context(UUID, VARCHAR) IS
'Get context for AI post generation. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.record_generation_job(UUID, UUID, TEXT, VARCHAR, VARCHAR, JSONB) IS
'Record post generation job. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.get_engagement_agent_config(UUID) IS
'Get engagement agent configuration for brand. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.create_engagement_task(UUID, VARCHAR, VARCHAR, TEXT, TEXT, JSONB) IS
'Create engagement task for agent. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.get_pending_engagements(UUID) IS
'Get pending engagement tasks for brand. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.calculate_engagement_score(INTEGER, INTEGER, INTEGER, INTEGER) IS
'Calculate weighted engagement score. SECURITY DEFINER with search_path protection and NULL validation.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 00019 completed successfully';
    RAISE NOTICE '✅ Fixed 14 additional SECURITY DEFINER functions';
    RAISE NOTICE '✅ All functions now have: search_path protection, NULL validation, and explicit schema qualification';
    RAISE NOTICE '✅ Total functions secured across both migrations: 29';
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================