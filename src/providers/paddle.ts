/**
 * Paddle provider implementation
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

// Paddle API response types
interface PaddleTransactionResponse {
  data: {
    id: string;
    status: string;
    currency_code: string;
    totals: {
      total: string;
      currency_code: string;
    };
    items: Array<{ price: { id: string } }>;
    checkout?: {
      url: string;
    };
  };
}

interface PaddleSubscriptionResponse {
  data: {
    id: string;
    status: string;
    items: Array<{ price: { id: string } }>;
    currency_code: string;
    customer_id?: string;
  };
}

interface PaddleCustomerListResponse {
  data: Array<{ id: string }>;
}

interface PaddlePortalSessionResponse {
  data: {
    id: string;
    customer_id: string;
    urls: {
      general: {
        overview: string;
      };
      subscriptions?: Array<{
        id: string;
        cancel_subscription: string;
        update_subscription_payment_method: string;
      }>;
    };
    created_at: string;
  };
}

export class PaddleProvider implements PaymentProvider {
  readonly name = "paddle";
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PADDLE_API_KEY environment variable is required for Paddle provider"
      );
    }
    this.apiKey = apiKey;
    this.baseUrl =
      process.env.PADDLE_BASE_URL ||
      (isSandbox(this.name)
        ? "https://sandbox-api.paddle.com"
        : "https://api.paddle.com");
  }

  private async request(
    method: string,
    endpoint: string,
    body?: unknown,
    queryParams?: Record<string, string | number>
  ): Promise<unknown> {
    let url = `${this.baseUrl}${endpoint}`;

    // Add query parameters for GET requests
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Paddle-Version": process.env.PADDLE_API_VERSION || "1",
    };

    // Only add Content-Type and body for non-GET requests
    const isGet = method.toUpperCase() === "GET";
    if (!isGet) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: !isGet && body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(
        `Paddle API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Paddle uses transactions for one-time payments via checkout
    // Note: Paddle requires a price_id for transactions
    const priceId = process.env.PADDLE_DEFAULT_PRICE_ID;
    if (!priceId) {
      throw new Error(
        "PADDLE_DEFAULT_PRICE_ID environment variable is required for charges. Create a price in Paddle dashboard first."
      );
    }

    // Create a transaction with automatic collection mode
    // The checkout URL will be available in response.data.checkout?.url
    const response = (await this.request("POST", "/transactions", {
      items: [
        {
          price_id: priceId,
          quantity: 1,
        },
      ],
      currency_code: input.currency,
      customer_email: input.email,
      collection_mode: "automatic",
      custom_data: {
        paylayer_provider: this.name,
        amount: input.amount.toString(),
      },
    })) as PaddleTransactionResponse;

    // Note: The checkout URL is available in response.data.checkout?.url
    // This can be used to redirect customers to complete payment

    return {
      id: response.data.id,
      status:
        response.data.status === "completed"
          ? "succeeded"
          : response.data.status === "failed"
            ? "failed"
            : "pending",
      amount: parseFloat(response.data.totals.total),
      currency: response.data.totals.currency_code.toUpperCase(),
      provider: this.name,
      email: input.email,
    };
  }

  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    if (!input.email) {
      throw new Error("Email is required for Paddle subscriptions");
    }

    // Paddle doesn't support direct subscription creation
    // Instead, create a transaction with a recurring price
    // The subscription will be created automatically when the customer completes checkout
    // The plan should be a Paddle price ID with recurring billing
    const response = (await this.request("POST", "/transactions", {
      items: [
        {
          price_id: input.plan, // Plan must be a Paddle price ID with recurring billing
          quantity: 1,
        },
      ],
      customer_email: input.email,
      currency_code: input.currency,
      collection_mode: "automatic",
      custom_data: {
        paylayer_provider: this.name,
        paylayer_plan: input.plan,
      },
    })) as PaddleTransactionResponse;

    // Note: The checkout URL is available in response.data.checkout?.url
    // The actual subscription will be created via webhook after checkout completion
    // For now, we return the transaction ID as a temporary subscription ID
    // The webhook handler should update this when the subscription is created

    return {
      id: response.data.id, // Transaction ID - will be replaced by subscription ID via webhook
      status: "active", // Placeholder - subscription will be created via webhook after checkout
      plan: response.data.items[0]?.price.id || input.plan,
      currency: response.data.currency_code.toUpperCase(),
      provider: this.name,
      email: input.email,
    };
  }

  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    const response = (await this.request(
      "POST",
      `/subscriptions/${subscriptionId}/cancel`,
      {
        effective_from: "next_billing_period",
      }
    )) as PaddleSubscriptionResponse;

    return {
      id: response.data.id,
      status: "cancelled",
      plan: response.data.items[0]?.price.id || "unknown",
      currency: response.data.currency_code.toUpperCase(),
      provider: this.name,
    };
  }

  async pause(subscriptionId: string): Promise<SubscriptionResult> {
    // Paddle doesn't have a direct pause - cancel at period end
    return this.cancel(subscriptionId);
  }

  async resume(subscriptionId: string): Promise<SubscriptionResult> {
    // Paddle doesn't support resume - fetch current subscription status
    const response = (await this.request(
      "GET",
      `/subscriptions/${subscriptionId}`
    )) as PaddleSubscriptionResponse;

    if (response.data.status === "canceled") {
      throw new Error(
        "Cannot resume a canceled subscription. Create a new subscription instead."
      );
    }

    return {
      id: response.data.id,
      status: response.data.status === "active" ? "active" : "active",
      plan: response.data.items[0]?.price.id || "unknown",
      currency: response.data.currency_code.toUpperCase(),
      provider: this.name,
    };
  }

  async portal(email: string): Promise<string> {
    // Paddle customer portal - requires customer ID lookup
    // Use query parameters in URL for GET request
    const customers = (await this.request("GET", "/customers", undefined, {
      email: email,
      per_page: 1,
    })) as PaddleCustomerListResponse;

    if (customers.data.length === 0) {
      throw new Error(`No customer found with email: ${email}`);
    }

    const customerId = customers.data[0].id;

    // Create customer portal session via POST endpoint
    const portalSession = (await this.request(
      "POST",
      `/customers/${customerId}/portal-sessions`,
      {}
    )) as PaddlePortalSessionResponse;

    // Return the authenticated URL from the portal session
    return portalSession.data.urls.general.overview;
  }

  verifyWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    const webhookSecret = secret || process.env.PADDLE_WEBHOOK_SECRET || "";
    if (!webhookSecret || !signature) {
      return false;
    }

    // Paddle uses HMAC SHA256 for webhook verification
    // The signature is in the format: "ts=timestamp;h1=hash"
    // The signed payload format is: "timestamp:raw_body"
    const payloadString =
      typeof payload === "string" ? payload : payload.toString("utf-8");

    try {
      // Extract timestamp and hash from signature
      const parts = signature.split(";");
      const tsPart = parts.find((p) => p.startsWith("ts="));
      const h1Part = parts.find((p) => p.startsWith("h1="));

      if (!tsPart || !h1Part) {
        return false;
      }

      const timestamp = tsPart.substring(3); // Remove "ts=" prefix
      const providedHash = h1Part.substring(3); // Remove "h1=" prefix

      // Construct signed payload: "timestamp:raw_body"
      const signedPayload = `${timestamp}:${payloadString}`;

      // Compute HMAC SHA256 on the signed payload
      const hmac = createHmac("sha256", webhookSecret);
      hmac.update(signedPayload);
      const computedHash = hmac.digest("hex");

      // Compare hashes using constant-time comparison
      return this.constantTimeEquals(providedHash, computedHash);
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
      event_id: string;
      event_type: string;
      data: unknown;
      occurred_at: string;
    };
    return {
      type: event.event_type,
      id: event.event_id,
      data: event.data,
      occurred_at: event.occurred_at,
    };
  }
}
