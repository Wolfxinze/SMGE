-- Rate Limiting System
-- Migration: 00004_rate_limiting
-- Description: Database-based rate limiting to prevent API abuse and control costs

-- ============================================================================
-- API RATE LIMITS TABLE
-- ============================================================================
CREATE TABLE public.api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite index for efficient time-window queries
    CONSTRAINT api_rate_limits_user_endpoint_time
        CHECK (created_at <= NOW() + INTERVAL '1 minute')
);

-- Create indexes for efficient rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint_time
    ON public.api_rate_limits(user_id, endpoint, created_at DESC);

-- Create index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at
    ON public.api_rate_limits(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only view their own rate limit records
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can view own rate limits"
    ON public.api_rate_limits
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own rate limit records
DROP POLICY IF EXISTS "Users can insert own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can insert own rate limits"
    ON public.api_rate_limits
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Only service role can delete (for cleanup)
DROP POLICY IF EXISTS "Service role can delete rate limits" ON public.api_rate_limits;
CREATE POLICY "Service role can delete rate limits"
    ON public.api_rate_limits
    FOR DELETE
    USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.api_rate_limits IS
    'Tracks API requests per user for rate limiting and cost control';

COMMENT ON COLUMN public.api_rate_limits.user_id IS
    'User making the API request';

COMMENT ON COLUMN public.api_rate_limits.endpoint IS
    'API endpoint identifier (e.g., /api/ai/embeddings)';

COMMENT ON COLUMN public.api_rate_limits.created_at IS
    'Timestamp of the API request';
