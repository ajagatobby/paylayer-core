/**
 * Stripe provider implementation using REST API
 */

import { createHmac } from "node:crypto";
import type { PaymentProvider } from "./types.js";
import type {
  ChargeInput,
  ChargeResult,
  SubscribeInput,
  SubscriptionResult,
} from "../types.js";
import { isSandbox } from "./env.js";

// Stripe API response types

/**
 * Stripe Customer object
 * Note: Multiple customers can have the same email address in Stripe
 */
interface StripeCustomer {
  id: string;
  email?: string;
}

interface StripeCustomerList {
  data: StripeCustomer[];
}

/**
 * Stripe PaymentIntent object
 * PaymentIntents require client-side confirmation using Stripe.js before they can succeed
 */
interface StripePaymentIntent {
  id: string;
  status:
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_action"
    | "processing"
    | "requires_capture"
    | "canceled"
    | "succeeded";
  amount: number;
  currency: string;
  client_secret: string;
}

interface StripePrice {
  id: string;
  lookup_key?: string;
}

interface StripePriceList {
  data: StripePrice[];
}

/**
 * Stripe Subscription object
 * Subscriptions can have various statuses depending on payment state
 */
interface StripeSubscription {
  id: string;
  status:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "trialing"
    | "unpaid"
    | "paused";
  currency: string;
  cancel_at_period_end: boolean;
  pause_collection?: { behavior: string } | null;
  items: {
    data: Array<{
      price: {
        id: string;
        lookup_key?: string;
      };
    }>;
  };
}

interface StripeBillingPortalSession {
  url: string;
}

interface StripeEvent {
  id: string;
  type: string;
  data: unknown;
  created: number;
}

/**
 * Stripe Error object
 * Contains detailed error information including type, code, and parameter
 */
interface StripeError {
  error: {
    type: string;
    message: string;
    code?: string;
    param?: string;
    decline_code?: string;
    payment_intent?: unknown;
    payment_method?: unknown;
    setup_intent?: unknown;
    source?: unknown;
  };
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private apiKey: string;
  private readonly baseUrl = "https://api.stripe.com";

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error(
        "STRIPE_SECRET_KEY environment variable is required for Stripe provider"
      );
    }
    this.apiKey = apiKey;

    // Validate environment mode matches API key type
    const sandboxMode = isSandbox(this.name);
    const isTestKey = apiKey.startsWith("sk_test_");
    const isLiveKey = apiKey.startsWith("sk_live_");

    if (sandboxMode && isLiveKey) {
      console.warn(
        "Warning: PAYLAYER_ENVIRONMENT is set to sandbox/test mode, but STRIPE_SECRET_KEY appears to be a live key (starts with 'sk_live_'). This may cause issues."
      );
    } else if (!sandboxMode && isTestKey) {
      console.warn(
        "Warning: PAYLAYER_ENVIRONMENT is set to production mode, but STRIPE_SECRET_KEY appears to be a test key (starts with 'sk_test_'). This may cause issues."
      );
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Stripe-Version": "2025-11-17.clover",
    };

    let body: string | undefined;
    if (params && Object.keys(params).length > 0) {
      if (method === "GET") {
        // For GET requests, append params as query string
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (Array.isArray(value)) {
            // Handle array parameters like lookup_keys[]
            for (const item of value) {
              queryParams.append(`${key}[]`, String(item));
            }
          } else if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        }
        const queryString = queryParams.toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        const response = await fetch(fullUrl, {
          method,
          headers,
        });

        if (!response.ok) {
          await this.handleError(response);
        }

        return response.json() as Promise<T>;
      } else {
        // For POST requests, use form-encoded body
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          // Handle empty strings explicitly (for clearing fields like pause_collection)
          if (value === "") {
            formData.append(key, "");
            continue;
          }

          if (value === undefined || value === null) {
            continue;
          }

          if (typeof value === "object" && !Array.isArray(value)) {
            // Handle nested objects (like metadata)
            // Check if it's an empty object (for clearing fields)
            if (Object.keys(value as Record<string, unknown>).length === 0) {
              formData.append(key, "");
            } else {
              for (const [nestedKey, nestedValue] of Object.entries(
                value as Record<string, unknown>
              )) {
                formData.append(`${key}[${nestedKey}]`, String(nestedValue));
              }
            }
          } else if (Array.isArray(value)) {
            // Handle arrays (like items)
            for (let i = 0; i < value.length; i++) {
              const item = value[i] as Record<string, unknown>;
              for (const [itemKey, itemValue] of Object.entries(item)) {
                formData.append(`${key}[${i}][${itemKey}]`, String(itemValue));
              }
            }
          } else {
            formData.append(key, String(value));
          }
        }
        body = formData.toString();
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json() as Promise<T>;
  }

  private async handleError(response: Response): Promise<never> {
    const error = (await response.json().catch(() => ({
      error: { message: "Unknown error", type: "api_error" },
    }))) as StripeError;

    const errorInfo = error.error;
    if (!errorInfo) {
      throw new Error(`Stripe API error: ${response.status} - Unknown error`);
    }

    // Build detailed error message with all available information
    let errorMessage = `Stripe API error: ${response.status}`;

    if (errorInfo.type) {
      errorMessage += ` [${errorInfo.type}]`;
    }

    if (errorInfo.message) {
      errorMessage += ` - ${errorInfo.message}`;
    }

    if (errorInfo.code) {
      errorMessage += ` (code: ${errorInfo.code})`;
    }

    if (errorInfo.param) {
      errorMessage += ` (param: ${errorInfo.param})`;
    }

    if (errorInfo.decline_code) {
      errorMessage += ` (decline_code: ${errorInfo.decline_code})`;
    }

    throw new Error(errorMessage);
  }

  /**
   * Creates a one-time payment charge using Stripe PaymentIntent
   *
   * IMPORTANT: PaymentIntents require client-side confirmation using Stripe.js
   * The returned PaymentIntent will be in "pending" status until confirmed.
   * Use the PaymentIntent's client_secret with Stripe.js to complete the payment.
   *
   * @param input - Charge input with amount, currency, and optional email
   * @returns Charge result with PaymentIntent ID and status
   */
  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(input.amount * 100);

    // Create or retrieve customer if email provided
    // Note: Multiple customers can have the same email in Stripe
    // This will retrieve the first customer found with the given email
    let customerId: string | undefined;
    if (input.email) {
      const customers = await this.request<StripeCustomerList>(
        "GET",
        "/v1/customers",
        {
          email: input.email,
          limit: 1,
        }
      );
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await this.request<StripeCustomer>(
          "POST",
          "/v1/customers",
          {
            email: input.email,
          }
        );
        customerId = customer.id;
      }
    }

    // Create PaymentIntent for one-time payment
    // Using automatic_payment_methods for modern Stripe integration
    // This allows Stripe to automatically determine compatible payment methods
    const paymentIntent = await this.request<StripePaymentIntent>(
      "POST",
      "/v1/payment_intents",
      {
        amount: amountInCents,
        currency: input.currency.toLowerCase(),
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        confirmation_method: "automatic",
        metadata: {
          paylayer_provider: this.name,
        },
      }
    );

    // PaymentIntents are created in requires_payment_method or requires_confirmation status
    // They need client-side confirmation via Stripe.js before they can succeed
    // Return "pending" for all non-terminal statuses
    return {
      id: paymentIntent.id,
      status:
        paymentIntent.status === "succeeded"
          ? "succeeded"
          : paymentIntent.status === "canceled"
            ? "failed"
            : "pending",
      amount: input.amount,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  /**
   * Creates a subscription using Stripe
   *
   * Uses payment_behavior: 'allow_incomplete' to handle SCA (Strong Customer Authentication)
   * scenarios gracefully. Subscriptions may start in 'incomplete' status if payment requires
   * customer action.
   *
   * Note: Multiple customers can have the same email in Stripe.
   * This will retrieve the first customer found with the given email.
   *
   * @param input - Subscription input with plan (lookup_key), currency, and email
   * @returns Subscription result with subscription ID and status
   */
  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    if (!input.email) {
      throw new Error("Email is required for Stripe subscriptions");
    }

    // Create or retrieve customer
    // Note: Multiple customers can have the same email in Stripe
    // This will retrieve the first customer found with the given email
    let customerId: string;
    const customers = await this.request<StripeCustomerList>(
      "GET",
      "/v1/customers",
      {
        email: input.email,
        limit: 1,
      }
    );
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await this.request<StripeCustomer>(
        "POST",
        "/v1/customers",
        {
          email: input.email,
        }
      );
      customerId = customer.id;
    }

    // Find price by lookup_key
    // IMPORTANT: Prices must be pre-configured in Stripe dashboard
    // The input.plan should be the lookup_key of an existing price
    const prices = await this.request<StripePriceList>("GET", "/v1/prices", {
      lookup_keys: [input.plan],
      limit: 1,
    });

    if (prices.data.length === 0) {
      throw new Error(
        `No price found with lookup_key "${input.plan}". Please create a price in Stripe dashboard with this lookup_key first.`
      );
    }

    const priceId = prices.data[0].id;

    // Create subscription with payment behavior for SCA handling
    // payment_behavior: 'allow_incomplete' allows subscription creation even if
    // the first invoice can't be paid immediately (e.g., requires SCA)
    const subscription = await this.request<StripeSubscription>(
      "POST",
      "/v1/subscriptions",
      {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "allow_incomplete",
        collection_method: "charge_automatically",
        metadata: {
          paylayer_provider: this.name,
          paylayer_plan: input.plan,
        },
      }
    );

    // Map Stripe subscription statuses to PayLayer statuses
    // Handle all possible subscription statuses
    let status: "active" | "paused" | "cancelled" | "past_due";
    switch (subscription.status) {
      case "active":
      case "trialing":
        status = "active";
        break;
      case "past_due":
      case "unpaid":
        status = "past_due";
        break;
      case "canceled":
        status = "cancelled";
        break;
      case "paused":
        status = "paused";
        break;
      case "incomplete":
      case "incomplete_expired":
        // Incomplete subscriptions are treated as active but may need attention
        // The subscription exists but payment hasn't been completed yet
        status = "active";
        break;
      default:
        // Fallback to active for unknown statuses
        status = "active";
    }

    return {
      id: subscription.id,
      status,
      plan: input.plan,
      currency: subscription.currency.toUpperCase(),
      provider: this.name,
      email: input.email,
    };
  }

  /**
   * Cancels a subscription at the end of the current billing period
   * The subscription remains active until the period ends
   *
   * @param subscriptionId - Stripe subscription ID
   * @returns Subscription result with updated status
   */
  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    const subscription = await this.request<StripeSubscription>(
      "POST",
      `/v1/subscriptions/${subscriptionId}`,
      {
        cancel_at_period_end: true,
      }
    );

    return {
      id: subscription.id,
      status: subscription.cancel_at_period_end ? "cancelled" : "active",
      plan:
        subscription.items.data[0]?.price.lookup_key ||
        subscription.items.data[0]?.price.id ||
        "unknown",
      currency: subscription.currency.toUpperCase(),
      provider: this.name,
    };
  }

  /**
   * Pauses payment collection for a subscription
   * Invoices generated during the pause will be marked as uncollectible
   *
   * @param subscriptionId - Stripe subscription ID
   * @returns Subscription result with paused status
   */
  async pause(subscriptionId: string): Promise<SubscriptionResult> {
    // Stripe pause collection with mark_uncollectible behavior
    const subscription = await this.request<StripeSubscription>(
      "POST",
      `/v1/subscriptions/${subscriptionId}`,
      {
        pause_collection: {
          behavior: "mark_uncollectible",
        },
      }
    );

    return {
      id: subscription.id,
      status: subscription.pause_collection ? "paused" : "active",
      plan:
        subscription.items.data[0]?.price.lookup_key ||
        subscription.items.data[0]?.price.id ||
        "unknown",
      currency: subscription.currency.toUpperCase(),
      provider: this.name,
    };
  }

  /**
   * Resumes payment collection for a paused subscription
   * Clears the pause_collection setting to resume normal billing
   *
   * @param subscriptionId - Stripe subscription ID
   * @returns Subscription result with active status
   */
  async resume(subscriptionId: string): Promise<SubscriptionResult> {
    // To remove pause_collection, send empty string
    // This will be form-encoded as pause_collection= which Stripe accepts to clear the field
    const subscription = await this.request<StripeSubscription>(
      "POST",
      `/v1/subscriptions/${subscriptionId}`,
      {
        pause_collection: "",
      }
    );

    return {
      id: subscription.id,
      status: "active",
      plan:
        subscription.items.data[0]?.price.lookup_key ||
        subscription.items.data[0]?.price.id ||
        "unknown",
      currency: subscription.currency.toUpperCase(),
      provider: this.name,
    };
  }

  /**
   * Creates a billing portal session for customer self-service
   *
   * Note: Multiple customers can have the same email in Stripe.
   * This will use the first customer found with the given email.
   *
   * @param email - Customer email address
   * @returns Billing portal URL
   */
  async portal(email: string): Promise<string> {
    // Find customer by email
    const customers = await this.request<StripeCustomerList>(
      "GET",
      "/v1/customers",
      {
        email,
        limit: 1,
      }
    );

    if (customers.data.length === 0) {
      throw new Error(`No customer found with email: ${email}`);
    }

    const customerId = customers.data[0].id;

    // Create billing portal session
    const session = await this.request<StripeBillingPortalSession>(
      "POST",
      "/v1/billing_portal/sessions",
      {
        customer: customerId,
        return_url:
          process.env.STRIPE_PORTAL_RETURN_URL || "https://app.example.com",
      }
    );

    return session.url;
  }

  /**
   * Verifies Stripe webhook signature using HMAC SHA256
   *
   * Implements Stripe's webhook signature verification with 5-minute timestamp tolerance
   * to prevent replay attacks while allowing for network delays.
   *
   * @param payload - Raw webhook payload (string or Buffer)
   * @param signature - Stripe signature from 'stripe-signature' header
   * @param secret - Webhook secret (if provided, overrides STRIPE_WEBHOOK_SECRET env var)
   * @returns true if signature is valid, false otherwise
   */
  verifyWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    // Use provided secret parameter if available, otherwise fall back to environment variable
    const webhookSecret = secret || process.env.STRIPE_WEBHOOK_SECRET || "";
    if (!webhookSecret || !signature) {
      return false;
    }

    try {
      // Stripe signature format: t={timestamp},v1={signature},v0={signature}
      const elements = signature.split(",");
      const timestamp = elements.find((e) => e.startsWith("t="))?.substring(2);
      const signatureV1 = elements
        .find((e) => e.startsWith("v1="))
        ?.substring(3);

      if (!timestamp || !signatureV1) {
        return false;
      }

      // Check timestamp is within 5 minutes
      const timestampNum = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - timestampNum) > 300) {
        // 5 minutes tolerance
        return false;
      }

      // Compute HMAC SHA256 of {timestamp}.{payload}
      const payloadString =
        typeof payload === "string" ? payload : payload.toString("utf-8");
      const signedPayload = `${timestamp}.${payloadString}`;

      const hmac = createHmac("sha256", webhookSecret);
      hmac.update(signedPayload);
      const computedSignature = hmac.digest("hex");

      // Compare using constant-time comparison
      return this.constantTimeEquals(signatureV1, computedSignature);
    } catch {
      return false;
    }
  }

  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Normalizes Stripe webhook event to common structure
   * Extracts type, id, data, and created timestamp from Stripe event
   *
   * @param rawEvent - Raw Stripe webhook event
   * @returns Normalized event object
   */
  normalizeWebhookEvent(rawEvent: unknown): unknown {
    const event = rawEvent as StripeEvent;
    return {
      type: event.type,
      id: event.id,
      data: event.data,
      created: event.created,
    };
  }
}
