-- Authentication Flow Enhancements
-- Migration: 00002_auth_schema
-- Description: Automatic profile creation, auth helper functions, and enhanced RLS policies

-- ============================================================================
-- AUTOMATIC PROFILE CREATION
-- ============================================================================
-- Function to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        subscription_tier
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        COALESCE(NEW.raw_user_meta_data->>'subscription_tier', 'free')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- AUTH METADATA ENHANCEMENTS
-- ============================================================================
-- Add columns to profiles table for better auth tracking (if not exists)
DO $$
BEGIN
    -- Add last_sign_in_at if it doesn't exist
    IF NOT EXISTS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'last_sign_in_at'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN last_sign_in_at TIMESTAMPTZ;
    END IF;

    -- Add email_verified if it doesn't exist
    IF NOT EXISTS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add metadata JSONB column for OAuth provider info
    IF NOT EXISTS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_metadata'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN auth_metadata JSONB DEFAULT '{}'::JSONB;
    END IF;

    -- Add onboarding_completed flag
    IF NOT EXISTS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ============================================================================
-- AUTH HELPER FUNCTIONS
-- ============================================================================

-- Function to update last sign-in timestamp
CREATE OR REPLACE FUNCTION public.update_last_sign_in()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        last_sign_in_at = NOW(),
        email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last sign-in on auth.users update
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_last_sign_in();

-- Function to check if user has completed onboarding
CREATE OR REPLACE FUNCTION public.is_onboarding_complete(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_complete BOOLEAN;
BEGIN
    SELECT onboarding_completed INTO is_complete
    FROM public.profiles
    WHERE id = user_id;

    RETURN COALESCE(is_complete, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark onboarding as complete
CREATE OR REPLACE FUNCTION public.complete_onboarding(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles
    SET
        onboarding_completed = TRUE,
        updated_at = NOW()
    WHERE id = user_id
    AND id = auth.uid(); -- Ensure user can only update their own profile

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscription tier
CREATE OR REPLACE FUNCTION public.get_subscription_tier(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    tier TEXT;
BEGIN
    SELECT subscription_tier INTO tier
    FROM public.profiles
    WHERE id = user_id;

    RETURN COALESCE(tier, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to update user profile from OAuth data
CREATE OR REPLACE FUNCTION public.update_profile_from_oauth(
    user_id UUID,
    provider TEXT,
    oauth_data JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET
        full_name = COALESCE(oauth_data->>'name', oauth_data->>'full_name', full_name),
        avatar_url = COALESCE(oauth_data->>'avatar_url', oauth_data->>'picture', avatar_url),
        auth_metadata = auth_metadata || jsonb_build_object(provider, oauth_data),
        email_verified = TRUE,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENHANCED RLS POLICIES
-- ============================================================================

-- Policy for service role to manage all profiles (for admin operations)
CREATE POLICY "Service role can manage all profiles"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (TRUE);

-- Policy for authenticated users to insert their own profile (for edge cases)
CREATE POLICY "Users can create own profile if missing"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Enhanced policy for social accounts with auth check
DROP POLICY IF EXISTS "Users can manage own social accounts" ON public.social_accounts;
CREATE POLICY "Users can manage own social accounts with auth"
    ON public.social_accounts
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for auth-related queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_sign_in ON public.profiles(last_sign_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified) WHERE email_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed) WHERE onboarding_completed = FALSE;

-- Composite index for common auth queries
CREATE INDEX IF NOT EXISTS idx_profiles_auth_lookup ON public.profiles(id, email, role, subscription_tier);

-- ============================================================================
-- SESSION MANAGEMENT TABLE
-- ============================================================================
-- Table to track active sessions and device information
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
    ON public.user_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout from devices)
CREATE POLICY "Users can delete own sessions"
    ON public.user_sessions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at) WHERE is_active = TRUE;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.user_sessions
    WHERE expires_at < NOW()
    OR (last_activity_at < NOW() - INTERVAL '30 days' AND is_active = TRUE);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates user profile on signup';
COMMENT ON FUNCTION public.update_last_sign_in IS 'Updates last sign-in timestamp when user logs in';
COMMENT ON FUNCTION public.is_onboarding_complete IS 'Checks if user has completed onboarding flow';
COMMENT ON FUNCTION public.complete_onboarding IS 'Marks user onboarding as complete';
COMMENT ON FUNCTION public.get_subscription_tier IS 'Returns user subscription tier for authorization';
COMMENT ON FUNCTION public.update_profile_from_oauth IS 'Updates user profile with OAuth provider data';
COMMENT ON FUNCTION public.cleanup_expired_sessions IS 'Removes expired or inactive sessions';
COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions for device management';
COMMENT ON COLUMN public.profiles.last_sign_in_at IS 'Timestamp of users last successful sign-in';
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether users email has been verified';
COMMENT ON COLUMN public.profiles.auth_metadata IS 'OAuth provider metadata and additional auth info';
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Flag indicating if user completed onboarding flow';