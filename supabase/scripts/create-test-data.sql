-- ============================================================================
-- Test Data Creation Script
-- Purpose: Create sample data for testing Analytics Dashboard and Agency Features
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE TEST USERS
-- ============================================================================

-- Note: In production, users are created via Supabase Auth
-- For testing, we'll create profiles that reference auth users
-- You'll need to sign up via the app first, then run this script

-- Check if we have any users
DO $$
DECLARE
    test_user_count INT;
BEGIN
    SELECT COUNT(*) INTO test_user_count FROM auth.users;

    IF test_user_count = 0 THEN
        RAISE NOTICE 'No users found. Please sign up via the app first at http://localhost:3001/signup';
        RAISE NOTICE 'After signing up, run this script again.';
    ELSE
        RAISE NOTICE 'Found % existing user(s)', test_user_count;
    END IF;
END $$;

-- ============================================================================
-- 2. CREATE TEST BRAND
-- ============================================================================

-- Create a test brand for the first user
INSERT INTO public.brands (
    id,
    user_id,
    name,
    description,
    industry,
    website,
    logo_url,
    created_at
)
SELECT
    gen_random_uuid(),
    id,
    'Test Brand - ' || email,
    'A test brand for analytics and agency features testing',
    'Technology',
    'https://example.com',
    'https://via.placeholder.com/150',
    NOW() - INTERVAL '30 days'
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE user_id = auth.users.id)
LIMIT 1
ON CONFLICT DO NOTHING
RETURNING id, name;

-- ============================================================================
-- 3. CREATE SAMPLE POSTS FOR ANALYTICS
-- ============================================================================

-- Insert 20 test posts with varying metrics
WITH brand AS (
    SELECT id, user_id FROM public.brands LIMIT 1
)
INSERT INTO public.posts (
    id,
    brand_id,
    user_id,
    content,
    content_type,
    platform,
    status,
    scheduled_for,
    published_at,
    views,
    likes,
    comments,
    shares,
    created_at
)
SELECT
    gen_random_uuid(),
    brand.id,
    brand.user_id,
    'Test post #' || i || ' - ' ||
    CASE
        WHEN i % 4 = 0 THEN 'This is a long-form post about technology trends and innovation.'
        WHEN i % 4 = 1 THEN 'Quick update about our latest product feature!'
        WHEN i % 4 = 2 THEN 'Behind the scenes: Our team working on exciting projects 🚀'
        ELSE 'Tips and tricks for social media growth'
    END,
    CASE WHEN i % 3 = 0 THEN 'post' WHEN i % 3 = 1 THEN 'story' ELSE 'reel' END,
    CASE WHEN i % 4 = 0 THEN 'instagram' WHEN i % 4 = 1 THEN 'twitter' WHEN i % 4 = 2 THEN 'linkedin' ELSE 'tiktok' END,
    'published',
    NOW() - INTERVAL '1 day' * i,
    NOW() - INTERVAL '1 day' * i + INTERVAL '1 hour',
    -- Varying engagement metrics
    (random() * 1000)::INT,  -- views
    (random() * 100)::INT,   -- likes
    (random() * 20)::INT,    -- comments
    (random() * 10)::INT,    -- shares
    NOW() - INTERVAL '1 day' * (i + 5)
FROM brand, generate_series(1, 20) AS i
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CALCULATE ENGAGEMENT RATES
-- ============================================================================

UPDATE public.posts
SET engagement_rate =
    CASE
        WHEN views > 0 THEN ((likes + comments + shares)::FLOAT / views) * 100
        ELSE 0
    END
WHERE engagement_rate IS NULL;

-- ============================================================================
-- 5. VERIFY DATA CREATION
-- ============================================================================

-- Check created data
SELECT
    'Users created' as info,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT
    'Brands created' as info,
    COUNT(*) as count
FROM public.brands
UNION ALL
SELECT
    'Posts created' as info,
    COUNT(*) as count
FROM public.posts
UNION ALL
SELECT
    'Agencies auto-created' as info,
    COUNT(*) as count
FROM public.agencies
UNION ALL
SELECT
    'Team members created' as info,
    COUNT(*) as count
FROM public.team_members;

-- Show sample post data
SELECT
    platform,
    COUNT(*) as post_count,
    AVG(views)::INT as avg_views,
    AVG(likes)::INT as avg_likes,
    AVG(engagement_rate)::NUMERIC(5,2) as avg_engagement_rate
FROM public.posts
GROUP BY platform
ORDER BY platform;

-- ============================================================================
-- 6. TEST AGENCY AUTO-CREATION
-- ============================================================================

-- Verify each user has an agency
SELECT
    u.email,
    a.name as agency_name,
    a.slug,
    tm.role
FROM auth.users u
LEFT JOIN public.agencies a ON a.owner_id = u.id
LEFT JOIN public.team_members tm ON tm.agency_id = a.id AND tm.user_id = u.id
ORDER BY u.created_at;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Test data created successfully!' as message;
SELECT 'Next step: Run analytics-test-queries.sql to test dashboard functions' as next_step;
