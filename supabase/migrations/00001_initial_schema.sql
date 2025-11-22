-- Initial Schema for SMGE Platform
-- Migration: 00001_initial_schema
-- Description: Core tables for user profiles, social accounts, and system infrastructure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- User profile information extending Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    company_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'agency_owner', 'team_member')),
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'agency')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- ============================================================================
-- SOCIAL ACCOUNTS TABLE
-- ============================================================================
-- OAuth credentials for social media platforms
-- SECURITY: Uses pgcrypto for encrypting sensitive tokens
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok', 'facebook')),
    account_name TEXT NOT NULL,
    account_id TEXT NOT NULL,

    -- ENCRYPTED FIELDS - Using pgcrypto
    -- Note: In production, use Supabase Vault or external KMS
    access_token_encrypted BYTEA, -- Encrypted using pgp_sym_encrypt
    refresh_token_encrypted BYTEA, -- Encrypted using pgp_sym_encrypt

    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, platform, account_id)
);

-- Enable RLS on social_accounts
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own social accounts
CREATE POLICY "Users can manage own social accounts"
    ON public.social_accounts
    FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS FOR TOKEN ENCRYPTION
-- ============================================================================
-- Function to encrypt access tokens (called from application layer)
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, secret TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(token, secret);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt access tokens (called from application layer)
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, secret TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_token, secret);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================
-- Health check table (minimal table for connection testing)
CREATE TABLE IF NOT EXISTS public._health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL DEFAULT 'ok',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial health check record
INSERT INTO public._health (status) VALUES ('ok')
ON CONFLICT DO NOTHING;

-- Public read access for health checks
ALTER TABLE public._health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read for health checks"
    ON public._health
    FOR SELECT
    TO PUBLIC
    USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_accounts_updated_at
    BEFORE UPDATE ON public.social_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON public.social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_is_active ON public.social_accounts(is_active);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.social_accounts IS 'OAuth credentials for social media platforms (tokens encrypted at rest)';
COMMENT ON TABLE public._health IS 'System health check table for monitoring database connectivity';
COMMENT ON FUNCTION encrypt_token IS 'Encrypts OAuth tokens using pgcrypto before storage';
COMMENT ON FUNCTION decrypt_token IS 'Decrypts OAuth tokens for use in application';
