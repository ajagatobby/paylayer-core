<div align="center">

# 💳 @paylayer/core

**Build billing once. Switch providers anytime.**

[![npm version](https://img.shields.io/npm/v/@paylayer/core.svg?style=flat-square)](https://www.npmjs.com/package/@paylayer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

A production-grade, provider-agnostic payments SDK for Node.js that provides a unified API for one-time payments, subscriptions, and webhooks across multiple payment providers.

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [API Reference](#-api-reference) • [Providers](#-supported-providers)

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
  - [Environment Setup](#environment-setup)
  - [One-Time Payment](#one-time-payment)
  - [Subscription](#subscription)
  - [Billing Portal](#billing-portal)
  - [Webhooks](#webhooks)
- [API Reference](#-api-reference)
- [Event Object Shape](#-event-object-shape)
- [Supported Providers](#-supported-providers)
- [Provider Configuration](#-provider-configuration)
- [Environment Variables](#-environment-variables)
- [TypeScript](#-typescript)
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

### Environment Setup

Set your payment provider in environment variables:

```bash
export PAYLAYER_PROVIDER=stripe  # or 'paddle', 'paypal', 'lemonsqueezy', 'polar'
```

### One-Time Payment

```typescript
import { pay } from "@paylayer/core";

// Charge a customer
const result = await pay.charge({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
});

console.log("Payment ID:", result.id);
console.log("Status:", result.status);
```

### Subscription

```typescript
import { pay } from "@paylayer/core";

// Create a subscription
const subscription = await pay.subscribe({
  plan: "pro-monthly",
  currency: "USD",
  email: "customer@example.com",
});

console.log("Subscription ID:", subscription.id);

// Pause a subscription
await pay.pause(subscription.id);

// Resume a subscription
await pay.resume(subscription.id);

// Cancel a subscription
await pay.cancel(subscription.id);
```

### Billing Portal

```typescript
import { pay } from "@paylayer/core";

// Generate billing portal URL
const portalUrl = await pay.portal({
  email: "customer@example.com",
});

// Redirect user to portalUrl
```

### Webhooks

```typescript
import { pay } from "@paylayer/core";

// Register event handlers
pay.onPaymentSuccess((event) => {
  console.log("Payment succeeded:", event);
  // Update your database, send emails, etc.
});

pay.onPaymentFailed((event) => {
  console.log("Payment failed:", event);
});

pay.onSubscriptionCreated((event) => {
  console.log("Subscription created:", event);
});

pay.onSubscriptionCancelled((event) => {
  console.log("Subscription cancelled:", event);
});

// Handle webhook requests (Express.js example)
import express from "express";

const app = express();
app.use(express.json());

app.post("/webhooks/paylayer", async (req, res) => {
  const result = await pay.webhook(req);
  res.status(result.status).json(result.body);
});
```

---

## 📚 API Reference

### `pay.charge(input)`

Creates a one-time payment charge.

**Parameters:**

| Parameter  | Type     | Required | Description                                 |
| ---------- | -------- | -------- | ------------------------------------------- |
| `amount`   | `number` | ✅       | Payment amount                              |
| `currency` | `string` | ✅       | ISO 4217 currency code (e.g., 'USD', 'EUR') |
| `email`    | `string` | ❌       | Customer email                              |

**Returns:** `Promise<ChargeResult>`

---

### `pay.subscribe(input)`

Creates a subscription.

**Parameters:**

| Parameter  | Type     | Required | Description                                                                                                                                  |
| ---------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`     | `string` | ✅       | Subscription plan identifier (provider-specific: Stripe lookup_key, Paddle/Lemon Squeezy price/variant ID, PayPal plan ID, Polar product ID) |
| `currency` | `string` | ✅       | ISO 4217 currency code                                                                                                                       |
| `email`    | `string` | ❌       | Customer email (required for some providers)                                                                                                 |

**Returns:** `Promise<SubscriptionResult>`

---

### `pay.cancel(subscriptionId)`

Cancels a subscription.

**Parameters:**

| Parameter        | Type     | Required | Description     |
| ---------------- | -------- | -------- | --------------- |
| `subscriptionId` | `string` | ✅       | Subscription ID |

**Returns:** `Promise<SubscriptionResult>`

---

### `pay.pause(subscriptionId)`

Pauses a subscription.

**Parameters:**

| Parameter        | Type     | Required | Description     |
| ---------------- | -------- | -------- | --------------- |
| `subscriptionId` | `string` | ✅       | Subscription ID |

**Returns:** `Promise<SubscriptionResult>`

---

### `pay.resume(subscriptionId)`

Resumes a paused subscription.

**Parameters:**

| Parameter        | Type     | Required | Description     |
| ---------------- | -------- | -------- | --------------- |
| `subscriptionId` | `string` | ✅       | Subscription ID |

**Returns:** `Promise<SubscriptionResult>`

---

### `pay.portal(input)`

Generates a billing portal URL for customer self-service.

**Parameters:**

| Parameter | Type     | Required | Description    |
| --------- | -------- | -------- | -------------- |
| `email`   | `string` | ✅       | Customer email |

**Returns:** `Promise<string>` - Billing portal URL

---

### Webhook Handlers

#### `pay.onPaymentSuccess(handler)`

Registers a handler for payment success events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

---

#### `pay.onPaymentFailed(handler)`

Registers a handler for payment failure events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

---

#### `pay.onSubscriptionCreated(handler)`

Registers a handler for subscription creation events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

---

#### `pay.onSubscriptionCancelled(handler)`

Registers a handler for subscription cancellation events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

---

### `pay.webhook(req)`

Processes a webhook request from a payment provider. Automatically verifies webhook signatures using provider-specific verification methods.

**Parameters:**

| Parameter | Type      | Required | Description                                                            |
| --------- | --------- | -------- | ---------------------------------------------------------------------- |
| `req`     | `Request` | ✅       | Webhook request object (Express Request, Fetch Request, or compatible) |

**Returns:** `Promise<{ status: number; body: { received: boolean } }>`

> **Note:** Always returns `200` if webhook is accepted and signature is valid. Returns `401` if signature verification fails.

---

## 📨 Event Object Shape

All webhook events are normalized to a consistent shape:

```typescript
interface NormalizedEvent {
  type:
    | "payment.success"
    | "payment.failed"
    | "subscription.created"
    | "subscription.cancelled"
    | "subscription.paused"
    | "subscription.resumed";
  amount?: number;
  currency?: string;
  email?: string;
  provider: string;
  subscriptionId?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}
```

---

## 🏦 Supported Providers

The SDK provides production-ready implementations for:

| Provider          | Status | Features                                        |
| ----------------- | ------ | ----------------------------------------------- |
| **Stripe**        | ✅     | Payments, subscriptions, and billing portal     |
| **Paddle**        | ✅     | Merchant of record, subscriptions, and checkout |
| **PayPal**        | ✅     | Payments and subscriptions                      |
| **Lemon Squeezy** | ✅     | Checkout and subscriptions                      |
| **Polar.sh**      | ✅     | Billing infrastructure and subscriptions        |

All providers are fully implemented with proper webhook verification, error handling, and API integration.

---

## ⚙️ Provider Configuration

### 🔵 Stripe

**Required Environment Variables:**

- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (for webhook verification)

**Optional Environment Variables:**

- `STRIPE_PORTAL_RETURN_URL` - Return URL for billing portal (defaults to 'https://app.example.com')

> **Note:** Stripe automatically detects test vs production mode from the API key prefix (`sk_test_` vs `sk_live_`). The `PAYLAYER_ENVIRONMENT` variable can be used to validate that the environment mode matches the API key type (warnings will be shown if there's a mismatch).

**Setup:**

1. Create prices in Stripe dashboard with `lookup_key` set to your plan identifiers
2. Use the `lookup_key` as the `plan` parameter in `pay.subscribe()`

---

### 🟢 Paddle

**Required Environment Variables:**

- `PADDLE_API_KEY` - Your Paddle API key
- `PADDLE_WEBHOOK_SECRET` - Webhook signing secret
- `PADDLE_DEFAULT_PRICE_ID` - Default price ID for one-time charges

**Optional Environment Variables:**

- `PADDLE_BASE_URL` - API base URL (defaults to production)
- `PADDLE_SANDBOX` - Set to "true" for sandbox environment (deprecated: use `PAYLAYER_ENVIRONMENT=sandbox` instead)
- `PADDLE_PORTAL_BASE_URL` - Customer portal base URL

> **Note:** The `PAYLAYER_ENVIRONMENT` variable can be used instead of `PADDLE_SANDBOX` to control sandbox mode for all providers at once.

**Setup:**

1. Create prices in Paddle dashboard
2. Use price IDs as the `plan` parameter in `pay.subscribe()`

---

### 🟡 PayPal

**Required Environment Variables:**

- `PAYPAL_CLIENT_ID` - Your PayPal client ID
- `PAYPAL_CLIENT_SECRET` - Your PayPal client secret
- `PAYPAL_WEBHOOK_SECRET` - Webhook signing secret

**Optional Environment Variables:**

- `PAYPAL_BASE_URL` - API base URL (defaults to production)
- `PAYPAL_SANDBOX` - Set to "true" for sandbox environment (deprecated: use `PAYLAYER_ENVIRONMENT=sandbox` instead)
- `PAYPAL_BRAND_NAME` - Brand name for checkout
- `PAYPAL_RETURN_URL` - Return URL after payment
- `PAYPAL_CANCEL_URL` - Cancel URL
- `PAYPAL_PORTAL_BASE_URL` - Customer portal base URL

> **Note:** The `PAYLAYER_ENVIRONMENT` variable can be used instead of `PAYPAL_SANDBOX` to control sandbox mode for all providers at once.

**Setup:**

1. Create billing plans in PayPal dashboard
2. Use plan IDs as the `plan` parameter in `pay.subscribe()`

---

### 🟣 Lemon Squeezy

**Required Environment Variables:**

- `LEMONSQUEEZY_API_KEY` - Your Lemon Squeezy API key
- `LEMONSQUEEZY_WEBHOOK_SECRET` - Webhook signing secret
- `LEMONSQUEEZY_STORE_ID` - Your store ID
- `LEMONSQUEEZY_DEFAULT_VARIANT_ID` - Default variant ID for one-time charges

**Optional Environment Variables:**

- `LEMONSQUEEZY_BASE_URL` - API base URL (defaults to production)
- `LEMONSQUEEZY_TEST_MODE` - Set to "true" for test mode (deprecated: use `PAYLAYER_ENVIRONMENT=sandbox` instead)
- `LEMONSQUEEZY_PORTAL_BASE_URL` - Customer portal base URL

> **Note:** The `PAYLAYER_ENVIRONMENT` variable can be used instead of `LEMONSQUEEZY_TEST_MODE` to control test mode for all providers at once.

**Setup:**

1. Create products and variants in Lemon Squeezy dashboard
2. Use variant IDs as the `plan` parameter in `pay.subscribe()`

---

### 🟠 Polar.sh

**Required Environment Variables:**

- `POLAR_OAT` or `POLAR_ACCESS_TOKEN` - Your Polar Organization Access Token (OAT)
- `POLAR_WEBHOOK_SECRET` - Webhook signing secret (may be base64 encoded)
- `POLAR_DEFAULT_PRODUCT_ID` - Default product ID for one-time charges

**Optional Environment Variables:**

- `POLAR_BASE_URL` - API base URL (defaults to `https://api.polar.sh/v1`)
- `POLAR_SANDBOX` - Set to `"true"` to use sandbox environment (`https://sandbox-api.polar.sh/v1`) (deprecated: use `PAYLAYER_ENVIRONMENT=sandbox` instead)
- `POLAR_SUCCESS_URL` - Success URL after payment (defaults to `https://app.example.com/success`)

> **Note:** The `PAYLAYER_ENVIRONMENT` variable can be used instead of `POLAR_SANDBOX` to control sandbox mode for all providers at once.

**Setup:**

1. Create an Organization Access Token (OAT) in your Polar dashboard
2. Create products with subscription prices in Polar dashboard
3. Use the product ID as the `plan` parameter in `pay.subscribe()`
4. For one-time charges, set `POLAR_DEFAULT_PRODUCT_ID` to a product ID
5. Configure webhook endpoint in Polar dashboard and set `POLAR_WEBHOOK_SECRET`

---

## 🔐 Environment Variables

### Core Configuration

| Variable               | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYLAYER_PROVIDER`    | ✅       | Payment provider identifier: `'stripe'`, `'paddle'`, `'paypal'`, `'lemonsqueezy'`, `'polar'`, or `'mock'`                                                                                                                                                                                                                                                                                                                                                               |
| `PAYLAYER_ENVIRONMENT` | ❌       | Unified environment mode for all providers. Accepts: `"sandbox"`, `"test"`, `"production"`, or `"live"` (case-insensitive). Defaults to `"production"` if not set. This variable applies to all providers and replaces provider-specific sandbox/test mode variables. For backward compatibility, provider-specific variables (`PADDLE_SANDBOX`, `PAYPAL_SANDBOX`, `LEMONSQUEEZY_TEST_MODE`, `POLAR_SANDBOX`) are still supported if `PAYLAYER_ENVIRONMENT` is not set. |

### Provider-Specific

See [Provider Configuration](#-provider-configuration) section above for provider-specific environment variables.

---

## 📘 TypeScript

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { pay } from "@paylayer/core";
import type {
  ChargeResult,
  SubscriptionResult,
  NormalizedEvent,
} from "@paylayer/core";
```

---

## 🔒 Security

- ✅ All webhook signatures are verified using provider-specific methods (HMAC SHA256 for most providers)
- ✅ Constant-time comparison is used for signature verification to prevent timing attacks
- ✅ No sensitive data is logged or exposed
- ✅ All API keys must be provided via environment variables

---

## ⚠️ Error Handling

The SDK provides clear error messages for:

- Missing required environment variables
- Missing required parameters
- Invalid API responses
- Webhook signature verification failures
- Provider-specific errors

All errors include context to help with debugging.

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
