# Payment Integration Documentation

## Overview

SMGE uses Stripe for subscription billing and payment processing. This document covers the complete setup, architecture, and usage of the payment system.

## Architecture

### Components

1. **Database Schema** (`00005_payment_subscription_schema.sql`)
   - `subscription_plans` - Static plan definitions
   - `subscriptions` - User subscription state
   - `usage_metrics` - Monthly usage tracking
   - `invoices` - Billing history
   - `webhook_events` - Idempotent event processing

2. **API Routes**
   - `/api/stripe/checkout` - Create checkout sessions
   - `/api/stripe/portal` - Customer portal access
   - `/api/webhooks/stripe` - Webhook event receiver
   - `/api/subscription/*` - Subscription management

3. **Libraries**
   - `lib/stripe/client.ts` - Stripe client configuration
   - `lib/stripe/subscription.ts` - Business logic
   - `lib/stripe/webhook-handlers.ts` - Event processing
   - `lib/middleware/usage-guard.ts` - Usage enforcement

## Subscription Plans

### Free Tier
- **Price:** $0/month
- **Limits:**
  - 1 brand
  - 10 posts/month
  - 1 social account per brand
  - 100 AI credits/month
  - Basic content calendar

### Starter Plan
- **Price:** $29/month
- **Stripe Price ID:** `STRIPE_PRICE_ID_STARTER`
- **Limits:**
  - 5 brands
  - 100 posts/month
  - 2 social accounts per brand
  - 1,000 AI credits/month
  - Features: Content calendar, basic analytics, Brand Brain

### Growth Plan
- **Price:** $99/month
- **Stripe Price ID:** `STRIPE_PRICE_ID_GROWTH`
- **Limits:**
  - 15 brands
  - 500 posts/month
  - 5 social accounts per brand
  - 5,000 AI credits/month
  - 3 team members
  - Features: Advanced analytics, AI repurposing, Engagement Agent

### Agency Plan
- **Price:** $299/month
- **Stripe Price ID:** `STRIPE_PRICE_ID_AGENCY`
- **Limits:**
  - Unlimited brands
  - 2,000 posts/month
  - Unlimited social accounts
  - 20,000 AI credits/month
  - 10 team members
  - Features: White-label, team management, client approvals

## Setup Instructions

### 1. Stripe Account Configuration

1. Create a Stripe account at https://dashboard.stripe.com
2. Get your API keys:
   - Secret key: `sk_test_...` (for development)
   - Publishable key: `pk_test_...`

3. Create Products and Prices:
   ```bash
   # In Stripe Dashboard > Products
   # Create 3 products: Starter, Growth, Agency
   # Set up monthly recurring prices for each
   # Copy the Price IDs (price_xxx)
   ```

### 2. Environment Variables

Add to `.env.local`:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs
STRIPE_PRICE_ID_STARTER=price_xxx
STRIPE_PRICE_ID_GROWTH=price_xxx
STRIPE_PRICE_ID_AGENCY=price_xxx

# Supabase (required for webhook processing)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Migration

Run the payment schema migration:

```bash
# Apply migration to Supabase
supabase db push
```

### 4. Webhook Configuration

#### Local Development (using Stripe CLI)

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Copy the webhook signing secret (`whsec_xxx`) to your `.env.local`

#### Production Setup

1. In Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. Copy the webhook signing secret to production environment variables

## Usage Guide

### Creating a Checkout Session

```typescript
// Client-side: Redirect to checkout
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    priceId: 'price_xxx', // Stripe price ID
    successUrl: 'https://app.com/dashboard/billing?success=true',
    cancelUrl: 'https://app.com/pricing',
  }),
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Checkout
```

### Checking Subscription Status

```typescript
const response = await fetch('/api/subscription/status');
const { subscription, usage, is_active } = await response.json();

console.log('Current plan:', subscription.plan_id);
console.log('Posts used:', usage.posts_created);
console.log('Posts limit:', subscription.plan.limits.posts_per_month);
```

### Enforcing Usage Limits

```typescript
import { enforceUsageLimit, incrementUsage } from '@/lib/middleware/usage-guard';

// In API route handler
export async function POST(request: Request) {
  const userId = await getUserId();

  // Check if user can create a post
  try {
    await enforceUsageLimit(userId, 'create_post');
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({
        error: error.message,
        usage: error.usageCheck,
      }, { status: 403 });
    }
  }

  // Create post...

  // Increment usage counter
  await incrementUsage(userId, 'posts_created', 1);

  return NextResponse.json({ success: true });
}
```

### Customer Portal Access

```typescript
// Redirect user to Stripe Customer Portal
const response = await fetch('/api/stripe/portal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    returnUrl: 'https://app.com/dashboard/billing',
  }),
});

const { url } = await response.json();
window.location.href = url;
```

### Canceling Subscription

```typescript
const response = await fetch('/api/subscription/cancel', {
  method: 'POST',
});

if (response.ok) {
  console.log('Subscription will cancel at period end');
}
```

### Changing Plans

```typescript
const response = await fetch('/api/subscription/change-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: 'growth', // 'starter', 'growth', or 'agency'
  }),
});

if (response.ok) {
  console.log('Plan changed successfully');
}
```

## Webhook Event Flow

### checkout.session.completed
1. User completes payment in Stripe Checkout
2. Webhook received at `/api/webhooks/stripe`
3. Creates `subscriptions` record with Stripe subscription ID
4. Updates `profiles.subscription_tier`
5. Initializes `usage_metrics` for current period

### customer.subscription.updated
1. Subscription changes (upgrade/downgrade/renewal)
2. Webhook updates `subscriptions` table
3. Syncs `profiles.subscription_tier`
4. Resets usage counters on renewal

### invoice.payment_succeeded
1. Monthly payment succeeds
2. Creates/updates `invoices` record
3. Subscription remains active

### invoice.payment_failed
1. Payment fails
2. Updates `invoices` with failure details
3. Subscription enters `past_due` status
4. User receives email notification (TODO: implement)
5. Grace period allows continued access
6. After retries exhausted, subscription canceled

## Database Functions

### get_active_subscription(user_id)
Returns current active subscription with plan limits.

```sql
SELECT * FROM get_active_subscription('user-uuid');
```

### get_current_usage(user_id)
Returns usage metrics for current billing period.

```sql
SELECT * FROM get_current_usage('user-uuid');
```

### can_perform_action(user_id, action)
Checks if user can perform action based on limits.

```sql
SELECT can_perform_action('user-uuid', 'create_post');
-- Returns: true/false
```

### increment_usage(user_id, metric, amount)
Increments usage counter for a metric.

```sql
SELECT increment_usage('user-uuid', 'posts_created', 1);
```

## Security Considerations

### Webhook Signature Verification
All webhook events are verified using Stripe signature verification:

```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

**CRITICAL:** Never skip signature verification in production.

### Idempotency
Webhooks are processed idempotently using the `webhook_events` table:

```typescript
// Check if event already processed
const { data: existingEvent } = await supabase
  .from('webhook_events')
  .select('processed')
  .eq('stripe_event_id', eventId)
  .single();

if (existingEvent?.processed) {
  return; // Skip duplicate processing
}
```

### Service Role Access
Webhook handlers use Supabase service role to bypass RLS:

```typescript
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**NEVER** expose service role key to client-side code.

### PCI Compliance
- No credit card data stored in our database
- All payment processing handled by Stripe
- Only store Stripe customer IDs and subscription IDs

## Testing

### Test Mode
Use Stripe test mode for development:

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

### Testing Webhooks Locally

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 3: Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
```

## Monitoring

### Stripe Dashboard
- Monitor failed payments
- View subscription metrics
- Check webhook delivery logs

### Database Queries

```sql
-- Check recent webhook events
SELECT event_type, processed, error_message, created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 50;

-- View active subscriptions
SELECT u.email, s.plan_id, s.status, s.current_period_end
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.status IN ('active', 'trialing')
ORDER BY s.created_at DESC;

-- Check high usage users
SELECT u.email, um.posts_created, sp.limits->>'posts_per_month' as limit
FROM usage_metrics um
JOIN auth.users u ON u.id = um.user_id
JOIN subscriptions s ON s.user_id = um.user_id
JOIN subscription_plans sp ON sp.plan_id = s.plan_id
WHERE um.period_end >= NOW()
ORDER BY um.posts_created DESC;
```

## Troubleshooting

### Webhook Events Not Processing
1. Check webhook signing secret matches
2. Verify webhook endpoint is publicly accessible
3. Check Stripe Dashboard > Webhooks > Logs
4. Review `webhook_events` table for errors

### Subscription Not Syncing
1. Check if webhook event was received
2. Verify `stripe_customer_id` matches
3. Check RLS policies allow service role access
4. Review application logs for errors

### Usage Limits Not Enforcing
1. Verify `usage_metrics` record exists for current period
2. Check subscription has valid `limits` JSON
3. Test `can_perform_action` function directly
4. Ensure middleware is called before action

## Maintenance

### Updating Plans
To add or modify subscription plans:

```sql
-- Add new plan
INSERT INTO subscription_plans (plan_id, name, price_monthly_cents, limits)
VALUES ('enterprise', 'Enterprise', 99900, '{"brands": 999, "posts_per_month": 10000, ...}'::jsonb);

-- Update plan limits
UPDATE subscription_plans
SET limits = '{"brands": 10, "posts_per_month": 200, ...}'::jsonb
WHERE plan_id = 'starter';
```

### Data Retention
- Keep `invoices` indefinitely for tax/legal
- Archive old `webhook_events` after 90 days
- Keep `usage_metrics` for at least 12 months

## Support

For issues related to:
- Stripe integration: Check Stripe Dashboard logs
- Database issues: Review Supabase logs
- Application errors: Check Next.js server logs

## References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
