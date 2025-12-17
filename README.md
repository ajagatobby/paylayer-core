<div align="center">

# 💳 @paylayer/core

**Build billing once. Switch providers anytime.**

[![npm version](https://img.shields.io/npm/v/@paylayer/core.svg?style=flat-square)](https://www.npmjs.com/package/@paylayer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

A production-grade, provider-agnostic payments SDK for Node.js that provides a unified API for one-time payments, subscriptions, and webhooks across multiple payment providers.

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Configuration](#-configuration) • [API Reference](#-api-reference) • [Providers](#-supported-providers)

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
  - [Step 1: Install the Package](#step-1-install-the-package)
  - [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
  - [Step 3: Use the SDK](#step-3-use-the-sdk)
- [Configuration](#-configuration)
  - [Core Configuration](#core-configuration)
  - [Provider-Specific Configuration](#provider-specific-configuration)
  - [Environment Variable Examples](#environment-variable-examples)
- [API Reference](#-api-reference)
  - [One-Time Payments](#one-time-payments)
  - [Subscriptions](#subscriptions)
  - [Billing Portal](#billing-portal)
  - [Webhooks](#webhooks)
- [Event Object Shape](#-event-object-shape)
- [Supported Providers](#-supported-providers)
- [Provider Setup Guides](#-provider-setup-guides)
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

### Step 1: Install the Package

```bash
npm install @paylayer/core
```

### Step 2: Configure Environment Variables

Create a `.env` file in your project root (or configure your environment variables):

```bash
# Choose your payment provider
PAYLAYER_PROVIDER=stripe

# Set environment mode (optional, defaults to "production")
PAYLAYER_ENVIRONMENT=production  # or "sandbox" for testing

# Provider-specific credentials (see Configuration section below)
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET_HERE
```

> **💡 Tip:** See the [Configuration](#-configuration) section for complete setup instructions for each provider.

### Step 3: Use the SDK

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

---

## ⚙️ Configuration

### Core Configuration

Every PayLayer setup requires two core environment variables:

#### `PAYLAYER_PROVIDER` (Required)

**Purpose:** Specifies which payment provider to use.

**Valid Values:**

- `stripe` - Stripe payments
- `paddle` - Paddle merchant of record
- `paypal` - PayPal payments
- `lemonsqueezy` - Lemon Squeezy checkout
- `polar` - Polar.sh billing infrastructure
- `mock` - Mock provider for testing (no real payments)

**Example:**

```bash
PAYLAYER_PROVIDER=stripe
```

#### `PAYLAYER_ENVIRONMENT` (Optional)

**Purpose:** Unified environment mode that applies to all providers. Controls whether the SDK operates in test/sandbox mode or production mode.

**Valid Values:**

- `sandbox` or `test` - Test/sandbox environment (no real charges)
- `production` or `live` - Production environment (real charges)

**Default:** `production` (if not set)

**How it works:**

- When set to `sandbox` or `test`, all providers use their test/sandbox APIs
- When set to `production` or `live`, all providers use their production APIs
- Stripe automatically detects mode from API key prefix (`sk_test_` vs `sk_live_`), but this variable validates consistency
- For backward compatibility, provider-specific variables (`PADDLE_SANDBOX`, `PAYPAL_SANDBOX`, etc.) are still supported if `PAYLAYER_ENVIRONMENT` is not set

**Example:**

```bash
# For testing/development
PAYLAYER_ENVIRONMENT=sandbox

# For production
PAYLAYER_ENVIRONMENT=production
```

---

### Provider-Specific Configuration

Each payment provider requires specific credentials and configuration. Choose your provider below:

#### 🔵 Stripe

**Required Variables:**

| Variable                | Description                                       | Where to Find                                                                             |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Your Stripe secret API key                        | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → API Keys → Secret key          |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret for signature verification | [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → Add endpoint → Signing secret |

**Optional Variables:**

| Variable                   | Description                                           | Default                   |
| -------------------------- | ----------------------------------------------------- | ------------------------- |
| `STRIPE_PORTAL_RETURN_URL` | URL where customers return after using billing portal | `https://app.example.com` |

**Important Notes:**

- Stripe automatically detects test vs production mode from the API key prefix:
  - Test keys start with `sk_test_`
  - Live keys start with `sk_live_`
- The `PAYLAYER_ENVIRONMENT` variable validates that your environment mode matches your API key type
- You'll get warnings if there's a mismatch (e.g., `PAYLAYER_ENVIRONMENT=production` with a `sk_test_` key)

**Setup Steps:**

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
3. Create prices in your Stripe dashboard and set a `lookup_key` for each plan
4. Use the `lookup_key` as the `plan` parameter in `pay.subscribe()`
5. Set up webhooks in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks) and copy the signing secret

---

#### 🟢 Paddle

**Required Variables:**

| Variable                  | Description                           | Where to Find                                                                                                 |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `PADDLE_API_KEY`          | Your Paddle API key                   | [Paddle Dashboard](https://vendors.paddle.com/) → Developer Tools → Authentication → API Keys                 |
| `PADDLE_WEBHOOK_SECRET`   | Webhook signing secret                | [Paddle Dashboard](https://vendors.paddle.com/) → Developer Tools → Notifications → Webhooks → Signing Secret |
| `PADDLE_DEFAULT_PRICE_ID` | Default price ID for one-time charges | [Paddle Dashboard](https://vendors.paddle.com/) → Catalog → Prices → Copy Price ID                            |

**Optional Variables:**

| Variable                 | Description                              | Default                                       |
| ------------------------ | ---------------------------------------- | --------------------------------------------- |
| `PADDLE_BASE_URL`        | API base URL (usually not needed)        | Auto-detected based on `PAYLAYER_ENVIRONMENT` |
| `PADDLE_SANDBOX`         | Set to `"true"` for sandbox (deprecated) | Use `PAYLAYER_ENVIRONMENT=sandbox` instead    |
| `PADDLE_PORTAL_BASE_URL` | Customer portal base URL                 | Auto-configured                               |

**Setup Steps:**

1. Create a Paddle account at [paddle.com](https://paddle.com)
2. Get your API key from the [Paddle Dashboard](https://vendors.paddle.com/)
3. Create prices in your Paddle dashboard
4. Use price IDs as the `plan` parameter in `pay.subscribe()`
5. Set up webhooks and copy the signing secret

---

#### 🟡 PayPal

**Required Variables:**

| Variable                | Description                           | Where to Find                                                                                                             |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PAYPAL_CLIENT_ID`      | Your PayPal application client ID     | [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) → My Apps & Credentials → App → Client ID           |
| `PAYPAL_CLIENT_SECRET`  | Your PayPal application client secret | [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) → My Apps & Credentials → App → Secret              |
| `PAYPAL_WEBHOOK_SECRET` | Webhook signing secret                | [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) → My Apps & Credentials → Webhooks → Signing Secret |

**Optional Variables:**

| Variable                 | Description                              | Default                                       |
| ------------------------ | ---------------------------------------- | --------------------------------------------- |
| `PAYPAL_BASE_URL`        | API base URL (usually not needed)        | Auto-detected based on `PAYLAYER_ENVIRONMENT` |
| `PAYPAL_SANDBOX`         | Set to `"true"` for sandbox (deprecated) | Use `PAYLAYER_ENVIRONMENT=sandbox` instead    |
| `PAYPAL_BRAND_NAME`      | Brand name shown in PayPal checkout      | Your app name                                 |
| `PAYPAL_RETURN_URL`      | URL where customers return after payment | Required for `charge()` method                |
| `PAYPAL_CANCEL_URL`      | URL where customers go if they cancel    | Required for `charge()` method                |
| `PAYPAL_PORTAL_BASE_URL` | Customer portal base URL                 | Auto-configured                               |

**Setup Steps:**

1. Create a PayPal Developer account at [developer.paypal.com](https://developer.paypal.com)
2. Create an app in the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
3. Copy your Client ID and Secret
4. Create billing plans in PayPal dashboard
5. Use plan IDs as the `plan` parameter in `pay.subscribe()`
6. Set up webhooks and copy the signing secret

---

#### 🟣 Lemon Squeezy

**Required Variables:**

| Variable                          | Description                             | Where to Find                                                                                          |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `LEMONSQUEEZY_API_KEY`            | Your Lemon Squeezy API key              | [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/settings/api) → API Keys → Create API Key       |
| `LEMONSQUEEZY_WEBHOOK_SECRET`     | Webhook signing secret                  | [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/settings/webhooks) → Webhook → Signing Secret   |
| `LEMONSQUEEZY_STORE_ID`           | Your store ID                           | [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/stores) → Store → Copy Store ID                 |
| `LEMONSQUEEZY_DEFAULT_VARIANT_ID` | Default variant ID for one-time charges | [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/products) → Product → Variant → Copy Variant ID |

**Optional Variables:**

| Variable                       | Description                                | Default                                    |
| ------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `LEMONSQUEEZY_BASE_URL`        | API base URL (usually not needed)          | `https://api.lemonsqueezy.com`             |
| `LEMONSQUEEZY_TEST_MODE`       | Set to `"true"` for test mode (deprecated) | Use `PAYLAYER_ENVIRONMENT=sandbox` instead |
| `LEMONSQUEEZY_PORTAL_BASE_URL` | Customer portal base URL                   | Auto-configured                            |

**Setup Steps:**

1. Create a Lemon Squeezy account at [lemonsqueezy.com](https://lemonsqueezy.com)
2. Create a store in your dashboard
3. Create products and variants in your dashboard
4. Get your API key from settings
5. Use variant IDs as the `plan` parameter in `pay.subscribe()`
6. Set up webhooks and copy the signing secret

---

#### 🟠 Polar.sh

**Required Variables:**

| Variable                            | Description                                    | Where to Find                                                                         |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POLAR_OAT` or `POLAR_ACCESS_TOKEN` | Your Polar Organization Access Token (OAT)     | [Polar Dashboard](https://polar.sh/dashboard) → Settings → Access Tokens → Create OAT |
| `POLAR_WEBHOOK_SECRET`              | Webhook signing secret (may be base64 encoded) | [Polar Dashboard](https://polar.sh/dashboard) → Settings → Webhooks → Signing Secret  |

**Optional Variables:**

| Variable            | Description                              | Default                                       |
| ------------------- | ---------------------------------------- | --------------------------------------------- |
| `POLAR_BASE_URL`    | API base URL (usually not needed)        | Auto-detected based on `PAYLAYER_ENVIRONMENT` |
| `POLAR_SANDBOX`     | Set to `"true"` for sandbox (deprecated) | Use `PAYLAYER_ENVIRONMENT=sandbox` instead    |
| `POLAR_SUCCESS_URL` | Success URL after payment                | `https://app.example.com/success`             |

**Setup Steps:**

1. Create a Polar account at [polar.sh](https://polar.sh)
2. Create an Organization Access Token (OAT) in your dashboard
3. Create products with subscription prices in your dashboard
4. Use the product ID as the `plan` parameter in `pay.subscribe()`
5. For one-time charges, provide the `productId` in the `charge()` call
6. Configure webhook endpoint in Polar dashboard and copy the signing secret

---

### Environment Variable Examples

Here are complete `.env` file examples for each provider:

#### Stripe Example

```bash
# Core configuration
PAYLAYER_PROVIDER=stripe
PAYLAYER_ENVIRONMENT=production

# Stripe credentials
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET_HERE

# Optional: Billing portal return URL
STRIPE_PORTAL_RETURN_URL=https://myapp.com/settings/billing
```

#### Paddle Example

```bash
# Core configuration
PAYLAYER_PROVIDER=paddle
PAYLAYER_ENVIRONMENT=sandbox

# Paddle credentials
PADDLE_API_KEY=YOUR_PADDLE_API_KEY_HERE
PADDLE_WEBHOOK_SECRET=YOUR_PADDLE_WEBHOOK_SECRET_HERE
PADDLE_DEFAULT_PRICE_ID=pri_YOUR_PRICE_ID_HERE
```

#### PayPal Example

```bash
# Core configuration
PAYLAYER_PROVIDER=paypal
PAYLAYER_ENVIRONMENT=sandbox

# PayPal credentials
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID_HERE
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_CLIENT_SECRET_HERE
PAYPAL_WEBHOOK_SECRET=YOUR_PAYPAL_WEBHOOK_SECRET_HERE

# Optional: Checkout URLs
PAYPAL_RETURN_URL=https://myapp.com/payment/success
PAYPAL_CANCEL_URL=https://myapp.com/payment/cancel
PAYPAL_BRAND_NAME=My Awesome App
```

#### Lemon Squeezy Example

```bash
# Core configuration
PAYLAYER_PROVIDER=lemonsqueezy
PAYLAYER_ENVIRONMENT=production

# Lemon Squeezy credentials
LEMONSQUEEZY_API_KEY=YOUR_LEMONSQUEEZY_API_KEY_HERE
LEMONSQUEEZY_WEBHOOK_SECRET=YOUR_LEMONSQUEEZY_WEBHOOK_SECRET_HERE
LEMONSQUEEZY_STORE_ID=YOUR_STORE_ID_HERE
LEMONSQUEEZY_DEFAULT_VARIANT_ID=YOUR_VARIANT_ID_HERE
```

#### Polar.sh Example

```bash
# Core configuration
PAYLAYER_PROVIDER=polar
PAYLAYER_ENVIRONMENT=production

# Polar credentials
POLAR_OAT=YOUR_POLAR_OAT_HERE
POLAR_WEBHOOK_SECRET=YOUR_POLAR_WEBHOOK_SECRET_HERE

# Optional: Success URL
POLAR_SUCCESS_URL=https://myapp.com/payment/success
```

---

## 📚 API Reference

### One-Time Payments

#### `pay.charge(input)`

Creates a one-time payment charge. The customer will be redirected to the provider's checkout page to complete payment.

**Parameters:**

| Parameter  | Type     | Required | Description                                     |
| ---------- | -------- | -------- | ----------------------------------------------- |
| `amount`   | `number` | ✅       | Payment amount (e.g., `29.99` for $29.99)       |
| `currency` | `string` | ✅       | ISO 4217 currency code (e.g., `'USD'`, `'EUR'`) |
| `email`    | `string` | ❌       | Customer email address                          |

**Returns:** `Promise<ChargeResult>`

**Example:**

```typescript
import { pay } from "@paylayer/core";

const result = await pay.charge({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
});

console.log("Payment ID:", result.id);
console.log("Status:", result.status); // "pending" | "succeeded" | "failed"
console.log("Amount:", result.amount);
console.log("Currency:", result.currency);
```

**Return Type:**

```typescript
interface ChargeResult {
  id: string; // Payment ID from provider
  status: "pending" | "succeeded" | "failed";
  amount: number; // Payment amount
  currency: string; // ISO 4217 currency code
  provider: string; // Provider name (e.g., "stripe")
  email?: string; // Customer email if provided
}
```

---

### Subscriptions

#### `pay.subscribe(input)`

Creates a new subscription for a customer. The customer will be redirected to complete the subscription setup.

**Parameters:**

| Parameter  | Type     | Required | Description                                                                                                                                                                                                                                                                                                                                       |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`     | `string` | ✅       | Subscription plan identifier. Format varies by provider:<br>- **Stripe**: `lookup_key` (e.g., `"pro-monthly"`)<br>- **Paddle**: Price ID (e.g., `"pri_01h8xce2x86dt3sfhkjqbpde65"`)<br>- **PayPal**: Plan ID (e.g., `"P-1234567890"`)<br>- **Lemon Squeezy**: Variant ID (e.g., `"67890"`)<br>- **Polar**: Product ID (e.g., `"prod_1234567890"`) |
| `currency` | `string` | ✅       | ISO 4217 currency code (e.g., `'USD'`, `'EUR'`)                                                                                                                                                                                                                                                                                                   |
| `email`    | `string` | ❌       | Customer email address (required for some providers)                                                                                                                                                                                                                                                                                              |

**Returns:** `Promise<SubscriptionResult>`

**Example:**

```typescript
import { pay } from "@paylayer/core";

// Create a subscription
const subscription = await pay.subscribe({
  plan: "pro-monthly", // Provider-specific plan identifier
  currency: "USD",
  email: "customer@example.com",
});

console.log("Subscription ID:", subscription.id);
console.log("Status:", subscription.status); // "active" | "paused" | "cancelled" | "past_due"
```

**Return Type:**

```typescript
interface SubscriptionResult {
  id: string; // Subscription ID from provider
  status: "active" | "paused" | "cancelled" | "past_due";
  plan: string; // Plan identifier used
  currency: string; // ISO 4217 currency code
  provider: string; // Provider name
  email?: string; // Customer email if provided
}
```

#### `pay.cancel(subscriptionId)`

Cancels an active subscription. The subscription will remain active until the end of the current billing period.

**Parameters:**

| Parameter        | Type     | Required | Description                   |
| ---------------- | -------- | -------- | ----------------------------- |
| `subscriptionId` | `string` | ✅       | Subscription ID from provider |

**Returns:** `Promise<SubscriptionResult>`

**Example:**

```typescript
await pay.cancel("sub_1234567890");
```

#### `pay.pause(subscriptionId)`

Pauses an active subscription. Billing is paused, but the subscription remains in your system.

**Parameters:**

| Parameter        | Type     | Required | Description                   |
| ---------------- | -------- | -------- | ----------------------------- |
| `subscriptionId` | `string` | ✅       | Subscription ID from provider |

**Returns:** `Promise<SubscriptionResult>`

**Example:**

```typescript
await pay.pause("sub_1234567890");
```

#### `pay.resume(subscriptionId)`

Resumes a paused subscription. Billing will resume immediately.

**Parameters:**

| Parameter        | Type     | Required | Description                   |
| ---------------- | -------- | -------- | ----------------------------- |
| `subscriptionId` | `string` | ✅       | Subscription ID from provider |

**Returns:** `Promise<SubscriptionResult>`

**Example:**

```typescript
await pay.resume("sub_1234567890");
```

---

### Billing Portal

#### `pay.portal(input)`

Generates a billing portal URL where customers can manage their subscriptions, update payment methods, and view billing history. This is a self-service portal provided by the payment provider.

**Parameters:**

| Parameter | Type     | Required | Description            |
| --------- | -------- | -------- | ---------------------- |
| `email`   | `string` | ✅       | Customer email address |

**Returns:** `Promise<string>` - Billing portal URL

**Example:**

```typescript
import { pay } from "@paylayer/core";

// Generate billing portal URL
const portalUrl = await pay.portal({
  email: "customer@example.com",
});

// Redirect user to the portal
// In Express.js:
res.redirect(portalUrl);

// In Next.js:
import { redirect } from "next/navigation";
redirect(portalUrl);
```

**What customers can do in the portal:**

- Update payment methods
- View billing history
- Cancel subscriptions
- Update billing information
- Download invoices

---

### Webhooks

Webhooks allow payment providers to notify your application about payment events in real-time. PayLayer normalizes all webhook events to a consistent format, so you can handle events the same way regardless of provider.

#### Setting Up Webhooks

1. **Register event handlers** before processing webhook requests:

```typescript
import { pay } from "@paylayer/core";

// Handle successful payments
pay.onPaymentSuccess((event) => {
  console.log("Payment succeeded:", event);
  // Update your database, send confirmation emails, etc.
  // event contains: type, amount, currency, email, provider, paymentId, etc.
});

// Handle failed payments
pay.onPaymentFailed((event) => {
  console.log("Payment failed:", event);
  // Notify customer, log for review, etc.
});

// Handle subscription creation
pay.onSubscriptionCreated((event) => {
  console.log("Subscription created:", event);
  // Activate user's premium features, send welcome email, etc.
});

// Handle subscription cancellation
pay.onSubscriptionCancelled((event) => {
  console.log("Subscription cancelled:", event);
  // Deactivate premium features, send cancellation email, etc.
});
```

2. **Create a webhook endpoint** in your application:

```typescript
// Express.js example
import express from "express";
import { pay } from "@paylayer/core";

const app = express();
app.use(express.json());

app.post("/webhooks/paylayer", async (req, res) => {
  try {
    // Process webhook and verify signature
    const result = await pay.webhook(req);

    // Return appropriate status
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

3. **Configure webhook URL in provider dashboard:**
   - **Stripe**: [Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → Add endpoint → `https://yourdomain.com/webhooks/paylayer`
   - **Paddle**: [Dashboard → Notifications](https://vendors.paddle.com/) → Webhooks → Add endpoint
   - **PayPal**: [Developer Dashboard](https://developer.paypal.com/dashboard/) → Webhooks → Add webhook
   - **Lemon Squeezy**: [Dashboard → Webhooks](https://app.lemonsqueezy.com/settings/webhooks) → Add webhook
   - **Polar**: [Dashboard → Settings → Webhooks](https://polar.sh/dashboard) → Add webhook

#### Webhook Handlers

##### `pay.onPaymentSuccess(handler)`

Registers a handler for successful payment events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

**Example:**

```typescript
pay.onPaymentSuccess(async (event) => {
  await updateDatabase({
    paymentId: event.paymentId,
    amount: event.amount,
    status: "succeeded",
  });
  await sendConfirmationEmail(event.email);
});
```

##### `pay.onPaymentFailed(handler)`

Registers a handler for failed payment events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

##### `pay.onSubscriptionCreated(handler)`

Registers a handler for subscription creation events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

##### `pay.onSubscriptionCancelled(handler)`

Registers a handler for subscription cancellation events.

**Parameters:**

| Parameter | Type       | Required | Description                                         |
| --------- | ---------- | -------- | --------------------------------------------------- |
| `handler` | `function` | ✅       | `(event: NormalizedEvent) => void \| Promise<void>` |

#### `pay.webhook(req)`

Processes a webhook request from a payment provider. This method:

- Verifies the webhook signature using provider-specific methods
- Parses the webhook payload
- Triggers the appropriate event handlers
- Returns a response indicating success or failure

**Parameters:**

| Parameter | Type      | Required | Description                                                            |
| --------- | --------- | -------- | ---------------------------------------------------------------------- |
| `req`     | `Request` | ✅       | Webhook request object (Express Request, Fetch Request, or compatible) |

**Returns:** `Promise<{ status: number; body: { received: boolean } }>`

**Status Codes:**

- `200` - Webhook processed successfully and signature verified
- `401` - Signature verification failed (webhook rejected)

**Example:**

```typescript
app.post("/webhooks/paylayer", async (req, res) => {
  const result = await pay.webhook(req);
  res.status(result.status).json(result.body);
});
```

**Security Notes:**

- All webhook signatures are automatically verified
- Invalid signatures result in a `401` response
- Constant-time comparison is used to prevent timing attacks
- Never process webhooks without signature verification

---

## 📨 Event Object Shape

All webhook events are normalized to a consistent shape, regardless of provider:

```typescript
interface NormalizedEvent {
  type:
    | "payment.success" // Payment completed successfully
    | "payment.failed" // Payment failed or was declined
    | "subscription.created" // New subscription created
    | "subscription.cancelled" // Subscription cancelled
    | "subscription.paused" // Subscription paused
    | "subscription.resumed"; // Subscription resumed from pause
  amount?: number; // Payment amount (if applicable)
  currency?: string; // ISO 4217 currency code (if applicable)
  email?: string; // Customer email address
  provider: string; // Provider name: "stripe", "paddle", "paypal", etc.
  subscriptionId?: string; // Subscription ID (for subscription events)
  paymentId?: string; // Payment ID (for payment events)
  metadata?: Record<string, unknown>; // Additional provider-specific data
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
  metadata: {
    // Provider-specific additional data
  }
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

## 🔧 Provider Setup Guides

### Stripe Setup

1. **Create a Stripe account** at [stripe.com](https://stripe.com)
2. **Get your API keys:**
   - Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
   - Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for production)
3. **Create prices with lookup keys:**
   - Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
   - Create a product and price
   - Set a `lookup_key` (e.g., `"pro-monthly"`) in the price settings
   - Use this `lookup_key` as the `plan` parameter in `pay.subscribe()`
4. **Set up webhooks:**
   - Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
   - Click "Add endpoint"
   - Enter your webhook URL: `https://yourdomain.com/webhooks/paylayer`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.created`, `customer.subscription.deleted`, etc.
   - Copy the **Signing secret** (starts with `whsec_`)

### Paddle Setup

1. **Create a Paddle account** at [paddle.com](https://paddle.com)
2. **Get your API key:**
   - Go to [Paddle Dashboard → Developer Tools → Authentication](https://vendors.paddle.com/authentication)
   - Create an API key and copy it
3. **Create prices:**
   - Go to [Paddle Dashboard → Catalog](https://vendors.paddle.com/catalog)
   - Create products and prices
   - Copy the **Price ID** (starts with `pri_`)
   - Use this Price ID as the `plan` parameter in `pay.subscribe()`
4. **Set up webhooks:**
   - Go to [Paddle Dashboard → Developer Tools → Notifications](https://vendors.paddle.com/notifications)
   - Add a webhook endpoint: `https://yourdomain.com/webhooks/paylayer`
   - Copy the **Signing secret**

### PayPal Setup

1. **Create a PayPal Developer account** at [developer.paypal.com](https://developer.paypal.com)
2. **Create an app:**
   - Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
   - Click "Create App"
   - Copy your **Client ID** and **Secret**
3. **Create billing plans:**
   - Go to [PayPal Dashboard → Billing](https://www.paypal.com/billing)
   - Create a billing plan
   - Copy the **Plan ID** (starts with `P-`)
   - Use this Plan ID as the `plan` parameter in `pay.subscribe()`
4. **Set up webhooks:**
   - Go to [PayPal Developer Dashboard → Webhooks](https://developer.paypal.com/dashboard/)
   - Add a webhook URL: `https://yourdomain.com/webhooks/paylayer`
   - Copy the **Signing secret**

### Lemon Squeezy Setup

1. **Create a Lemon Squeezy account** at [lemonsqueezy.com](https://lemonsqueezy.com)
2. **Create a store:**
   - Go to [Lemon Squeezy Dashboard → Stores](https://app.lemonsqueezy.com/stores)
   - Create or select a store
   - Copy your **Store ID**
3. **Get your API key:**
   - Go to [Lemon Squeezy Dashboard → Settings → API](https://app.lemonsqueezy.com/settings/api)
   - Create an API key and copy it
4. **Create products and variants:**
   - Go to [Lemon Squeezy Dashboard → Products](https://app.lemonsqueezy.com/products)
   - Create a product and variant
   - Copy the **Variant ID**
   - Use this Variant ID as the `plan` parameter in `pay.subscribe()`
5. **Set up webhooks:**
   - Go to [Lemon Squeezy Dashboard → Settings → Webhooks](https://app.lemonsqueezy.com/settings/webhooks)
   - Add a webhook URL: `https://yourdomain.com/webhooks/paylayer`
   - Copy the **Signing secret**

### Polar.sh Setup

1. **Create a Polar account** at [polar.sh](https://polar.sh)
2. **Create an Organization Access Token (OAT):**
   - Go to [Polar Dashboard → Settings → Access Tokens](https://polar.sh/dashboard/settings)
   - Create an OAT and copy it
3. **Create products:**
   - Go to [Polar Dashboard → Products](https://polar.sh/dashboard/products)
   - Create a product with subscription prices
   - Copy the **Product ID**
   - Use this Product ID as the `plan` parameter in `pay.subscribe()`
4. **Set up webhooks:**
   - Go to [Polar Dashboard → Settings → Webhooks](https://polar.sh/dashboard/settings/webhooks)
   - Add a webhook URL: `https://yourdomain.com/webhooks/paylayer`
   - Copy the **Signing secret**

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

// All methods are fully typed
const result: ChargeResult = await pay.charge({
  amount: 29.99,
  currency: "USD",
  email: "customer@example.com",
});
```

---

## 💱 Supported Currencies

The SDK includes a comprehensive `Currency` enum with all currencies supported by Stripe, PayPal, Paddle, Lemon Squeezy, and Polar providers. This provides type safety and autocomplete support for currency codes.

### Using the Currency Enum

```typescript
import { pay, Currency } from "@paylayer/core";

// Use the enum for type safety and autocomplete
const result = await pay.charge({
  amount: 29.99,
  currency: Currency.USD, // TypeScript autocomplete available
  email: "customer@example.com",
});

// String literals also work for backward compatibility
const result2 = await pay.charge({
  amount: 29.99,
  currency: "USD", // Also valid
  email: "customer@example.com",
});
```

### Available Currencies

The `Currency` enum includes over 150+ currencies based on ISO 4217 standard. Here are some commonly used currencies:

**Major Currencies:**

- `Currency.USD` - United States Dollar
- `Currency.EUR` - Euro
- `Currency.GBP` - British Pound Sterling
- `Currency.JPY` - Japanese Yen
- `Currency.AUD` - Australian Dollar
- `Currency.CAD` - Canadian Dollar
- `Currency.CHF` - Swiss Franc
- `Currency.CNY` - Chinese Yuan
- `Currency.HKD` - Hong Kong Dollar
- `Currency.NZD` - New Zealand Dollar
- `Currency.SGD` - Singapore Dollar

**Other Supported Currencies:**

- `Currency.SEK` - Swedish Krona
- `Currency.NOK` - Norwegian Krone
- `Currency.DKK` - Danish Krone
- `Currency.PLN` - Polish Złoty
- `Currency.CZK` - Czech Koruna
- `Currency.HUF` - Hungarian Forint
- `Currency.BRL` - Brazilian Real
- `Currency.MXN` - Mexican Peso
- `Currency.INR` - Indian Rupee
- `Currency.KRW` - South Korean Won
- `Currency.THB` - Thai Baht
- `Currency.PHP` - Philippine Peso
- `Currency.MYR` - Malaysian Ringgit
- `Currency.TWD` - New Taiwan Dollar
- `Currency.ILS` - Israeli New Shekel
- `Currency.RUB` - Russian Ruble
- `Currency.ZAR` - South African Rand

And many more! The enum includes currencies from all major regions including:

- Americas (USD, CAD, MXN, BRL, ARS, CLP, COP, etc.)
- Europe (EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, etc.)
- Asia-Pacific (JPY, CNY, INR, KRW, THB, PHP, MYR, TWD, SGD, AUD, NZD, etc.)
- Middle East & Africa (AED, SAR, ZAR, EGP, NGN, KES, etc.)

For a complete list, refer to the `Currency` enum in the TypeScript definitions or use your IDE's autocomplete feature.

### Type Safety

The `Currency` enum provides compile-time type checking:

```typescript
import { Currency } from "@paylayer/core";

// ✅ Valid - TypeScript will autocomplete
const currency: Currency = Currency.USD;

// ✅ Valid - String literals work too
const currency2: Currency = "USD";

// ❌ Invalid - TypeScript will error
const currency3: Currency = "INVALID"; // Error: Type '"INVALID"' is not assignable to type 'Currency'
```

---

## 🔒 Security

- ✅ **Webhook Signature Verification** - All webhook signatures are verified using provider-specific methods (HMAC SHA256 for most providers)
- ✅ **Timing Attack Prevention** - Constant-time comparison is used for signature verification to prevent timing attacks
- ✅ **No Sensitive Data Logging** - No sensitive data (API keys, payment details) is logged or exposed
- ✅ **Environment Variable Security** - All API keys must be provided via environment variables (never hardcode credentials)
- ✅ **Production Safety** - Defaults to production mode for safety (explicitly set sandbox mode for testing)

**Best Practices:**

- Never commit `.env` files to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Monitor webhook endpoints for suspicious activity
- Use HTTPS for all webhook endpoints

---

## ⚠️ Error Handling

The SDK provides clear, actionable error messages for common issues:

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

### Provider-Specific Errors

All errors include context to help with debugging, including:

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
