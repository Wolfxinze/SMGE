-- ========================================
-- Free Tier Initialization for New Users
-- ========================================
--
-- This migration adds automatic free tier subscription initialization
-- when new users sign up in the system.
--
-- ========================================

-- Function to initialize free tier subscription for new users
CREATE OR REPLACE FUNCTION public.initialize_free_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a subscription (shouldn't happen but just in case)
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Create free tier subscription
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    NOW(),
    NOW() + INTERVAL '100 years',  -- Free tier never expires
    NOW(),
    NOW()
  );

  -- Initialize usage metrics for the new user
  INSERT INTO public.usage_metrics (
    user_id,
    month,
    posts_created,
    ai_credits_used,
    active_brands,
    connected_accounts,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW())::date,
    0,
    0,
    0,
    0,
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to initialize free tier for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_user_created_initialize_free_tier ON auth.users;

-- Create trigger on new user creation
CREATE TRIGGER on_user_created_initialize_free_tier
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_free_tier();

-- Add comment for documentation
COMMENT ON FUNCTION public.initialize_free_tier() IS
'Automatically initializes free tier subscription for new users upon signup';

COMMENT ON TRIGGER on_user_created_initialize_free_tier ON auth.users IS
'Triggers free tier initialization when a new user is created';

-- ========================================
-- Grant necessary permissions
-- ========================================

-- Grant execute permission on the function to the service role
GRANT EXECUTE ON FUNCTION public.initialize_free_tier() TO service_role;

-- ========================================
-- Backfill existing users without subscriptions
-- ========================================

-- This ensures any existing users without subscriptions get free tier
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.subscriptions s ON u.id = s.user_id
    WHERE s.id IS NULL
  LOOP
    -- Create free tier subscription for users without one
    INSERT INTO public.subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      created_at,
      updated_at
    )
    VALUES (
      user_record.id,
      'free',
      'active',
      NOW(),
      NOW() + INTERVAL '100 years',
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Also ensure they have usage metrics
    INSERT INTO public.usage_metrics (
      user_id,
      month,
      posts_created,
      ai_credits_used,
      active_brands,
      connected_accounts,
      created_at,
      updated_at
    )
    VALUES (
      user_record.id,
      DATE_TRUNC('month', NOW())::date,
      0,
      0,
      0,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, month) DO NOTHING;

    RAISE NOTICE 'Initialized free tier for existing user: %', user_record.email;
  END LOOP;
END $$;

-- ========================================
-- Verification query (for testing)
-- ========================================
-- Run this to verify all users have subscriptions:
-- SELECT u.id, u.email, s.plan_id, s.status
-- FROM auth.users u
-- LEFT JOIN public.subscriptions s ON u.id = s.user_id
-- WHERE s.id IS NULL;