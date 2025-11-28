-- Analytics Dashboard Schema
-- Migration: 00012_analytics_dashboard
-- Description: Consolidated analytics views and functions for comprehensive dashboard
-- Dependencies: Requires 00010 (posting_analytics), 00007 (engagement_analytics)

-- ============================================================================
-- CONSOLIDATED ANALYTICS FUNCTION - Overall performance metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
    p_brand_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
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
        -- Overall metrics
        'total_posts', (
            SELECT COUNT(*)
            FROM public.posts
            WHERE brand_id = p_brand_id
                AND status = 'published'
                AND published_at BETWEEN p_start_date AND p_end_date
        ),
        'total_reach', (
            SELECT COALESCE(SUM(reach), 0)
            FROM public.posting_analytics pa
            JOIN public.posts p ON p.id = pa.post_id
            WHERE p.brand_id = p_brand_id
                AND p.published_at BETWEEN p_start_date AND p_end_date
        ),
        'total_impressions', (
            SELECT COALESCE(SUM(impressions), 0)
            FROM public.posting_analytics pa
            JOIN public.posts p ON p.id = pa.post_id
            WHERE p.brand_id = p_brand_id
                AND p.published_at BETWEEN p_start_date AND p_end_date
        ),
        'total_engagement', (
            SELECT COALESCE(SUM(likes + comments + shares + saves), 0)
            FROM public.posting_analytics pa
            JOIN public.posts p ON p.id = pa.post_id
            WHERE p.brand_id = p_brand_id
                AND p.published_at BETWEEN p_start_date AND p_end_date
        ),
        'avg_engagement_rate', (
            SELECT COALESCE(AVG(engagement_rate), 0)
            FROM public.posting_analytics pa
            JOIN public.posts p ON p.id = pa.post_id
            WHERE p.brand_id = p_brand_id
                AND p.published_at BETWEEN p_start_date AND p_end_date
                AND pa.engagement_rate IS NOT NULL
        ),
        -- Platform breakdown
        'platform_metrics', (
            SELECT json_object_agg(platform, metrics)
            FROM (
                SELECT
                    sp.platform,
                    json_build_object(
                        'posts', COUNT(DISTINCT p.id),
                        'reach', COALESCE(SUM(pa.reach), 0),
                        'impressions', COALESCE(SUM(pa.impressions), 0),
                        'engagement', COALESCE(SUM(pa.likes + pa.comments + pa.shares + pa.saves), 0),
                        'avg_engagement_rate', COALESCE(AVG(pa.engagement_rate), 0)
                    ) as metrics
                FROM public.posts p
                JOIN public.scheduled_posts sp ON sp.post_id = p.id
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND p.published_at BETWEEN p_start_date AND p_end_date
                    AND sp.status = 'published'
                GROUP BY sp.platform
            ) platform_data
        ),
        -- Time series data (daily aggregates)
        'daily_metrics', (
            SELECT json_agg(daily_data ORDER BY date)
            FROM (
                SELECT
                    DATE(p.published_at) as date,
                    COUNT(DISTINCT p.id) as posts,
                    COALESCE(SUM(pa.reach), 0) as reach,
                    COALESCE(SUM(pa.impressions), 0) as impressions,
                    COALESCE(SUM(pa.likes + pa.comments + pa.shares + pa.saves), 0) as engagement
                FROM public.posts p
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND p.published_at BETWEEN p_start_date AND p_end_date
                GROUP BY DATE(p.published_at)
            ) daily_data
        ),
        -- Top performing posts
        'top_posts', (
            SELECT json_agg(post_data)
            FROM (
                SELECT
                    p.id,
                    p.title,
                    p.body,
                    p.published_at,
                    sp.platform,
                    sp.platform_url,
                    pa.reach,
                    pa.impressions,
                    pa.likes,
                    pa.comments,
                    pa.shares,
                    pa.saves,
                    pa.engagement_rate
                FROM public.posts p
                JOIN public.scheduled_posts sp ON sp.post_id = p.id
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND p.published_at BETWEEN p_start_date AND p_end_date
                    AND pa.engagement_rate IS NOT NULL
                ORDER BY pa.engagement_rate DESC
                LIMIT 10
            ) post_data
        ),
        -- Follower growth (from social_accounts)
        'follower_growth', (
            SELECT json_object_agg(platform, followers)
            FROM (
                SELECT
                    sa.platform,
                    (sa.metadata->>'follower_count')::INTEGER as followers
                FROM public.social_accounts sa
                JOIN public.brands b ON b.user_id = sa.user_id
                WHERE b.id = p_brand_id
                    AND sa.is_active = true
                    AND sa.metadata->>'follower_count' IS NOT NULL
            ) follower_data
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- POST DETAILS ANALYTICS - Deep dive into individual post performance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_post_analytics(
    p_post_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_brand_id UUID;
BEGIN
    -- Get brand_id and verify ownership
    SELECT brand_id INTO v_brand_id
    FROM public.posts
    WHERE id = p_post_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = v_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to post';
    END IF;

    SELECT json_build_object(
        'post', (
            SELECT row_to_json(post_data)
            FROM (
                SELECT
                    p.id,
                    p.title,
                    p.body,
                    p.content_type,
                    p.hashtags,
                    p.published_at,
                    p.created_at
                FROM public.posts p
                WHERE p.id = p_post_id
            ) post_data
        ),
        'platforms', (
            SELECT json_agg(platform_data)
            FROM (
                SELECT
                    sp.platform,
                    sp.platform_url,
                    sp.platform_post_id,
                    sp.published_at,
                    pa.reach,
                    pa.impressions,
                    pa.likes,
                    pa.comments,
                    pa.shares,
                    pa.saves,
                    pa.clicks,
                    pa.engagement_rate,
                    pa.video_views,
                    pa.video_watch_time_seconds,
                    pa.audience_demographics,
                    pa.metrics_fetched_at
                FROM public.scheduled_posts sp
                LEFT JOIN public.posting_analytics pa ON pa.scheduled_post_id = sp.id
                WHERE sp.post_id = p_post_id
                    AND sp.status = 'published'
            ) platform_data
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CONTENT PERFORMANCE INSIGHTS - AI-ready data aggregation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_content_insights(
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
        -- Best performing content types
        'content_type_performance', (
            SELECT json_object_agg(content_type, metrics)
            FROM (
                SELECT
                    p.content_type,
                    json_build_object(
                        'count', COUNT(*),
                        'avg_engagement_rate', AVG(pa.engagement_rate),
                        'avg_reach', AVG(pa.reach),
                        'total_engagement', SUM(pa.likes + pa.comments + pa.shares + pa.saves)
                    ) as metrics
                FROM public.posts p
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND p.published_at > NOW() - INTERVAL '1 day' * p_days
                GROUP BY p.content_type
            ) type_data
        ),
        -- Hashtag performance
        'hashtag_performance', (
            SELECT json_agg(hashtag_data ORDER BY avg_engagement DESC)
            FROM (
                SELECT
                    hashtag,
                    COUNT(*) as usage_count,
                    AVG(pa.engagement_rate) as avg_engagement,
                    AVG(pa.reach) as avg_reach
                FROM public.posts p
                CROSS JOIN LATERAL jsonb_array_elements_text(p.hashtags) as hashtag
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND p.published_at > NOW() - INTERVAL '1 day' * p_days
                GROUP BY hashtag
                HAVING COUNT(*) >= 2
                ORDER BY AVG(pa.engagement_rate) DESC NULLS LAST
                LIMIT 20
            ) hashtag_data
        ),
        -- Posting time analysis
        'posting_time_analysis', (
            SELECT json_agg(time_data)
            FROM (
                SELECT
                    EXTRACT(DOW FROM p.published_at) as day_of_week,
                    EXTRACT(HOUR FROM p.published_at) as hour_of_day,
                    COUNT(*) as post_count,
                    AVG(pa.engagement_rate) as avg_engagement,
                    AVG(pa.reach) as avg_reach
                FROM public.posts p
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND p.published_at > NOW() - INTERVAL '1 day' * p_days
                GROUP BY EXTRACT(DOW FROM p.published_at), EXTRACT(HOUR FROM p.published_at)
                HAVING COUNT(*) >= 1
            ) time_data
        ),
        -- Platform comparison
        'platform_comparison', (
            SELECT json_object_agg(platform, platform_metrics)
            FROM (
                SELECT
                    sp.platform,
                    json_build_object(
                        'total_posts', COUNT(DISTINCT p.id),
                        'avg_engagement_rate', AVG(pa.engagement_rate),
                        'best_engagement_rate', MAX(pa.engagement_rate),
                        'avg_reach', AVG(pa.reach),
                        'total_engagement', SUM(pa.likes + pa.comments + pa.shares + pa.saves)
                    ) as platform_metrics
                FROM public.posts p
                JOIN public.scheduled_posts sp ON sp.post_id = p.id
                LEFT JOIN public.posting_analytics pa ON pa.post_id = p.id
                WHERE p.brand_id = p_brand_id
                    AND p.status = 'published'
                    AND sp.status = 'published'
                    AND p.published_at > NOW() - INTERVAL '1 day' * p_days
                GROUP BY sp.platform
            ) platform_data
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UNIQUE CONSTRAINT for engagement_analytics
-- ============================================================================

-- Add unique constraint to prevent duplicate entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'engagement_analytics_brand_date_platform_key'
    ) THEN
        ALTER TABLE public.engagement_analytics
        ADD CONSTRAINT engagement_analytics_brand_date_platform_key
        UNIQUE (brand_id, date, platform);
    END IF;
END $$;

-- ============================================================================
-- INDEXES for performance optimization
-- ============================================================================

-- Optimize date range queries on posts
CREATE INDEX IF NOT EXISTS idx_posts_brand_published_at
ON public.posts(brand_id, published_at DESC)
WHERE status = 'published';

-- Optimize analytics queries
CREATE INDEX IF NOT EXISTS idx_posting_analytics_metrics_fetched_at
ON public.posting_analytics(metrics_fetched_at DESC);

-- Optimize platform filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_status
ON public.scheduled_posts(platform, status)
WHERE status = 'published';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_insights(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

COMMENT ON FUNCTION public.get_dashboard_analytics IS 'Consolidated dashboard analytics with overall metrics, platform breakdown, and time series data';
COMMENT ON FUNCTION public.get_post_analytics IS 'Detailed analytics for individual posts across all platforms';
COMMENT ON FUNCTION public.get_content_insights IS 'Content performance insights for AI-powered recommendations';
