/**
 * Subscription and Payment Types
 * Defines types for Stripe integration, subscription plans, usage tracking
 */

import type Stripe from 'stripe';

// ============================================================================
// SUBSCRIPTION PLAN TYPES
// ============================================================================

export type PlanId = 'free' | 'starter' | 'growth' | 'agency';

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface PlanLimits {
  brands: number;
  posts_per_month: number;
  social_accounts_per_brand: number;
  ai_credits_per_month: number;
  team_members: number;
  features: string[];
}

export interface SubscriptionPlan {
  id: string;
  plan_id: PlanId;
  name: string;
  description: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  currency: string;
  limits: PlanLimits;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  latest_invoice_id: string | null;
  default_payment_method: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: SubscriptionPlan;
}

// ============================================================================
// USAGE METRICS TYPES
// ============================================================================

export interface UsageMetrics {
  id: string;
  user_id: string;
  subscription_id: string | null;
  period_start: string;
  period_end: string;
  posts_created: number;
  posts_scheduled: number;
  posts_published: number;
  ai_credits_consumed: number;
  ai_image_generations: number;
  ai_content_generations: number;
  brands_created: number;
  social_accounts_connected: number;
  storage_bytes: number;
  media_files_count: number;
  api_calls: number;
  webhook_calls: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UsageStatus {
  current: UsageMetrics;
  limits: PlanLimits;
  usage_percentage: {
    posts: number;
    ai_credits: number;
    brands: number;
    social_accounts: number;
  };
  warnings: string[];
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_invoice_id: string;
  stripe_customer_id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  payment_intent_id: string | null;
  paid_at: string | null;
  attempt_count: number;
  next_payment_attempt: string | null;
  last_finalization_error: Record<string, any> | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// WEBHOOK EVENT TYPES
// ============================================================================

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  event_data: Record<string, any>;
  processed: boolean;
  processed_at: string | null;
  processing_attempts: number;
  error_message: string | null;
  error_stack: string | null;
  api_version: string | null;
  request_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// STRIPE API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateCheckoutSessionRequest {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  customerId?: string;
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string | null;
}

export interface CreatePortalSessionRequest {
  returnUrl?: string;
}

export interface CreatePortalSessionResponse {
  url: string;
}

export interface SubscriptionStatusResponse {
  subscription: SubscriptionWithPlan | null;
  usage: UsageMetrics | null;
  is_active: boolean;
  days_until_renewal: number | null;
  cancel_at_period_end: boolean;
}

// ============================================================================
// USAGE ENFORCEMENT TYPES
// ============================================================================

export type UsageAction =
  | 'create_post'
  | 'create_brand'
  | 'connect_social_account'
  | 'use_ai_credits';

export interface UsageCheckResult {
  allowed: boolean;
  current_usage: number;
  limit: number;
  percentage_used: number;
  message?: string;
}

// ============================================================================
// STRIPE WEBHOOK EVENT TYPES
// ============================================================================

export type StripeWebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'customer.created'
  | 'customer.updated';

export interface StripeWebhookPayload {
  id: string;
  type: StripeWebhookEventType;
  data: {
    object: Stripe.Subscription | Stripe.Invoice | Stripe.Customer | Stripe.Checkout.Session;
  };
}

// ============================================================================
// PLAN COMPARISON TYPES
// ============================================================================

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: number | string;
  description?: string;
}

export interface PlanComparison extends SubscriptionPlan {
  is_current: boolean;
  is_recommended: boolean;
  features: PlanFeature[];
  price_display: string;
  savings_display?: string;
}
