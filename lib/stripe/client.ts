/**
 * Stripe Client Configuration
 * Server-side Stripe client for payment processing
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

// Initialize Stripe client with API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
  appInfo: {
    name: 'SMGE',
    version: '1.0.0',
    url: 'https://smge.app',
  },
});

/**
 * Get Stripe price IDs from environment
 */
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER || '',
  growth: process.env.STRIPE_PRICE_ID_GROWTH || '',
  agency: process.env.STRIPE_PRICE_ID_AGENCY || '',
} as const;

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
