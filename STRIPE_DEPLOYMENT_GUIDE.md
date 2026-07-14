> **⚠️ DEPRECATED — historical reference only.** As of v4.0, Stripe billing was removed.
> Stripe checkout/portal endpoints now return `410 Gone`. See `.claude/rules/tier-system.md`
> for current behavior. The content below describes the system as it existed before removal,
> kept for historical/audit reference only.

# Stripe Billing Integration - Deployment Guide

## Summary

This PR restores the Stripe billing integration with a critical fix for the deployment error that was occurring on Railway.

### The Problem

The original deployment was failing with:
```
Error: Neither apiKey nor config.authenticator provided
at Stripe._setAuthenticator (/app/node_modules/stripe/cjs/stripe.core.js:158:23)
```

This happened because Stripe was being initialized immediately on module load, even when `STRIPE_SECRET_KEY` was not configured.

### The Solution

Implemented **lazy initialization** - Stripe client is only created when actually needed and only if the API key is present. This allows the server to start gracefully without Stripe configuration.

## What Works Now

### ✅ Without Stripe Configured
- Server starts successfully (no crash)
- Health check works
- All non-billing features work normally
- Billing endpoints return `503 Service Unavailable` with clear error messages

### ✅ With Stripe Configured
- Full billing functionality:
  - Checkout session creation
  - Customer portal access
  - Webhook event handling
  - Subscription management
- Trial system skips Stripe-managed organizations
- Proper error handling and logging

## Deployment Steps

### For Railway Production

1. **Set Environment Variables** in Railway dashboard:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...        # From https://dashboard.stripe.com/apikeys
   STRIPE_PUBLISHABLE_KEY=pk_live_...   # From https://dashboard.stripe.com/apikeys
   STRIPE_WEBHOOK_SECRET=whsec_...      # From https://dashboard.stripe.com/webhooks
   ```

2. **Deploy this branch** - it will now start successfully

3. **Run migration** (if not automatic):
   ```bash
   npm run migrate
   ```

4. **Configure Stripe webhook** at https://dashboard.stripe.com/webhooks:
   - URL: `https://your-app.railway.app/api/v1/billing/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

### For Development

1. **Install Stripe CLI** (optional, for local webhook testing):
   ```bash
   brew install stripe/stripe-cli/stripe  # macOS
   # or download from https://stripe.com/docs/stripe-cli
   ```

2. **Set environment variables** in `.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...  # From stripe listen
   ```

3. **Forward webhooks** (in a separate terminal):
   ```bash
   stripe listen --forward-to localhost:3001/api/v1/billing/webhook
   ```

4. **Start the server**:
   ```bash
   npm run dev
   ```

### Testing Without Stripe (Optional/Staging)

The server will start and run fine without any Stripe configuration. Just don't set the environment variables. Billing endpoints will return friendly error messages.

## API Endpoints

### Public Endpoints
- `GET /api/v1/billing/config` - Get Stripe publishable key
- `POST /api/v1/billing/webhook` - Stripe webhook receiver (requires raw body)

### Authenticated Endpoints
- `POST /api/v1/billing/checkout` - Create checkout session (Pro/Enterprise only)
- `POST /api/v1/billing/portal` - Create billing portal session  
- `GET /api/v1/billing/subscription` - Get current subscription details
- `POST /api/v1/billing/change-plan` - Upgrade or downgrade subscription plan (requires `settings.manage` permission)
- `POST /api/v1/billing/cancel` - Cancel subscription and downgrade to Community tier
- `POST /api/v1/billing/downgrade-to-free` - Downgrade to Community tier (when no active Stripe subscription)
- `POST /api/v1/billing/activate-license` - Activate perpetual license for Enterprise/Gov Cloud (requires `settings.manage` permission)

## Upgrade & Downgrade Flow

### How Plan Changes Work

When a user with an active Stripe subscription changes their plan:

1. **User clicks "Switch to {Plan}"** in Settings → Billing
2. **Frontend** calls `POST /api/v1/billing/change-plan` with the new `lookupKey` (e.g., `enterprise_monthly`)
3. **Backend** validates the request, determines if it's an upgrade or downgrade based on tier levels, and calls `stripe.subscriptions.update()` with `proration_behavior: 'create_prorations'`
4. **Stripe** immediately applies the plan change and creates prorated charges/credits:
   - **Upgrades**: Customer is charged a prorated amount for the remaining billing period
   - **Downgrades**: Customer receives a prorated credit for the remaining billing period
5. **Backend** updates the organization's tier in the database immediately
6. **Stripe webhook** (`customer.subscription.updated`) fires and confirms the tier change via the webhook handler

### Tier Hierarchy (from tierPolicy.js)
```
community (0) → pro (1) → enterprise (2) → govcloud (3, custom contract — no self-serve Stripe)
```

### Alternative: Stripe Customer Portal
Users can also manage their subscription via the Stripe Customer Portal (`POST /api/v1/billing/portal`). When plans are changed through the portal, the `customer.subscription.updated` webhook detects and applies the tier change automatically.

## Database Changes

Migration `055_stripe_billing.sql` adds:
- `organizations.stripe_customer_id` (VARCHAR 255, indexed)
- `organizations.stripe_subscription_id` (VARCHAR 255, indexed)

## Testing

Run the comprehensive test suite:
```bash
cd controlweave/backend
node test-stripe-integration.js
```

Expected output:
```
✅ All tests passed!
🎉 Stripe integration is ready for deployment!
```

## Verification After Deployment

1. Check server starts:
   ```bash
   curl https://your-app.railway.app/health
   ```

2. Check billing config endpoint:
   ```bash
   curl https://your-app.railway.app/api/v1/billing/config
   ```
   
   Should return:
   - With Stripe: `{"success":true,"data":{"publishableKey":"pk_live_..."}}`
   - Without Stripe: `{"success":false,"error":"Stripe is not configured"}`

## Rollback Plan

If issues occur, you can:
1. Remove the Stripe environment variables - server will still work
2. Or revert to the previous commit before this PR

## Security

- ✅ No vulnerabilities in stripe@17.5.0 dependency
- ✅ CodeQL analysis: 0 alerts
- ✅ Raw body middleware properly scoped to webhook endpoint only
- ✅ Proper error handling prevents information leakage
- ✅ All user inputs validated before Stripe API calls

## Support

If you encounter issues:
1. Check Railway logs for error messages
2. Verify environment variables are set correctly
3. Test billing config endpoint
4. Review webhook delivery in Stripe dashboard
