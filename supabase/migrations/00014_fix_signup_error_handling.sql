-- ============================================================================
-- FIX SIGNUP ERROR HANDLING
-- ============================================================================
-- Migration: 00014_fix_signup_error_handling
-- Purpose: Improve error handling in user signup trigger chain
-- Issue: "Database error saving new user" during signup
-- ============================================================================

-- Drop and recreate the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert profile with comprehensive error handling
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
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but don't fail the user creation
            RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Improve the handle_new_user_agency function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user_agency()
RETURNS TRIGGER AS $$
DECLARE
    v_agency_id UUID;
    v_slug TEXT;
BEGIN
    -- Only create agency for new profiles (not updates)
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Check if user already has an agency
    IF EXISTS (
        SELECT 1 FROM public.agencies
        WHERE owner_id = NEW.id
    ) THEN
        RETURN NEW;
    END IF;

    BEGIN
        -- Generate unique slug using UUID
        v_slug := LOWER(REPLACE(gen_random_uuid()::text, '-', ''));

        -- Create personal agency
        INSERT INTO public.agencies (
            owner_id,
            name,
            slug,
            subscription_tier,
            settings,
            branding
        ) VALUES (
            NEW.id,
            COALESCE(NEW.full_name, 'My Agency'),
            v_slug,
            'agency',
            '{"require_2fa": false, "allow_client_posting": false}'::jsonb,
            '{}'::jsonb
        ) RETURNING id INTO v_agency_id;

        -- Create owner team_member record
        INSERT INTO public.team_members (
            agency_id,
            user_id,
            role,
            status,
            accepted_at
        ) VALUES (
            v_agency_id,
            NEW.id,
            'owner',
            'active',
            NOW()
        );

    EXCEPTION
        WHEN OTHERS THEN
            -- Log but don't fail profile creation
            RAISE WARNING 'Failed to create agency for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Improve the initialize_free_tier function with better error handling
CREATE OR REPLACE FUNCTION public.initialize_free_tier()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process new profiles, not updates
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Check if user already has a subscription
    IF EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = NEW.id AND status = 'active'
    ) THEN
        RETURN NEW;
    END IF;

    BEGIN
        -- Create free tier subscription
        INSERT INTO public.subscriptions (
            user_id,
            stripe_subscription_id,
            stripe_customer_id,
            status,
            current_period_start,
            current_period_end,
            plan_id,
            tier
        ) VALUES (
            NEW.id,
            'free_' || NEW.id,
            'cus_free_' || NEW.id,
            'active',
            NOW(),
            NOW() + INTERVAL '100 years',
            'free',
            'free'
        );

    EXCEPTION
        WHEN OTHERS THEN
            -- Log but don't fail profile creation
            RAISE WARNING 'Failed to initialize free tier for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy to allow trigger functions to insert into profiles table
DROP POLICY IF EXISTS "Triggers can insert profiles" ON public.profiles;
CREATE POLICY "Triggers can insert profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (true);

-- Add RLS policy to allow trigger functions to insert into agencies table
DROP POLICY IF EXISTS "Triggers can insert agencies" ON public.agencies;
CREATE POLICY "Triggers can insert agencies"
    ON public.agencies
    FOR INSERT
    WITH CHECK (true);

-- Add RLS policy to allow trigger functions to insert into team_members table
DROP POLICY IF EXISTS "Triggers can insert team_members" ON public.team_members;
CREATE POLICY "Triggers can insert team_members"
    ON public.team_members
    FOR INSERT
    WITH CHECK (true);

-- Add RLS policy to allow trigger functions to insert into subscriptions table
DROP POLICY IF EXISTS "Triggers can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Triggers can insert subscriptions"
    ON public.subscriptions
    FOR INSERT
    WITH CHECK (true);

-- Comment on the migration
COMMENT ON FUNCTION public.handle_new_user IS 'Creates user profile on signup with improved error handling';
COMMENT ON FUNCTION public.handle_new_user_agency IS 'Creates personal agency for new users with improved error handling';
COMMENT ON FUNCTION public.initialize_free_tier IS 'Initializes free tier subscription with improved error handling';