/**
 * Polar.sh provider implementation
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

// Polar API response types
interface PolarCustomer {
  id: string;
  email?: string;
  name?: string;
}

interface PolarCustomerList {
  items: PolarCustomer[];
}

interface PolarProduct {
  id: string;
  name: string;
  prices: Array<{
    id: string;
    amount_type: string;
    price_amount: number;
    price_currency: string;
    recurring_interval?: string;
    recurring_interval_count?: number;
  }>;
}

interface PolarCheckout {
  id: string;
  status: string;
  url: string;
}

interface PolarSubscription {
  id: string;
  status: string;
  product_id: string;
  price_id?: string;
  customer_id: string;
  currency?: string;
}

interface PolarCustomerSession {
  id: string;
  token: string;
  customer_portal_url: string;
  customer_id: string;
}

export class PolarProvider implements PaymentProvider {
  readonly name = "polar";
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    // Support both POLAR_API_KEY (legacy) and POLAR_OAT/POLAR_ACCESS_TOKEN
    const apiKey =
      process.env.POLAR_OAT ||
      process.env.POLAR_ACCESS_TOKEN ||
      process.env.POLAR_API_KEY;
    if (!apiKey) {
      throw new Error(
        "POLAR_OAT or POLAR_ACCESS_TOKEN environment variable is required for Polar provider"
      );
    }
    this.apiKey = apiKey;

    // Support sandbox environment
    const sandboxMode = isSandbox(this.name);
    if (process.env.POLAR_BASE_URL) {
      this.baseUrl = process.env.POLAR_BASE_URL;
    } else {
      this.baseUrl = sandboxMode
        ? "https://sandbox-api.polar.sh/v1"
        : "https://api.polar.sh/v1";
    }

    // Ensure base URL ends with /v1
    if (!this.baseUrl.endsWith("/v1")) {
      this.baseUrl = this.baseUrl.replace(/\/$/, "") + "/v1";
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    // Ensure endpoint starts with /
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    // Build URL with query parameters
    let url = `${this.baseUrl}${path}`;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(
        `Polar API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Find or create a customer by email
   */
  private async findOrCreateCustomer(email: string): Promise<string> {
    // Search for existing customer by email
    const customers = await this.request<PolarCustomerList>(
      "GET",
      "/customers",
      undefined,
      { email }
    );

    if (customers.items && customers.items.length > 0) {
      return customers.items[0].id;
    }

    // Create new customer
    const customer = await this.request<PolarCustomer>("POST", "/customers", {
      email,
    });

    return customer.id;
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Polar uses checkout sessions for one-time payments
    const productId = process.env.POLAR_DEFAULT_PRODUCT_ID;
    if (!productId) {
      throw new Error(
        "POLAR_DEFAULT_PRODUCT_ID is required for charges. Create a product in Polar dashboard first."
      );
    }

    // Polar API requires products as an array
    const response = await this.request<PolarCheckout>("POST", "/checkouts", {
      products: [productId], // Array of product IDs
      success_url:
        process.env.POLAR_SUCCESS_URL || "https://app.example.com/success",
      customer_email: input.email,
      metadata: {
        paylayer_provider: this.name,
        amount: input.amount.toString(),
        currency: input.currency,
      },
    });

    return {
      id: response.id,
      status:
        response.status === "completed"
          ? "succeeded"
          : response.status === "pending"
            ? "pending"
            : "pending",
      amount: input.amount,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    if (!input.email) {
      throw new Error("Email is required for Polar subscriptions");
    }

    // Polar subscriptions require: customer_id, product_id, price_id, recurring_interval, recurring_interval_count
    // The plan should be a product ID - we need to get the product to find a subscription price

    // 1. Find or create customer
    const customerId = await this.findOrCreateCustomer(input.email);

    // 2. Get product details to find subscription price
    const product = await this.request<PolarProduct>(
      "GET",
      `/products/${input.plan}`
    );

    // Find a subscription price (recurring price)
    const subscriptionPrice = product.prices.find(
      (price) => price.recurring_interval && price.recurring_interval_count
    );

    if (!subscriptionPrice) {
      throw new Error(
        `No subscription price found for product ${input.plan}. Please ensure the product has a recurring price configured.`
      );
    }

    // 3. Create subscription with all required fields
    const response = await this.request<PolarSubscription>(
      "POST",
      "/subscriptions",
      {
        customer_id: customerId,
        product_id: input.plan,
        price_id: subscriptionPrice.id,
        recurring_interval: subscriptionPrice.recurring_interval || "month",
        recurring_interval_count:
          subscriptionPrice.recurring_interval_count || 1,
        metadata: {
          paylayer_provider: this.name,
          paylayer_plan: input.plan,
          currency: input.currency,
        },
      }
    );

    return {
      id: response.id,
      status:
        response.status === "active"
          ? "active"
          : response.status === "past_due"
            ? "past_due"
            : response.status === "canceled" || response.status === "cancelled"
              ? "cancelled"
              : "active",
      plan: response.product_id || input.plan,
      currency: response.currency?.toUpperCase() || input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    // Cancel subscription immediately
    const response = await this.request<PolarSubscription>(
      "POST",
      `/subscriptions/${subscriptionId}/cancel`,
      {
        revoke_immediate: true,
      }
    );

    return {
      id: response.id,
      status: "cancelled",
      plan: response.product_id || "unknown",
      currency: response.currency?.toUpperCase() || "USD",
      provider: this.name,
    };
  }

  async pause(subscriptionId: string): Promise<SubscriptionResult> {
    // Pause by setting cancel_at_period_end to true
    const response = await this.request<PolarSubscription>(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      {
        cancel_at_period_end: true,
      }
    );

    return {
      id: response.id,
      status: "paused",
      plan: response.product_id || "unknown",
      currency: response.currency?.toUpperCase() || "USD",
      provider: this.name,
    };
  }

  async resume(subscriptionId: string): Promise<SubscriptionResult> {
    // Resume by setting cancel_at_period_end to false
    const response = await this.request<PolarSubscription>(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      {
        cancel_at_period_end: false,
      }
    );

    return {
      id: response.id,
      status: "active",
      plan: response.product_id || "unknown",
      currency: response.currency?.toUpperCase() || "USD",
      provider: this.name,
    };
  }

  async portal(email: string): Promise<string> {
    // Polar requires creating a customer session to get portal URL
    // First, find the customer by email
    const customerId = await this.findOrCreateCustomer(email);

    // Create customer session
    const session = await this.request<PolarCustomerSession>(
      "POST",
      "/customer-sessions",
      {
        customer_id: customerId,
      }
    );

    // Return the customer portal URL from the session
    return session.customer_portal_url;
  }

  verifyWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    const webhookSecret = secret || process.env.POLAR_WEBHOOK_SECRET || "";
    if (!webhookSecret || !signature) {
      return false;
    }

    // Polar.sh follows Standard Webhooks specification
    // The webhook secret may need to be base64 decoded
    // However, we'll try both raw and base64 decoded versions
    try {
      const payloadString =
        typeof payload === "string" ? payload : payload.toString("utf-8");

      // Try with raw secret first
      let secretKey: string | Buffer = webhookSecret;
      try {
        // Try base64 decoding (Standard Webhooks format)
        secretKey = Buffer.from(webhookSecret, "base64");
      } catch {
        // If base64 decode fails, use raw secret
        secretKey = webhookSecret;
      }

      // Compute HMAC SHA256
      const hmac = createHmac("sha256", secretKey);
      hmac.update(payloadString);
      const computedHash = hmac.digest("hex");

      // Compare hashes using constant-time comparison
      return this.constantTimeEquals(signature, computedHash);
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

  normalizeWebhookEvent(rawEvent: unknown): unknown {
    const event = rawEvent as {
      id?: string;
      type: string;
      data: unknown;
      timestamp?: string;
      created_at?: string;
    };
    return {
      type: event.type,
      id: event.id || (event.data as { id?: string })?.id || "",
      data: event.data,
      created_at:
        event.timestamp || event.created_at || new Date().toISOString(),
    };
  }
}
