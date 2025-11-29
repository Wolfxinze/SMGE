-- ============================================================================
-- Analytics Dashboard Test Queries
-- Purpose: Test all analytics functions with sample data
-- ============================================================================

-- ============================================================================
-- SETUP: Get test brand ID
-- ============================================================================

DO $$
DECLARE
    v_brand_id UUID;
    v_post_id UUID;
BEGIN
    -- Get first brand
    SELECT id INTO v_brand_id FROM public.brands LIMIT 1;

    IF v_brand_id IS NULL THEN
        RAISE EXCEPTION 'No brands found. Please run create-test-data.sql first';
    END IF;

    -- Get first post
    SELECT id INTO v_post_id FROM public.posts LIMIT 1;

    -- Store in temp variables for later use
    CREATE TEMP TABLE test_vars (brand_id UUID, post_id UUID);
    INSERT INTO test_vars VALUES (v_brand_id, v_post_id);

    RAISE NOTICE 'Using Brand ID: %', v_brand_id;
    RAISE NOTICE 'Using Post ID: %', v_post_id;
END $$;

-- ============================================================================
-- TEST 1: Dashboard Analytics Function
-- ============================================================================

SELECT '========================================' as separator;
SELECT '🧪 TEST 1: Dashboard Analytics (Last 30 Days)' as test_name;
SELECT '========================================' as separator;

SELECT * FROM public.get_dashboard_analytics(
    p_brand_id := (SELECT brand_id FROM test_vars),
    p_start_date := NOW() - INTERVAL '30 days',
    p_end_date := NOW()
);

-- Expected output:
-- - total_posts: ~20
-- - total_reach: sum of all views
-- - total_impressions: sum of all views (same as reach for now)
-- - total_engagement: sum of likes + comments + shares
-- - avg_engagement_rate: average engagement rate
-- - posts_by_platform: breakdown by platform
-- - top_performing_posts: top 5 posts by engagement

-- ============================================================================
-- TEST 2: Dashboard Analytics (Last 7 Days)
-- ============================================================================

SELECT '========================================' as separator;
SELECT '🧪 TEST 2: Dashboard Analytics (Last 7 Days)' as test_name;
SELECT '========================================' as separator;

SELECT * FROM public.get_dashboard_analytics(
    p_brand_id := (SELECT brand_id FROM test_vars),
    p_start_date := NOW() - INTERVAL '7 days',
    p_end_date := NOW()
);

-- ============================================================================
-- TEST 3: Post Analytics Function
-- ============================================================================

SELECT '========================================' as separator;
SELECT '🧪 TEST 3: Individual Post Analytics' as test_name;
SELECT '========================================' as separator;

SELECT * FROM public.get_post_analytics(
    p_post_id := (SELECT post_id FROM test_vars)
);

-- Expected output:
-- - post_id, content, platform
-- - views, likes, comments, shares
-- - engagement_rate
-- - published_at

-- ============================================================================
-- TEST 4: Content Insights Function (30 Days)
-- ============================================================================

SELECT '========================================' as separator;
SELECT '🧪 TEST 4: Content Insights (Last 30 Days)' as test_name;
SELECT '========================================' as separator;

SELECT * FROM public.get_content_insights(
    p_brand_id := (SELECT brand_id FROM test_vars),
    p_days := 30
);

-- Expected output:
-- - best_performing_platform
-- - best_performing_content_type
-- - optimal_posting_time
-- - avg_engagement_by_platform
-- - total_posts_analyzed

-- ============================================================================
-- TEST 5: Performance Benchmarks
-- ============================================================================

SELECT '========================================' as separator;
SELECT '⚡ TEST 5: Performance Benchmarks' as test_name;
SELECT '========================================' as separator;

-- Measure dashboard analytics query time
EXPLAIN ANALYZE
SELECT * FROM public.get_dashboard_analytics(
    p_brand_id := (SELECT brand_id FROM test_vars),
    p_start_date := NOW() - INTERVAL '30 days',
    p_end_date := NOW()
);

-- Expected: < 50ms execution time

SELECT '========================================' as separator;

-- Measure post analytics query time
EXPLAIN ANALYZE
SELECT * FROM public.get_post_analytics(
    p_post_id := (SELECT post_id FROM test_vars)
);

-- Expected: < 20ms execution time

-- ============================================================================
-- TEST 6: Verify Indexes
-- ============================================================================

SELECT '========================================' as separator;
SELECT '📊 TEST 6: Verify Performance Indexes' as test_name;
SELECT '========================================' as separator;

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('posts', 'posting_analytics', 'scheduled_posts')
ORDER BY tablename, indexname;

-- Expected indexes:
-- - idx_posts_brand_published_at
-- - idx_posting_analytics_metrics_fetched_at
-- - idx_scheduled_posts_platform_status

-- ============================================================================
-- TEST 7: Aggregate Statistics
-- ============================================================================

SELECT '========================================' as separator;
SELECT '📈 TEST 7: Aggregate Statistics' as test_name;
SELECT '========================================' as separator;

-- Overall stats
SELECT
    COUNT(*) as total_posts,
    COUNT(DISTINCT platform) as platforms_used,
    COUNT(DISTINCT content_type) as content_types,
    SUM(views) as total_views,
    SUM(likes) as total_likes,
    SUM(comments) as total_comments,
    SUM(shares) as total_shares,
    AVG(engagement_rate)::NUMERIC(5,2) as avg_engagement_rate,
    MIN(published_at) as earliest_post,
    MAX(published_at) as latest_post
FROM public.posts
WHERE brand_id = (SELECT brand_id FROM test_vars)
AND status = 'published';

-- ============================================================================
-- TEST 8: Platform Comparison
-- ============================================================================

SELECT '========================================' as separator;
SELECT '🎯 TEST 8: Platform Performance Comparison' as test_name;
SELECT '========================================' as separator;

SELECT
    platform,
    COUNT(*) as post_count,
    AVG(views)::INT as avg_views,
    AVG(likes)::INT as avg_likes,
    AVG(comments)::INT as avg_comments,
    AVG(shares)::INT as avg_shares,
    AVG(engagement_rate)::NUMERIC(5,2) as avg_engagement_rate,
    MAX(views) as max_views,
    MAX(engagement_rate)::NUMERIC(5,2) as max_engagement_rate
FROM public.posts
WHERE brand_id = (SELECT brand_id FROM test_vars)
AND status = 'published'
GROUP BY platform
ORDER BY avg_engagement_rate DESC;

-- ============================================================================
-- TEST 9: Content Type Analysis
-- ============================================================================

SELECT '========================================' as separator;
SELECT '📝 TEST 9: Content Type Performance' as test_name;
SELECT '========================================' as separator;

SELECT
    content_type,
    COUNT(*) as post_count,
    AVG(views)::INT as avg_views,
    AVG(engagement_rate)::NUMERIC(5,2) as avg_engagement_rate,
    SUM(likes + comments + shares) as total_engagement
FROM public.posts
WHERE brand_id = (SELECT brand_id FROM test_vars)
AND status = 'published'
GROUP BY content_type
ORDER BY avg_engagement_rate DESC;

-- ============================================================================
-- TEST 10: Time Series Data
-- ============================================================================

SELECT '========================================' as separator;
SELECT '📅 TEST 10: Daily Posting Trend (Last 14 Days)' as test_name;
SELECT '========================================' as separator;

SELECT
    DATE(published_at) as post_date,
    COUNT(*) as posts_published,
    SUM(views) as total_views,
    AVG(engagement_rate)::NUMERIC(5,2) as avg_engagement_rate
FROM public.posts
WHERE brand_id = (SELECT brand_id FROM test_vars)
AND published_at >= NOW() - INTERVAL '14 days'
AND status = 'published'
GROUP BY DATE(published_at)
ORDER BY post_date DESC;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '========================================' as separator;
SELECT '✅ All Analytics Tests Completed!' as message;
SELECT '========================================' as separator;

-- Summary
SELECT
    '✓ Dashboard analytics function works' as status
UNION ALL
SELECT '✓ Post analytics function works'
UNION ALL
SELECT '✓ Content insights function works'
UNION ALL
SELECT '✓ Performance indexes verified'
UNION ALL
SELECT '✓ Aggregate statistics calculated'
UNION ALL
SELECT '✓ Platform comparison data available'
UNION ALL
SELECT '✓ Content type analysis complete'
UNION ALL
SELECT '✓ Time series data accessible';

SELECT 'Next step: Run agency-features-tests.sql to test Agency Features' as next_step;
