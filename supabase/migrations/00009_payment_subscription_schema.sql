-- Payment and Subscription Schema
-- Migration: 00005_payment_subscription_schema
-- Description: Stripe subscription integration, usage tracking, and plan enforcement
-- Features: Subscription state management, usage metering, invoice tracking, webhook idempotency

-- ============================================================================
-- SUBSCRIPTION PLANS REFERENCE TABLE
-- ============================================================================
-- Static reference data for available subscription plans
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(100) NOT NULL UNIQUE, -- "starter", "growth", "agency"
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Stripe Configuration
    stripe_price_id VARCHAR(255), -- Stripe price ID for this plan
    stripe_product_id VARCHAR(255), -- Stripe product ID

    -- Pricing
    price_monthly_cents INTEGER NOT NULL,
    price_yearly_cents INTEGER, -- For annual billing (if offered)
    currency VARCHAR(3) DEFAULT 'USD',

    -- Feature Limits
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "brands": 5,
    --   "posts_per_month": 100,
    --   "social_accounts_per_brand": 2,
    --   "ai_credits_per_month": 1000,
    --   "team_members": 1,
    --   "features": ["basic_analytics", "content_calendar"]
    -- }

    -- Plan Metadata
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active, display_order);

-- Add comment
COMMENT ON TABLE public.subscription_plans IS 'Static reference data for available subscription tiers and their feature limits';

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
-- User subscription state synced from Stripe
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Stripe Integration
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),

    -- Subscription Details
    plan_id VARCHAR(100) NOT NULL REFERENCES public.subscription_plans(plan_id),
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'incomplete', 'incomplete_expired', 'trialing', 'active',
        'past_due', 'canceled', 'unpaid', 'paused'
    )),

    -- Billing Cycle
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,

    -- Trial Information
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,

    -- Payment Information
    latest_invoice_id VARCHAR(255),
    default_payment_method VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional Stripe metadata

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one active subscription per user
    CONSTRAINT subscriptions_user_unique UNIQUE(user_id, stripe_subscription_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- Add comment
COMMENT ON TABLE public.subscriptions IS 'User subscription state synced from Stripe webhooks';

-- ============================================================================
-- USAGE_METRICS TABLE
-- ============================================================================
-- Track usage against subscription limits
CREATE TABLE public.usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

    -- Billing Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Usage Counters
    posts_created INTEGER DEFAULT 0,
    posts_scheduled INTEGER DEFAULT 0,
    posts_published INTEGER DEFAULT 0,

    ai_credits_consumed INTEGER DEFAULT 0, -- For AI generation calls
    ai_image_generations INTEGER DEFAULT 0,
    ai_content_generations INTEGER DEFAULT 0,

    brands_created INTEGER DEFAULT 0,
    social_accounts_connected INTEGER DEFAULT 0,

    -- Storage Usage
    storage_bytes BIGINT DEFAULT 0,
    media_files_count INTEGER DEFAULT 0,

    -- API Usage
    api_calls INTEGER DEFAULT 0,
    webhook_calls INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one usage record per user per period
    CONSTRAINT usage_metrics_user_period_unique UNIQUE(user_id, period_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_id ON public.usage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON public.usage_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_subscription_id ON public.usage_metrics(subscription_id);

-- Add comment
COMMENT ON TABLE public.usage_metrics IS 'Monthly usage tracking for enforcing subscription plan limits';

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
-- Track billing history from Stripe
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

    -- Stripe Integration
    stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL,

    -- Invoice Details
    amount_due INTEGER NOT NULL, -- Amount in cents
    amount_paid INTEGER DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',

    status VARCHAR(50) NOT NULL CHECK (status IN (
        'draft', 'open', 'paid', 'void', 'uncollectible'
    )),

    -- Billing Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Invoice URLs
    hosted_invoice_url TEXT,
    invoice_pdf_url TEXT,

    -- Payment Information
    payment_intent_id VARCHAR(255),
    paid_at TIMESTAMPTZ,

    -- Failure Information
    attempt_count INTEGER DEFAULT 0,
    next_payment_attempt TIMESTAMPTZ,
    last_finalization_error JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice ON public.invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period_start, period_end);

-- Add comment
COMMENT ON TABLE public.invoices IS 'Billing invoice history synced from Stripe';

-- ============================================================================
-- WEBHOOK_EVENTS TABLE
-- ============================================================================
-- Idempotent webhook event processing
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,

    -- Event Details
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,

    -- Processing State
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_attempts INTEGER DEFAULT 0,

    -- Error Tracking
    error_message TEXT,
    error_stack TEXT,

    -- Request Information
    api_version VARCHAR(50),
    request_id VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event ON public.webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.webhook_events(created_at DESC);

-- Add comment
COMMENT ON TABLE public.webhook_events IS 'Stripe webhook events for idempotent processing and audit trail';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ===================
-- SUBSCRIPTION_PLANS POLICIES (Public Read)
-- ===================

-- Anyone can view active subscription plans
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans"
    ON public.subscription_plans FOR SELECT
    USING (is_active = true);

-- Only service role can manage plans
DROP POLICY IF EXISTS "Service role can manage plans" ON public.subscription_plans;
CREATE POLICY "Service role can manage plans"
    ON public.subscription_plans FOR ALL
    TO service_role
    USING (true);

-- ===================
-- SUBSCRIPTIONS POLICIES
-- ===================

-- Users can view their own subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for Stripe webhooks)
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage all subscriptions"
    ON public.subscriptions FOR ALL
    TO service_role
    USING (true);

-- ===================
-- USAGE_METRICS POLICIES
-- ===================

-- Users can view their own usage metrics
DROP POLICY IF EXISTS "Users can view own usage metrics" ON public.usage_metrics;
CREATE POLICY "Users can view own usage metrics"
    ON public.usage_metrics FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all usage metrics
DROP POLICY IF EXISTS "Service role can manage usage metrics" ON public.usage_metrics;
CREATE POLICY "Service role can manage usage metrics"
    ON public.usage_metrics FOR ALL
    TO service_role
    USING (true);

-- ===================
-- INVOICES POLICIES
-- ===================

-- Users can view their own invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices"
    ON public.invoices FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all invoices
DROP POLICY IF EXISTS "Service role can manage invoices" ON public.invoices;
CREATE POLICY "Service role can manage invoices"
    ON public.invoices FOR ALL
    TO service_role
    USING (true);

-- ===================
-- WEBHOOK_EVENTS POLICIES (Service Role Only)
-- ===================

-- Only service role can access webhook events
DROP POLICY IF EXISTS "Service role can manage webhook events" ON public.webhook_events;
CREATE POLICY "Service role can manage webhook events"
    ON public.webhook_events FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION public.get_active_subscription(p_user_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id VARCHAR(100),
    status VARCHAR(50),
    current_period_end TIMESTAMPTZ,
    limits JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.plan_id,
        s.status,
        s.current_period_end,
        sp.limits
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.plan_id = s.plan_id
    WHERE s.user_id = p_user_id
        AND s.status IN ('active', 'trialing', 'past_due')
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current usage for a user
CREATE OR REPLACE FUNCTION public.get_current_usage(p_user_id UUID)
RETURNS TABLE (
    posts_created INTEGER,
    ai_credits_consumed INTEGER,
    brands_created INTEGER,
    social_accounts_connected INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(um.posts_created, 0),
        COALESCE(um.ai_credits_consumed, 0),
        COALESCE(um.brands_created, 0),
        COALESCE(um.social_accounts_connected, 0)
    FROM public.usage_metrics um
    WHERE um.user_id = p_user_id
        AND um.period_start <= NOW()
        AND um.period_end >= NOW()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user can perform action based on limits
CREATE OR REPLACE FUNCTION public.can_perform_action(
    p_user_id UUID,
    p_action VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_subscription RECORD;
    v_usage RECORD;
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    -- Get active subscription with limits
    SELECT * INTO v_subscription
    FROM public.get_active_subscription(p_user_id);

    -- If no active subscription, check against free tier
    IF v_subscription IS NULL THEN
        SELECT * INTO v_subscription
        FROM public.subscription_plans
        WHERE plan_id = 'free'
        LIMIT 1;
    END IF;

    -- Get current usage
    SELECT * INTO v_usage
    FROM public.get_current_usage(p_user_id);

    -- Check limits based on action type
    CASE p_action
        WHEN 'create_post' THEN
            v_limit := (v_subscription.limits->>'posts_per_month')::INTEGER;
            v_current := COALESCE(v_usage.posts_created, 0);
        WHEN 'create_brand' THEN
            v_limit := (v_subscription.limits->>'brands')::INTEGER;
            v_current := COALESCE(v_usage.brands_created, 0);
        WHEN 'connect_social_account' THEN
            v_limit := (v_subscription.limits->>'social_accounts_per_brand')::INTEGER;
            v_current := COALESCE(v_usage.social_accounts_connected, 0);
        WHEN 'use_ai_credits' THEN
            v_limit := (v_subscription.limits->>'ai_credits_per_month')::INTEGER;
            v_current := COALESCE(v_usage.ai_credits_consumed, 0);
        ELSE
            RETURN false;
    END CASE;

    -- Return true if under limit
    RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_user_id UUID,
    p_metric VARCHAR(100),
    p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_subscription_id UUID;
BEGIN
    -- Get current billing period from active subscription
    SELECT current_period_start, current_period_end, id
    INTO v_period_start, v_period_end, v_subscription_id
    FROM public.subscriptions
    WHERE user_id = p_user_id
        AND status IN ('active', 'trialing', 'past_due')
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no active subscription, use calendar month
    IF v_period_start IS NULL THEN
        v_period_start := date_trunc('month', NOW());
        v_period_end := date_trunc('month', NOW() + INTERVAL '1 month');
    END IF;

    -- Upsert usage metrics
    INSERT INTO public.usage_metrics (
        user_id,
        subscription_id,
        period_start,
        period_end,
        posts_created,
        ai_credits_consumed,
        brands_created,
        social_accounts_connected
    ) VALUES (
        p_user_id,
        v_subscription_id,
        v_period_start,
        v_period_end,
        CASE WHEN p_metric = 'posts_created' THEN p_amount ELSE 0 END,
        CASE WHEN p_metric = 'ai_credits_consumed' THEN p_amount ELSE 0 END,
        CASE WHEN p_metric = 'brands_created' THEN p_amount ELSE 0 END,
        CASE WHEN p_metric = 'social_accounts_connected' THEN p_amount ELSE 0 END
    )
    ON CONFLICT (user_id, period_start)
    DO UPDATE SET
        posts_created = CASE WHEN p_metric = 'posts_created'
            THEN usage_metrics.posts_created + p_amount
            ELSE usage_metrics.posts_created END,
        ai_credits_consumed = CASE WHEN p_metric = 'ai_credits_consumed'
            THEN usage_metrics.ai_credits_consumed + p_amount
            ELSE usage_metrics.ai_credits_consumed END,
        brands_created = CASE WHEN p_metric = 'brands_created'
            THEN usage_metrics.brands_created + p_amount
            ELSE usage_metrics.brands_created END,
        social_accounts_connected = CASE WHEN p_metric = 'social_accounts_connected'
            THEN usage_metrics.social_accounts_connected + p_amount
            ELSE usage_metrics.social_accounts_connected END,
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync subscription tier to profile
CREATE OR REPLACE FUNCTION public.sync_subscription_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user profile with current subscription tier
    UPDATE public.profiles
    SET
        subscription_tier = NEW.plan_id,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync subscription changes to profile
DROP TRIGGER IF EXISTS sync_subscription_to_profile_trigger ON public.subscriptions;
CREATE TRIGGER sync_subscription_to_profile_trigger
    AFTER INSERT OR UPDATE OF plan_id, status ON public.subscriptions
    FOR EACH ROW
    WHEN (NEW.status IN ('active', 'trialing'))
    EXECUTE FUNCTION public.sync_subscription_to_profile();

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_metrics_updated_at ON public.usage_metrics;
CREATE TRIGGER update_usage_metrics_updated_at
    BEFORE UPDATE ON public.usage_metrics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON public.webhook_events;
CREATE TRIGGER update_webhook_events_updated_at
    BEFORE UPDATE ON public.webhook_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SEED DATA - Default Subscription Plans
-- ============================================================================

-- Insert default subscription plans
INSERT INTO public.subscription_plans (plan_id, name, description, price_monthly_cents, limits, display_order)
VALUES
    ('free', 'Free Tier', 'Get started with basic features', 0,
     '{"brands": 1, "posts_per_month": 10, "social_accounts_per_brand": 1, "ai_credits_per_month": 100, "team_members": 1, "features": ["basic_content_calendar"]}'::jsonb,
     0),
    ('starter', 'Starter Plan', 'Perfect for solo creators and small brands', 2900,
     '{"brands": 5, "posts_per_month": 100, "social_accounts_per_brand": 2, "ai_credits_per_month": 1000, "team_members": 1, "features": ["content_calendar", "basic_analytics", "brand_brain"]}'::jsonb,
     1),
    ('growth', 'Growth Plan', 'Scale your content strategy', 9900,
     '{"brands": 15, "posts_per_month": 500, "social_accounts_per_brand": 5, "ai_credits_per_month": 5000, "team_members": 3, "features": ["content_calendar", "advanced_analytics", "brand_brain", "ai_repurposing", "engagement_agent"]}'::jsonb,
     2),
    ('agency', 'Agency Plan', 'White-label solution for agencies', 29900,
     '{"brands": 999, "posts_per_month": 2000, "social_accounts_per_brand": 999, "ai_credits_per_month": 20000, "team_members": 10, "features": ["content_calendar", "advanced_analytics", "brand_brain", "ai_repurposing", "engagement_agent", "white_label", "team_management", "client_approvals"]}'::jsonb,
     3)
ON CONFLICT (plan_id) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.usage_metrics TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

COMMENT ON SCHEMA public IS 'SMGE with Payment & Subscription system - Migration 00005 completed';
