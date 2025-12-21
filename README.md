<div align="center">

<img src="logo.png" alt="PayLayer Logo" width="200" />

# 💳 @paylayer/core

**Build billing once. Switch providers anytime.**

[![npm version](https://img.shields.io/npm/v/@paylayer/core.svg?style=flat-square)](https://www.npmjs.com/package/@paylayer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

A production-grade, provider-agnostic payments SDK for Node.js that provides a unified API for one-time payments, subscriptions, and webhooks across multiple payment providers.

[Features](#-features) • [Quick Start](#-quick-start) • [API Reference](#-api-reference) • [Webhooks](#-webhooks) • [Providers](#-supported-providers)

</div>

---

## What is PayLayer?

PayLayer is a unified payments SDK that lets you integrate billing into your application once and switch between payment providers (Stripe, Paddle, PayPal, Lemon Squeezy, Polar.sh) without changing your code. Write your billing logic once, deploy anywhere.

**Key Benefits:**

- **Provider Flexibility** - Switch providers without code changes
- **Unified API** - One consistent interface for all providers
- **Type Safety** - Full TypeScript support with autocomplete
- **Production Ready** - Fully implemented for all supported providers

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Webhooks](#-webhooks)
- [Supported Providers](#-supported-providers)
- [TypeScript Support](#-typescript-support)
- [Security](#-security)
- [Error Handling](#-error-handling)
- [License](#-license)

---

## ✨ Features

| Feature                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| 💰 **One-time payments** | Charge customers with a simple API                           |
| 🔄 **Subscriptions**     | Create and manage recurring billing                          |
| 🔔 **Webhooks**          | Normalized event handling across providers                   |
| 🏢 **Billing portal**    | Customer self-service portal URLs                            |
| 🔀 **Provider-agnostic** | Switch providers without changing your code                  |
| 📘 **TypeScript**        | Full type safety out of the box                              |
| 📦 **ESM + CJS**         | Works with both module systems                               |
| 🚀 **Production-ready**  | Fully functional implementations for all supported providers |

---

## 📦 Installation

```bash
npm install @paylayer/core
```

---

## 🚀 Quick Start

### 1. Install and Configure

```bash
npm install @paylayer/core
```

Create a `.env` file:

```bash
PAYLAYER_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

### 2. Use the SDK

```typescript
import { pay } from "@paylayer/core";

// One-time payment
const charge = await pay.charge({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
});

// Create subscription
const subscription = await pay.subscribe({
  plan: "pro-monthly",
  currency: "USD",
  email: "customer@example.com",
});

// Checkout session
const checkout = await pay.checkout({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
  successUrl: "https://myapp.com/success",
  cancelUrl: "https://myapp.com/cancel",
});

// Billing portal
const portalUrl = await pay.portal({
  email: "customer@example.com",
});

// Subscription management
await pay.cancel("sub_1234567890");
await pay.pause("sub_1234567890");
await pay.resume("sub_1234567890");
```

### Complete Example Application

For a complete working example with Express.js integration, see the [PayLayer Express Example](https://github.com/ajagatobby/paylayer-core-example) repository. It includes:

- Full Express.js application setup
- Service layer architecture
- Webhook handling implementation
- All payment operations demonstrated
- Ready-to-run code examples

---

## ⚙️ Configuration

### Core Variables

| Variable               | Required | Description                                 | Valid Values                                                  |
| ---------------------- | -------- | ------------------------------------------- | ------------------------------------------------------------- |
| `PAYLAYER_PROVIDER`    | ✅       | Payment provider to use                     | `stripe`, `paddle`, `paypal`, `lemonsqueezy`, `polar`, `mock` |
| `PAYLAYER_ENVIRONMENT` | ❌       | Environment mode (defaults to `production`) | `sandbox`, `test`, `production`, `live`                       |

### Provider Credentials

Each provider requires specific environment variables:

| Provider          | Required Variables                                                             | Optional Variables                                                               |
| ----------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Stripe**        | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                   | `STRIPE_PORTAL_RETURN_URL`                                                       |
| **Paddle**        | `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_DEFAULT_PRICE_ID`           | `PADDLE_BASE_URL`, `PADDLE_PORTAL_BASE_URL`                                      |
| **PayPal**        | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_SECRET`            | `PAYPAL_BASE_URL`, `PAYPAL_BRAND_NAME`, `PAYPAL_RETURN_URL`, `PAYPAL_CANCEL_URL` |
| **Lemon Squeezy** | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STORE_ID` | `LEMONSQUEEZY_BASE_URL`, `LEMONSQUEEZY_DEFAULT_VARIANT_ID`                       |
| **Polar.sh**      | `POLAR_OAT` (or `POLAR_ACCESS_TOKEN`), `POLAR_WEBHOOK_SECRET`                  | `POLAR_BASE_URL`, `POLAR_SUCCESS_URL`                                            |

### Configuration Examples

<details>
<summary><strong>Stripe</strong></summary>

```bash
PAYLAYER_PROVIDER=stripe
PAYLAYER_ENVIRONMENT=production
STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
STRIPE_PORTAL_RETURN_URL=https://myapp.com/settings/billing
```

</details>

<details>
<summary><strong>Paddle</strong></summary>

```bash
PAYLAYER_PROVIDER=paddle
PAYLAYER_ENVIRONMENT=sandbox
PADDLE_API_KEY=YOUR_API_KEY_HERE
PADDLE_WEBHOOK_SECRET=YOUR_SECRET_HERE
PADDLE_DEFAULT_PRICE_ID=pri_YOUR_PRICE_ID_HERE
```

</details>

<details>
<summary><strong>PayPal</strong></summary>

```bash
PAYLAYER_PROVIDER=paypal
PAYLAYER_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=YOUR_CLIENT_ID_HERE
PAYPAL_CLIENT_SECRET=YOUR_SECRET_HERE
PAYPAL_WEBHOOK_SECRET=YOUR_SECRET_HERE
PAYPAL_RETURN_URL=https://myapp.com/payment/success
PAYPAL_CANCEL_URL=https://myapp.com/payment/cancel
```

</details>

<details>
<summary><strong>Lemon Squeezy</strong></summary>

```bash
PAYLAYER_PROVIDER=lemonsqueezy
PAYLAYER_ENVIRONMENT=production
LEMONSQUEEZY_API_KEY=YOUR_API_KEY_HERE
LEMONSQUEEZY_WEBHOOK_SECRET=YOUR_SECRET_HERE
LEMONSQUEEZY_STORE_ID=YOUR_STORE_ID_HERE
```

</details>

<details>
<summary><strong>Polar.sh</strong></summary>

```bash
PAYLAYER_PROVIDER=polar
PAYLAYER_ENVIRONMENT=production
POLAR_OAT=YOUR_OAT_HERE
POLAR_WEBHOOK_SECRET=YOUR_SECRET_HERE
POLAR_SUCCESS_URL=https://myapp.com/payment/success
```

</details>

### Provider Setup

1. Create an account with your chosen provider
2. Get API keys/credentials from the provider dashboard
3. Create products/prices/plans in the provider dashboard
4. Set up webhooks pointing to `https://yourdomain.com/webhooks/paylayer`
5. Copy the webhook signing secret to your environment variables

**Provider Dashboards:**

- **Stripe**: [Dashboard](https://dashboard.stripe.com) → API Keys, Products, Webhooks
- **Paddle**: [Dashboard](https://vendors.paddle.com) → Authentication, Catalog, Notifications
- **PayPal**: [Developer Dashboard](https://developer.paypal.com/dashboard) → Apps, Billing, Webhooks
- **Lemon Squeezy**: [Dashboard](https://app.lemonsqueezy.com) → Settings → API, Stores, Webhooks
- **Polar**: [Dashboard](https://polar.sh/dashboard) → Settings → Access Tokens, Products, Webhooks

**Note:** For Stripe, use `lookup_key` on prices as the `plan` parameter. For other providers, use the price/plan/variant ID directly.

---

## 📚 API Reference

### One-Time Payments

#### `pay.charge(input)`

Creates a one-time payment charge.

**Parameters:**

| Parameter    | Type     | Required | Description                                          |
| ------------ | -------- | -------- | ---------------------------------------------------- |
| `amount`     | `number` | ✅\*     | Payment amount (e.g., `29.99` for $29.99)            |
| `currency`   | `string` | ✅       | ISO 4217 currency code (e.g., `'USD'`, `'EUR'`)      |
| `email`      | `string` | ❌       | Customer email address                               |
| `priceId`    | `string` | ✅\*     | Provider-specific price ID (alternative to amount)   |
| `productId`  | `string` | ✅\*     | Provider-specific product ID (alternative to amount) |
| `successUrl` | `string` | ❌       | URL to redirect after successful payment             |
| `cancelUrl`  | `string` | ❌       | URL to redirect if payment is cancelled              |
| `metadata`   | `object` | ❌       | Additional metadata to attach to the payment         |

\*Either `amount`, `priceId`, or `productId` must be provided.

**Returns:** `Promise<ChargeResult>`

```typescript
interface ChargeResult {
  id: string; // Payment ID from provider
  status: "pending" | "succeeded" | "failed";
  amount: number;
  currency: string;
  provider: string;
  email?: string;
  url?: string;
}
```

**Example:**

```typescript
const result = await pay.charge({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
});
```

#### `pay.checkout(input)`

Creates a checkout session/payment link. Returns a URL that can be opened in a browser to complete payment.

**Parameters:**

| Parameter    | Type     | Required | Description                              |
| ------------ | -------- | -------- | ---------------------------------------- |
| `amount`     | `number` | ❌       | Payment amount (for one-time payments)   |
| `plan`       | `string` | ❌       | Plan identifier (for subscriptions)      |
| `currency`   | `string` | ✅       | ISO 4217 currency code                   |
| `email`      | `string` | ❌       | Customer email address                   |
| `successUrl` | `string` | ✅       | URL to redirect after successful payment |
| `cancelUrl`  | `string` | ✅       | URL to redirect if payment is cancelled  |

**Returns:** `Promise<CheckoutResult>` with `url` property

**Example:**

```typescript
const checkout = await pay.checkout({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
  successUrl: "https://myapp.com/success",
  cancelUrl: "https://myapp.com/cancel",
});

// Redirect user to checkout.url
res.redirect(checkout.url);
```

### Subscriptions

#### `pay.subscribe(input)`

Creates a new subscription.

**Parameters:**

| Parameter    | Type     | Required | Description                                       |
| ------------ | -------- | -------- | ------------------------------------------------- |
| `plan`       | `string` | ✅       | Plan identifier (format varies by provider)       |
| `currency`   | `string` | ✅       | ISO 4217 currency code                            |
| `email`      | `string` | ❌       | Customer email address                            |
| `successUrl` | `string` | ❌       | URL to redirect after successful subscription     |
| `cancelUrl`  | `string` | ❌       | URL to redirect if subscription is cancelled      |
| `metadata`   | `object` | ❌       | Additional metadata to attach to the subscription |

**Plan Identifier Formats:**

- **Stripe**: `lookup_key` (e.g., `"pro-monthly"`)
- **Paddle**: Price ID (e.g., `"pri_01h8xce2x86dt3sfhkjqbpde65"`)
- **PayPal**: Plan ID (e.g., `"P-1234567890"`)
- **Lemon Squeezy**: Variant ID (e.g., `"67890"`)
- **Polar**: Product ID (e.g., `"prod_1234567890"`)

**Returns:** `Promise<SubscriptionResult>`

```typescript
interface SubscriptionResult {
  id: string; // Subscription ID from provider
  status: "active" | "paused" | "cancelled" | "past_due";
  plan: string;
  currency: string;
  provider: string;
  email?: string;
  url?: string;
}
```

**Example:**

```typescript
const subscription = await pay.subscribe({
  plan: "pro-monthly",
  currency: "USD",
  email: "customer@example.com",
});
```

#### `pay.cancel(subscriptionId)`

Cancels an active subscription. Remains active until end of billing period.

```typescript
await pay.cancel("sub_1234567890");
```

#### `pay.pause(subscriptionId)`

Pauses an active subscription. Billing is paused.

```typescript
await pay.pause("sub_1234567890");
```

#### `pay.resume(subscriptionId)`

Resumes a paused subscription. Billing resumes immediately.

```typescript
await pay.resume("sub_1234567890");
```

### Billing Portal

#### `pay.portal(input)`

Generates a billing portal URL for customer self-service.

**Parameters:**

| Parameter | Type     | Required | Description            |
| --------- | -------- | -------- | ---------------------- |
| `email`   | `string` | ✅       | Customer email address |

**Returns:** `Promise<string>` - Billing portal URL

**Example:**

```typescript
const portalUrl = await pay.portal({
  email: "customer@example.com",
});

// Redirect user to portalUrl
res.redirect(portalUrl);
```

**What customers can do:**

- Update payment methods
- View billing history
- Cancel subscriptions
- Update billing information
- Download invoices

---

## 🔔 Webhooks

Webhooks allow payment providers to notify your application about payment events in real-time. PayLayer normalizes all webhook events to a consistent format.

### How It Works

The webhook system works in three steps:

1. **Register event handlers** - Define what happens when events occur
2. **Process incoming webhooks** - `webhook.process()` verifies, normalizes, and triggers handlers
3. **Handlers execute** - Your registered callbacks run with the normalized event

### Setup

1. **Register event handlers** before processing webhook requests:

```typescript
import { webhook } from "@paylayer/core";

webhook.onPaymentSuccess((event) => {
  console.log("Payment succeeded:", event);
  // Update database, send confirmation emails, etc.
});

webhook.onPaymentFailed((event) => {
  console.log("Payment failed:", event);
});

webhook.onSubscriptionCreated((event) => {
  console.log("Subscription created:", event);
});

webhook.onSubscriptionCancelled((event) => {
  console.log("Subscription cancelled:", event);
});

webhook.onSubscriptionUpdated((event) => {
  console.log("Subscription updated:", event);
});

webhook.onSubscriptionDeleted((event) => {
  console.log("Subscription deleted:", event);
});

webhook.onSubscriptionPaused((event) => {
  console.log("Subscription paused:", event);
});

webhook.onSubscriptionResumed((event) => {
  console.log("Subscription resumed:", event);
});
```

2. **Create a webhook endpoint** in your application:

```typescript
import express from "express";
import { webhook } from "@paylayer/core";

const app = express();

// Important: Use raw body for webhook signature verification
app.post(
  "/webhooks/paylayer",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const result = await webhook.process(req);
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
```

### Understanding `webhook.process()`

The `webhook.process(request)` method handles the entire webhook processing flow:

**What it does:**

1. **Verifies the signature** - Validates the webhook request is authentic using the provider's signing secret
2. **Normalizes the event** - Converts provider-specific events (e.g., Stripe's `payment_intent.succeeded`) to PayLayer's unified format (e.g., `payment.success`)
3. **Triggers registered handlers** - Automatically calls all handlers registered for that event type
4. **Returns a response** - Provides status and body for your HTTP response

**Return Value:**

```typescript
{
  status: number; // 200 for success, 401 for invalid signature
  body: {
    received: boolean;
  }
}
```

**Example Flow:**

```typescript
// 1. Provider sends webhook to your endpoint
POST /webhooks/paylayer
{
  "type": "payment_intent.succeeded",  // Stripe-specific format
  "data": { ... }
}

// 2. webhook.process() is called
const result = await webhook.process(req);

// 3. Internally, PayLayer:
//    - Verifies signature ✓
//    - Normalizes to: { type: "payment.success", ... }
//    - Finds handlers registered with webhook.onPaymentSuccess()
//    - Executes all registered handlers asynchronously

// 4. Returns response
//    { status: 200, body: { received: true } }
```

**Important Notes:**

- Handlers are executed **asynchronously** - `webhook.process()` doesn't wait for handlers to complete
- Multiple handlers can be registered for the same event type - all will be called
- Handler errors are caught and logged, but don't affect the webhook response
- Invalid signatures return `401` status - handlers are not executed

3. **Configure webhook URL in provider dashboard:**
   - Point to `https://yourdomain.com/webhooks/paylayer`
   - Copy the signing secret to your environment variables

### Event Object

All webhook events are normalized to a consistent format:

```typescript
interface NormalizedEvent {
  type:
    | "payment.success"
    | "payment.failed"
    | "subscription.created"
    | "subscription.updated"
    | "subscription.deleted"
    | "subscription.cancelled"
    | "subscription.paused"
    | "subscription.resumed";
  amount?: number;
  currency?: string;
  email?: string;
  provider: string;
  subscriptionId?: string;
  paymentId?: string;
  customerId?: string;
  customer?: CustomerInfo;
  status?: string;
  description?: string;
  createdAt?: string;
  plan?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
  providerResponse?: unknown;
}
```

**Example Event:**

```typescript
{
  type: "payment.success",
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
  provider: "stripe",
  paymentId: "pi_1234567890",
  metadata: {}
}
```

### Security

- ✅ All webhook signatures are automatically verified
- ✅ Invalid signatures result in a `401` response
- ✅ Constant-time comparison prevents timing attacks
- ✅ Never process webhooks without signature verification

---

## 🏦 Supported Providers

| Provider          | Status | Features                                        |
| ----------------- | ------ | ----------------------------------------------- |
| **Stripe**        | ✅     | Payments, subscriptions, and billing portal     |
| **Paddle**        | ✅     | Merchant of record, subscriptions, and checkout |
| **PayPal**        | ✅     | Payments and subscriptions                      |
| **Lemon Squeezy** | ✅     | Checkout and subscriptions                      |
| **Polar.sh**      | ✅     | Billing infrastructure and subscriptions        |

All providers are fully implemented with proper webhook verification, error handling, and API integration.

---

## 📘 TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { pay } from "@paylayer/core";
import type {
  ChargeResult,
  SubscriptionResult,
  NormalizedEvent,
} from "@paylayer/core";

const result: ChargeResult = await pay.charge({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
});
```

### Currency Enum

The SDK includes a comprehensive `Currency` enum with 150+ currencies for type safety and autocomplete:

```typescript
import { pay, Currency } from "@paylayer/core";

// Type-safe currency with autocomplete
const result = await pay.charge({
  amount: 29.99,
  currency: Currency.USD, // TypeScript autocomplete available
  email: "customer@example.com",
});

// String literals also work
const result2 = await pay.charge({
  amount: 29.99,
  currency: "USD", // Also valid
  email: "customer@example.com",
});
```

**Common Currencies:**

- `Currency.USD`, `Currency.EUR`, `Currency.GBP`, `Currency.JPY`
- `Currency.AUD`, `Currency.CAD`, `Currency.CHF`, `Currency.CNY`
- `Currency.HKD`, `Currency.NZD`, `Currency.SGD`

For a complete list, use your IDE's autocomplete or refer to the TypeScript definitions.

---

## 🔒 Security

- ✅ **Webhook Signature Verification** - All webhook signatures verified using provider-specific methods
- ✅ **Timing Attack Prevention** - Constant-time comparison for signature verification
- ✅ **No Sensitive Data Logging** - No API keys or payment details logged
- ✅ **Environment Variable Security** - All credentials via environment variables (never hardcode)
- ✅ **Production Safety** - Defaults to production mode (explicitly set sandbox for testing)

**Best Practices:**

- Never commit `.env` files to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Monitor webhook endpoints for suspicious activity
- Use HTTPS for all webhook endpoints

---

## ⚠️ Error Handling

The SDK provides clear, actionable error messages:

### Missing Environment Variables

```typescript
// Error: "STRIPE_SECRET_KEY environment variable is required for Stripe provider"
// Solution: Add STRIPE_SECRET_KEY to your .env file
```

### Missing Required Parameters

```typescript
// Error: "amount is required"
// Solution: Provide the amount parameter in your charge() call
```

### Invalid API Responses

```typescript
// Error: "Stripe API error: 400 - { message: 'Invalid request' }"
// Solution: Check your request parameters and API key validity
```

### Webhook Signature Verification Failures

```typescript
// Returns 401 status if signature verification fails
// Solution: Verify your webhook secret matches the one in your provider dashboard
```

All errors include context:

- Which provider caused the error
- What operation was being performed
- The original error message from the provider

---

## 📄 License

MIT

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

<div align="center">

**Made with ❤️ by PayLayer**

</div>
