-- Social Scheduler Schema
-- Migration: 00005_social_scheduler_schema
-- Description: Tables for social media scheduling, posting queue, and platform integrations
-- Dependencies: Requires 00001 (profiles, social_accounts), 00003 (brands)

-- ============================================================================
-- POSTS TABLE - Content to be scheduled and published
-- ============================================================================
-- Drop table if it exists from partial migration to ensure clean schema
DROP TABLE IF EXISTS public.posts CASCADE;

-- Central table for all generated content (draft, scheduled, published)
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Content Details
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'story', 'reel', 'video', 'article', 'thread')),
    title VARCHAR(500),
    body TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]'::jsonb, -- Array of media URLs or file paths

    -- Metadata
    hashtags JSONB DEFAULT '[]'::jsonb, -- Array of hashtags
    mentions JSONB DEFAULT '[]'::jsonb, -- Array of mentions
    platform_specific_data JSONB DEFAULT '{}'::jsonb, -- Platform-specific fields

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),

    -- AI Generation Context
    generation_prompt TEXT, -- Prompt used to generate content
    ai_model VARCHAR(100), -- Model used (gpt-4, claude-3.5-sonnet)
    generation_metadata JSONB DEFAULT '{}'::jsonb, -- Additional generation context

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ -- When actually published
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_brand_id ON public.posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_approval_status ON public.posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- Comment
COMMENT ON TABLE public.posts IS 'Generated social media content (draft, scheduled, or published)';

-- ============================================================================
-- SCHEDULED_POSTS TABLE - Scheduling and posting queue
-- ============================================================================
-- Drop table if it exists from partial migration to ensure clean schema
DROP TABLE IF EXISTS public.scheduled_posts CASCADE;

-- Links posts to social accounts with scheduling information
CREATE TABLE public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL, -- When to publish
    timezone VARCHAR(100) DEFAULT 'UTC', -- User's preferred timezone

    -- Publishing Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed', 'cancelled')),
    platform_post_id TEXT, -- ID returned by social platform API
    platform_url TEXT, -- URL to the published post

    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(100),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- Publishing Metadata
    published_at TIMESTAMPTZ, -- Actual publish time
    processing_started_at TIMESTAMPTZ, -- When posting started
    processing_completed_at TIMESTAMPTZ, -- When posting finished

    -- Rate Limiting Metadata
    rate_limit_metadata JSONB DEFAULT '{}'::jsonb, -- Platform rate limit info

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_post_account_schedule UNIQUE(post_id, social_account_id),
    CONSTRAINT scheduled_for_future CHECK (scheduled_for > created_at)
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_post_id ON public.scheduled_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_social_account_id ON public.scheduled_posts(social_account_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_brand_id ON public.scheduled_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON public.scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_next_retry_at ON public.scheduled_posts(next_retry_at) WHERE status = 'failed';

-- Composite index for queue processing (find posts due for publishing)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending_queue ON public.scheduled_posts(status, scheduled_for)
    WHERE status = 'pending' OR status = 'failed';

-- Comment
COMMENT ON TABLE public.scheduled_posts IS 'Scheduling queue linking posts to social accounts with retry logic';

-- ============================================================================
-- PLATFORM_RATE_LIMITS TABLE - Track rate limit usage per platform
-- ============================================================================
-- Drop table if it exists from partial migration to ensure clean schema
DROP TABLE IF EXISTS public.platform_rate_limits CASCADE;

-- Prevents API quota violations by tracking request counts
CREATE TABLE public.platform_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok', 'facebook')),

    -- Rate Limit Tracking
    endpoint VARCHAR(200) NOT NULL, -- API endpoint (e.g., '/posts/create')
    requests_made INTEGER DEFAULT 0,
    requests_limit INTEGER NOT NULL, -- Platform-defined limit
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    window_duration_seconds INTEGER NOT NULL, -- e.g., 3600 for hourly limits

    -- Window Reset
    resets_at TIMESTAMPTZ NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_account_endpoint_window UNIQUE(social_account_id, endpoint, window_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_social_account_id ON public.platform_rate_limits(social_account_id);
CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_resets_at ON public.platform_rate_limits(resets_at);
CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_platform ON public.platform_rate_limits(platform);

-- Comment
COMMENT ON TABLE public.platform_rate_limits IS 'Tracks API rate limit usage to prevent quota violations';

-- ============================================================================
-- POSTING_ANALYTICS TABLE - Track performance of published posts
-- ============================================================================
-- Drop table if it exists from partial migration to ensure clean schema
DROP TABLE IF EXISTS public.posting_analytics CASCADE;

-- Stores analytics data fetched from social platforms
CREATE TABLE public.posting_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_post_id UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,

    -- Engagement Metrics
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,

    -- Advanced Metrics
    engagement_rate DECIMAL(5,4), -- Calculated: (likes+comments+shares)/reach
    video_views INTEGER,
    video_watch_time_seconds INTEGER,

    -- Audience Demographics (from platform insights)
    audience_demographics JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    metrics_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_scheduled_post_analytics UNIQUE(scheduled_post_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posting_analytics_scheduled_post_id ON public.posting_analytics(scheduled_post_id);
CREATE INDEX IF NOT EXISTS idx_posting_analytics_post_id ON public.posting_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_posting_analytics_platform ON public.posting_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_posting_analytics_engagement_rate ON public.posting_analytics(engagement_rate DESC NULLS LAST);

-- Comment
COMMENT ON TABLE public.posting_analytics IS 'Performance metrics for published posts fetched from social platforms';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_analytics ENABLE ROW LEVEL SECURITY;

-- ===================
-- POSTS TABLE POLICIES
-- ===================

-- Users can view their own posts
DROP POLICY IF EXISTS "Users can view own posts" ON public.posts;
CREATE POLICY "Users can view own posts"
    ON public.posts FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create posts for their brands
DROP POLICY IF EXISTS "Users can create posts for own brands" ON public.posts;
CREATE POLICY "Users can create posts for own brands"
    ON public.posts FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = posts.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can update their own posts
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts"
    ON public.posts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users can delete own posts"
    ON public.posts FOR DELETE
    USING (auth.uid() = user_id);

-- ===================
-- SCHEDULED_POSTS TABLE POLICIES
-- ===================

-- Users can view scheduled posts for their brands
DROP POLICY IF EXISTS "Users can view own scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Users can view own scheduled posts"
    ON public.scheduled_posts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = scheduled_posts.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can create scheduled posts for their brands
DROP POLICY IF EXISTS "Users can create scheduled posts for own brands" ON public.scheduled_posts;
CREATE POLICY "Users can create scheduled posts for own brands"
    ON public.scheduled_posts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = scheduled_posts.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can update scheduled posts for their brands
DROP POLICY IF EXISTS "Users can update own scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Users can update own scheduled posts"
    ON public.scheduled_posts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = scheduled_posts.brand_id
            AND brands.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = scheduled_posts.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can delete scheduled posts for their brands
DROP POLICY IF EXISTS "Users can delete own scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Users can delete own scheduled posts"
    ON public.scheduled_posts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = scheduled_posts.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- PLATFORM_RATE_LIMITS TABLE POLICIES
-- ===================

-- Users can view rate limits for their social accounts
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.platform_rate_limits;
CREATE POLICY "Users can view own rate limits"
    ON public.platform_rate_limits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.social_accounts
            WHERE social_accounts.id = platform_rate_limits.social_account_id
            AND social_accounts.user_id = auth.uid()
        )
    );

-- Service role can manage rate limits (for background jobs)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.platform_rate_limits;
CREATE POLICY "Service role can manage rate limits"
    ON public.platform_rate_limits FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ===================
-- POSTING_ANALYTICS TABLE POLICIES
-- ===================

-- Users can view analytics for their posts
DROP POLICY IF EXISTS "Users can view own post analytics" ON public.posting_analytics;
CREATE POLICY "Users can view own post analytics"
    ON public.posting_analytics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = posting_analytics.post_id
            AND posts.user_id = auth.uid()
        )
    );

-- Service role can manage analytics (for background jobs)
DROP POLICY IF EXISTS "Service role can manage analytics" ON public.posting_analytics;
CREATE POLICY "Service role can manage analytics"
    ON public.posting_analytics FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get posts due for publishing (called by cron job)
CREATE OR REPLACE FUNCTION public.get_posts_due_for_publishing(
    p_lookahead_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
    scheduled_post_id UUID,
    post_id UUID,
    social_account_id UUID,
    platform TEXT,
    scheduled_for TIMESTAMPTZ,
    content TEXT,
    media_urls JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id AS scheduled_post_id,
        sp.post_id,
        sp.social_account_id,
        sa.platform,
        sp.scheduled_for,
        p.body AS content,
        p.media_urls
    FROM public.scheduled_posts sp
    JOIN public.posts p ON p.id = sp.post_id
    JOIN public.social_accounts sa ON sa.id = sp.social_account_id
    WHERE sp.status = 'pending'
        AND sp.scheduled_for <= NOW() + INTERVAL '1 minute' * p_lookahead_minutes
        AND sp.scheduled_for > NOW() - INTERVAL '5 minutes' -- Don't process too-old posts
        AND sa.is_active = true
        AND p.status = 'scheduled'
        AND p.approval_status = 'approved'
    ORDER BY sp.scheduled_for ASC
    FOR UPDATE OF sp SKIP LOCKED; -- Prevent concurrent processing
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get failed posts due for retry
CREATE OR REPLACE FUNCTION public.get_posts_due_for_retry()
RETURNS TABLE (
    scheduled_post_id UUID,
    post_id UUID,
    social_account_id UUID,
    platform TEXT,
    retry_count INTEGER,
    error_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id AS scheduled_post_id,
        sp.post_id,
        sp.social_account_id,
        sa.platform,
        sp.retry_count,
        sp.error_message
    FROM public.scheduled_posts sp
    JOIN public.social_accounts sa ON sa.id = sp.social_account_id
    WHERE sp.status = 'failed'
        AND sp.retry_count < sp.max_retries
        AND sp.next_retry_at <= NOW()
        AND sa.is_active = true
    ORDER BY sp.next_retry_at ASC
    FOR UPDATE OF sp SKIP LOCKED; -- Prevent concurrent processing
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate next retry time (exponential backoff)
CREATE OR REPLACE FUNCTION public.calculate_next_retry(
    p_retry_count INTEGER
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- Exponential backoff: 1min, 5min, 15min, 1hr
    RETURN NOW() + CASE
        WHEN p_retry_count = 0 THEN INTERVAL '1 minute'
        WHEN p_retry_count = 1 THEN INTERVAL '5 minutes'
        WHEN p_retry_count = 2 THEN INTERVAL '15 minutes'
        ELSE INTERVAL '1 hour'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update post status (atomic operation)
CREATE OR REPLACE FUNCTION public.update_scheduled_post_status(
    p_scheduled_post_id UUID,
    p_new_status VARCHAR(50),
    p_error_message TEXT DEFAULT NULL,
    p_platform_post_id TEXT DEFAULT NULL,
    p_platform_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_retry_count INTEGER;
BEGIN
    -- Get current retry count
    SELECT retry_count INTO v_retry_count
    FROM public.scheduled_posts
    WHERE id = p_scheduled_post_id;

    -- Update scheduled post
    UPDATE public.scheduled_posts
    SET
        status = p_new_status,
        error_message = p_error_message,
        platform_post_id = COALESCE(p_platform_post_id, platform_post_id),
        platform_url = COALESCE(p_platform_url, platform_url),
        retry_count = CASE
            WHEN p_new_status = 'failed' THEN retry_count + 1
            ELSE retry_count
        END,
        next_retry_at = CASE
            WHEN p_new_status = 'failed' AND retry_count < max_retries
            THEN public.calculate_next_retry(retry_count + 1)
            ELSE NULL
        END,
        published_at = CASE
            WHEN p_new_status = 'published' THEN NOW()
            ELSE published_at
        END,
        processing_completed_at = CASE
            WHEN p_new_status IN ('published', 'failed', 'cancelled') THEN NOW()
            ELSE processing_completed_at
        END,
        updated_at = NOW()
    WHERE id = p_scheduled_post_id;

    -- Update parent post status
    IF p_new_status = 'published' THEN
        UPDATE public.posts
        SET status = 'published', published_at = NOW()
        WHERE id = (SELECT post_id FROM public.scheduled_posts WHERE id = p_scheduled_post_id);
    ELSIF p_new_status = 'failed' THEN
        UPDATE public.posts
        SET status = 'failed'
        WHERE id = (SELECT post_id FROM public.scheduled_posts WHERE id = p_scheduled_post_id);
    END IF;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit before posting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_social_account_id UUID,
    p_platform VARCHAR(50),
    p_endpoint VARCHAR(200),
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Calculate current window start
    v_window_start := date_trunc('hour', NOW()); -- Simplified: hourly windows

    -- Get or create rate limit record
    INSERT INTO public.platform_rate_limits (
        social_account_id,
        platform,
        endpoint,
        requests_limit,
        window_duration_seconds,
        window_start,
        resets_at,
        requests_made
    )
    VALUES (
        p_social_account_id,
        p_platform,
        p_endpoint,
        p_limit,
        p_window_seconds,
        v_window_start,
        v_window_start + (p_window_seconds || ' seconds')::INTERVAL,
        0
    )
    ON CONFLICT (social_account_id, endpoint, window_start)
    DO NOTHING;

    -- Get current count
    SELECT requests_made INTO v_current_count
    FROM public.platform_rate_limits
    WHERE social_account_id = p_social_account_id
        AND endpoint = p_endpoint
        AND window_start = v_window_start;

    -- Check if under limit
    RETURN v_current_count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
    p_social_account_id UUID,
    p_endpoint VARCHAR(200)
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.platform_rate_limits
    SET requests_made = requests_made + 1,
        updated_at = NOW()
    WHERE social_account_id = p_social_account_id
        AND endpoint = p_endpoint
        AND window_start = date_trunc('hour', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_posts_updated_at ON public.scheduled_posts;
CREATE TRIGGER update_scheduled_posts_updated_at
    BEFORE UPDATE ON public.scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_rate_limits_updated_at ON public.platform_rate_limits;
CREATE TRIGGER update_platform_rate_limits_updated_at
    BEFORE UPDATE ON public.platform_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_posting_analytics_updated_at ON public.posting_analytics;
CREATE TRIGGER update_posting_analytics_updated_at
    BEFORE UPDATE ON public.posting_analytics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================
COMMENT ON SCHEMA public IS 'SMGE Social Scheduler with queue processing and rate limiting - Migration 00005 completed';
