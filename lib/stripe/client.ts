/**
 * Stripe Client Configuration
 * Server-side Stripe client for payment processing
 *
 * PRICING STRUCTURE:
 * - Starter: $29/mo, $290/yr
 * - Professional: $79/mo, $790/yr
 * - Business: $199/mo, $1,990/yr
 * - Agency: $399/mo, $3,990/yr
 * - Enterprise: Custom pricing
 *
 * ADD-ONS:
 * - Extra Brand: $19/mo
 * - Team Seat: $15/mo per seat
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

// Initialize Stripe client with API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
  appInfo: {
    name: 'SMGE',
    version: '1.0.0',
    url: 'https://smge.app',
  },
});

// ============================================================================
// BILLING PERIOD TYPES
// ============================================================================

export type BillingPeriod = 'monthly' | 'annual';

// ============================================================================
// SUBSCRIPTION PLAN TYPES
// ============================================================================

export type SubscriptionPlanId =
  | 'free'
  | 'starter'
  | 'professional'
  | 'business'
  | 'agency'
  | 'enterprise';

export type PaidPlanId = Exclude<SubscriptionPlanId, 'free'>;

// ============================================================================
// ADD-ON TYPES
// ============================================================================

export type AddOnId = 'extra_brand' | 'team_seat';

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export interface PlanPricing {
  /** Price in cents for monthly billing */
  monthlyPriceCents: number;
  /** Price in cents for annual billing (null for Enterprise - custom pricing) */
  annualPriceCents: number | null;
  /** Stripe Price ID for monthly billing */
  monthlyPriceId: string;
  /** Stripe Price ID for annual billing */
  annualPriceId: string;
}

export interface PlanConfig extends PlanPricing {
  id: SubscriptionPlanId;
  name: string;
  description: string;
  isCustomPricing: boolean;
}

export interface AddOnConfig {
  id: AddOnId;
  name: string;
  description: string;
  /** Price in cents per month */
  priceCents: number;
  /** Stripe Price ID */
  priceId: string;
  /** Whether this is a per-seat addon */
  isPerSeat: boolean;
}

// ============================================================================
// STRIPE PRICE ID CONFIGURATION
// ============================================================================

/**
 * Get Stripe price IDs from environment variables
 * Returns empty string if not configured (will be validated before use)
 */
const getEnvPriceId = (envKey: string): string => {
  const value = process.env[envKey] || '';
  return value;
};

/**
 * Complete plan configuration with pricing and Stripe Price IDs
 * All prices are loaded from environment variables
 */
export const PLAN_CONFIG: Record<PaidPlanId, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individuals and small businesses getting started',
    monthlyPriceCents: 2900, // $29
    annualPriceCents: 29000, // $290 (2 months free)
    monthlyPriceId: getEnvPriceId('STRIPE_PRICE_STARTER_MONTHLY'),
    annualPriceId: getEnvPriceId('STRIPE_PRICE_STARTER_ANNUAL'),
    isCustomPricing: false,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'For growing businesses with advanced needs',
    monthlyPriceCents: 7900, // $79
    annualPriceCents: 79000, // $790 (2 months free)
    monthlyPriceId: getEnvPriceId('STRIPE_PRICE_PROFESSIONAL_MONTHLY'),
    annualPriceId: getEnvPriceId('STRIPE_PRICE_PROFESSIONAL_ANNUAL'),
    isCustomPricing: false,
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'For established businesses with high-volume needs',
    monthlyPriceCents: 19900, // $199
    annualPriceCents: 199000, // $1,990 (2 months free)
    monthlyPriceId: getEnvPriceId('STRIPE_PRICE_BUSINESS_MONTHLY'),
    annualPriceId: getEnvPriceId('STRIPE_PRICE_BUSINESS_ANNUAL'),
    isCustomPricing: false,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    description: 'For agencies managing multiple client brands',
    monthlyPriceCents: 39900, // $399
    annualPriceCents: 399000, // $3,990 (2 months free)
    monthlyPriceId: getEnvPriceId('STRIPE_PRICE_AGENCY_MONTHLY'),
    annualPriceId: getEnvPriceId('STRIPE_PRICE_AGENCY_ANNUAL'),
    isCustomPricing: false,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPriceCents: 0, // Custom pricing
    annualPriceCents: null, // Custom pricing
    monthlyPriceId: getEnvPriceId('STRIPE_PRICE_ENTERPRISE_MONTHLY'),
    annualPriceId: getEnvPriceId('STRIPE_PRICE_ENTERPRISE_ANNUAL'),
    isCustomPricing: true,
  },
};

/**
 * Add-on configuration with pricing and Stripe Price IDs
 */
export const ADDON_CONFIG: Record<AddOnId, AddOnConfig> = {
  extra_brand: {
    id: 'extra_brand',
    name: 'Extra Brand',
    description: 'Add an additional brand to your account',
    priceCents: 1900, // $19/mo
    priceId: getEnvPriceId('STRIPE_PRICE_ADDON_EXTRA_BRAND'),
    isPerSeat: false,
  },
  team_seat: {
    id: 'team_seat',
    name: 'Team Seat',
    description: 'Add a team member seat to your account',
    priceCents: 1500, // $15/mo
    priceId: getEnvPriceId('STRIPE_PRICE_ADDON_TEAM_SEAT'),
    isPerSeat: true,
  },
};

// ============================================================================
// LEGACY COMPATIBILITY - STRIPE_PRICE_IDS
// ============================================================================

/**
 * @deprecated Use PLAN_CONFIG instead for full plan details
 * Legacy mapping for backward compatibility
 * Maps plan ID to monthly Stripe Price ID
 */
export const STRIPE_PRICE_IDS = {
  starter: PLAN_CONFIG.starter.monthlyPriceId,
  professional: PLAN_CONFIG.professional.monthlyPriceId,
  business: PLAN_CONFIG.business.monthlyPriceId,
  agency: PLAN_CONFIG.agency.monthlyPriceId,
  enterprise: PLAN_CONFIG.enterprise.monthlyPriceId,
  // Legacy aliases for backward compatibility
  growth: PLAN_CONFIG.professional.monthlyPriceId, // 'growth' was renamed to 'professional'
} as const;

// ============================================================================
// PRICE ID VALIDATION
// ============================================================================

/**
 * Validates that a Price ID is properly configured (not a placeholder or empty)
 */
export function isValidPriceId(priceId: string): boolean {
  if (!priceId || priceId.trim() === '') {
    return false;
  }
  // Reject placeholder values
  if (priceId.includes('PLACEHOLDER')) {
    return false;
  }
  // Valid Stripe Price IDs start with 'price_'
  if (!priceId.startsWith('price_')) {
    return false;
  }
  return true;
}

/**
 * Get Price ID for a plan and billing period
 * Throws an error if the Price ID is not configured
 */
export function getPriceId(planId: PaidPlanId, billingPeriod: BillingPeriod): string {
  const plan = PLAN_CONFIG[planId];
  if (!plan) {
    throw new Error(`Invalid plan ID: ${planId}`);
  }

  const priceId = billingPeriod === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;

  if (!isValidPriceId(priceId)) {
    throw new Error(
      `Stripe Price ID not configured for ${planId} ${billingPeriod}. ` +
        `Please set the STRIPE_PRICE_${planId.toUpperCase()}_${billingPeriod.toUpperCase()} environment variable.`
    );
  }

  return priceId;
}

/**
 * Get Add-on Price ID
 * Throws an error if the Price ID is not configured
 */
export function getAddOnPriceId(addOnId: AddOnId): string {
  const addOn = ADDON_CONFIG[addOnId];
  if (!addOn) {
    throw new Error(`Invalid add-on ID: ${addOnId}`);
  }

  if (!isValidPriceId(addOn.priceId)) {
    throw new Error(
      `Stripe Price ID not configured for add-on: ${addOnId}. ` +
        `Please set the STRIPE_PRICE_ADDON_${addOnId.toUpperCase()} environment variable.`
    );
  }

  return addOn.priceId;
}

/**
 * Check if all required Price IDs are configured for a plan
 */
export function isPlanFullyConfigured(planId: PaidPlanId): boolean {
  const plan = PLAN_CONFIG[planId];
  if (!plan) return false;

  return isValidPriceId(plan.monthlyPriceId) && isValidPriceId(plan.annualPriceId);
}

/**
 * Get list of all configured plans (with valid Price IDs)
 */
export function getConfiguredPlans(): PaidPlanId[] {
  return (Object.keys(PLAN_CONFIG) as PaidPlanId[]).filter(isPlanFullyConfigured);
}

/**
 * Get list of plans missing configuration
 */
export function getMissingPlanConfigs(): { planId: PaidPlanId; missing: ('monthly' | 'annual')[] }[] {
  const results: { planId: PaidPlanId; missing: ('monthly' | 'annual')[] }[] = [];

  for (const planId of Object.keys(PLAN_CONFIG) as PaidPlanId[]) {
    const plan = PLAN_CONFIG[planId];
    const missing: ('monthly' | 'annual')[] = [];

    if (!isValidPriceId(plan.monthlyPriceId)) {
      missing.push('monthly');
    }
    if (!isValidPriceId(plan.annualPriceId)) {
      missing.push('annual');
    }

    if (missing.length > 0) {
      results.push({ planId, missing });
    }
  }

  return results;
}

// ============================================================================
// PRICE LOOKUP BY STRIPE PRICE ID
// ============================================================================

/**
 * Reverse lookup: Get plan details from a Stripe Price ID
 */
export function getPlanByPriceId(
  priceId: string
): { plan: PlanConfig; billingPeriod: BillingPeriod } | null {
  for (const plan of Object.values(PLAN_CONFIG)) {
    if (plan.monthlyPriceId === priceId) {
      return { plan, billingPeriod: 'monthly' };
    }
    if (plan.annualPriceId === priceId) {
      return { plan, billingPeriod: 'annual' };
    }
  }
  return null;
}

/**
 * Reverse lookup: Get add-on details from a Stripe Price ID
 */
export function getAddOnByPriceId(priceId: string): AddOnConfig | null {
  for (const addOn of Object.values(ADDON_CONFIG)) {
    if (addOn.priceId === priceId) {
      return addOn;
    }
  }
  return null;
}

// ============================================================================
// CLIENT-SIDE EXPORTS
// ============================================================================

/**
 * Get Stripe publishable key for client-side
 */
export const getPublishableKey = () => {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
};

/**
 * Webhook secret for signature verification
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
