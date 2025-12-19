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
  recurring_interval?: string | null; // null = one-time product, set value = subscription product
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
  products?: Array<{
    id: string;
    is_recurring?: boolean;
    recurring_interval?: string | null;
  }>;
}

interface PolarSubscription {
  id: string;
  status: string;
  product_id: string;
  price_id?: string;
  customer_id: string;
  currency?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  current_period_end?: string;
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

    try {
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
          .catch(() => ({ detail: "Unknown error" }));
        throw new Error(
          `Polar API error: ${response.status} - ${JSON.stringify(error)}`
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      // Handle network-level errors (fetch failures)
      if (error instanceof Error) {
        // Check for specific network error codes
        if ("code" in error) {
          const errorCode = (error as Error & { code?: string }).code;

          if (errorCode === "ETIMEDOUT") {
            throw new Error(
              `Polar API connection timed out. Please check your network connection.\n` +
                `Request URL: ${url}`
            );
          }

          if (errorCode === "ECONNREFUSED") {
            throw new Error(
              `Polar API connection refused. The server is not accepting connections.\n` +
                `Request URL: ${url}`
            );
          }

          if (errorCode === "ENOTFOUND") {
            throw new Error(
              `Polar API hostname not found. DNS resolution failed.\n` +
                `Request URL: ${url}`
            );
          }
        }

        // Check if error message contains fetch failed or network-related keywords
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes("fetch failed") ||
          errorMessage.includes("network") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out")
        ) {
          throw new Error(
            `Polar API request failed: ${error.message}\n` +
              `This usually indicates a network connectivity issue. Please verify:\n` +
              `  - Your internet connection is working\n` +
              `  - The API endpoint is reachable: ${url}\n` +
              `  - No firewall or proxy is blocking the connection\n` +
              `  - Your API key (POLAR_OAT or POLAR_ACCESS_TOKEN) is correctly configured`
          );
        }
      }

      // Re-throw if we couldn't categorize the error
      throw error;
    }
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
    // Polar requires a product ID to create checkouts.
    // Only productId is supported - amount and priceId are not supported.
    //
    // To create a one-time product in Polar dashboard:
    //   1. Go to Products > Create Product
    //   2. Name it "One-Time Payment" (or any name)
    //   3. Leave recurring_interval unset (or set to null) - this makes it one-time
    //   4. Add a price for your currency
    //   5. Copy the Product ID and provide it in the charge() call

    // productId is required
    if (!input.productId) {
      throw new Error(
        "productId is required for Polar charges. " +
          "Please create a one-time product in Polar dashboard and provide the productId in the charge() input."
      );
    }

    // Reject amount and priceId - only productId is supported
    if (input.amount !== undefined) {
      throw new Error(
        "amount is not supported for Polar charges. " +
          "Only productId is supported. The product must have a price configured in Polar dashboard."
      );
    }

    if (input.priceId !== undefined) {
      throw new Error(
        "priceId is not supported for Polar charges. " +
          "Only productId is supported. The product must have a price configured in Polar dashboard."
      );
    }

    const productId = input.productId;

    // Prioritize input URLs over environment variables
    const successUrl =
      input.successUrl ??
      process.env.PAYLAYER_SUCCESS_URL ??
      process.env.POLAR_SUCCESS_URL ??
      "https://app.example.com/success";

    // Get the product to find a matching price
    const product = await this.request<PolarProduct>(
      "GET",
      `/products/${productId}`
    );

    // Verify it's a one-time product
    const isSubscriptionProduct =
      product.recurring_interval !== null &&
      product.recurring_interval !== undefined;

    if (isSubscriptionProduct) {
      throw new Error(
        `Product ${productId} is a subscription product (recurring_interval: ${product.recurring_interval}). ` +
          `Only one-time products (recurring_interval: null) can be used for charges. ` +
          `Please use a one-time product or use pay.subscribe() for subscriptions.`
      );
    }

    // Find a one-time price that matches the currency
    const oneTimePrice = product.prices.find(
      (price) =>
        !price.recurring_interval &&
        !price.recurring_interval_count &&
        price.price_currency.toLowerCase() === input.currency.toLowerCase()
    );

    if (!oneTimePrice) {
      throw new Error(
        `No one-time price found for product ${productId} with currency ${input.currency}. ` +
          `Please ensure the product has a one-time price configured for this currency in Polar dashboard.`
      );
    }

    // Use product_id + product_price_id format for one-time payment
    const metadata: Record<string, unknown> = {
      paylayer_provider: this.name,
      currency: input.currency,
    };
    if (input.metadata) {
      Object.assign(metadata, input.metadata);
    }

    const checkoutPayload: Record<string, unknown> = {
      product_id: productId,
      product_price_id: oneTimePrice.id,
      success_url: successUrl,
      metadata,
    };

    // Only include email if provided and not a test/example domain
    // Polar validates email domains strictly, so test@example.com will fail validation
    // Skip email for test domains to avoid validation errors
    if (
      input.email &&
      !input.email.includes("@example.com") &&
      !input.email.includes("@test.")
    ) {
      // Use snake_case for API consistency
      checkoutPayload.customer_email = input.email;
    }

    const response = await this.request<PolarCheckout>(
      "POST",
      "/checkouts",
      checkoutPayload
    );

    // Fetch full checkout details to verify it's actually one-time
    // This helps detect if Polar ignored our one-time settings
    try {
      const checkoutDetails = await this.request<PolarCheckout>(
        "GET",
        `/checkouts/${response.id}`
      );

      if (checkoutDetails.products && checkoutDetails.products.length > 0) {
        const product = checkoutDetails.products[0];
        const isRecurring =
          product.is_recurring === true ||
          (product.recurring_interval !== null &&
            product.recurring_interval !== undefined);

        if (isRecurring) {
          console.error(
            `❌ ERROR: Checkout created but is RECURRING (interval: ${product.recurring_interval || "unknown"}, is_recurring: ${product.is_recurring}). ` +
              `Polar ignored ad-hoc pricing one-time settings because the product is a subscription product. ` +
              `\n` +
              `SOLUTION: Create a one-time product in Polar dashboard:\n` +
              `  1. Go to Products > Create Product\n` +
              `  2. Set recurring_interval to null (leave it unset)\n` +
              `  3. Add a price for your currency\n` +
              `  4. Copy the Product ID and provide it in the charge() call\n` +
              `\n` +
              `Current product ${productId} is a subscription product and cannot be used for one-time payments.`
          );
        } else {
          console.log(
            `✅ Checkout verified as ONE-TIME payment (recurring_interval: ${product.recurring_interval}, is_recurring: ${product.is_recurring})`
          );
        }
      }
    } catch (verifyError) {
      // If verification fails, log but don't fail the request
      console.warn(
        `⚠️  Could not verify checkout type: ${verifyError instanceof Error ? verifyError.message : "Unknown error"}`
      );
    }

    // Get amount from the price (convert from smallest currency unit to regular amount)
    const amount = oneTimePrice.price_amount / 100;

    return {
      id: response.id,
      url: response.url,
      status:
        response.status === "completed"
          ? "succeeded"
          : response.status === "pending"
            ? "pending"
            : "pending",
      amount,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    // Polar requires paid subscriptions to be created via checkout sessions, not directly
    // The subscription will be created automatically when the customer completes checkout

    // Polar validates email domains strictly
    if (!input.email) {
      throw new Error("Email is required for Polar subscriptions");
    }

    // Skip email validation errors for test domains
    if (
      input.email.includes("@example.com") ||
      input.email.includes("@test.")
    ) {
      throw new Error(
        "Polar API validates email domains. Please use a real email address (not @example.com or @test.*)"
      );
    }

    // The plan should be a product ID - verify it's a subscription product
    const product = await this.request<PolarProduct>(
      "GET",
      `/products/${input.plan}`
    );

    // Check if product is a subscription product
    const isSubscriptionProduct =
      product.recurring_interval !== null &&
      product.recurring_interval !== undefined;

    if (!isSubscriptionProduct) {
      throw new Error(
        `Product ${input.plan} is not a subscription product (recurring_interval: ${product.recurring_interval}). ` +
          `For subscriptions, you must use a product with recurring_interval set (day/week/month/year).`
      );
    }

    // Prioritize input URLs over environment variables
    const successUrl =
      input.successUrl ??
      process.env.PAYLAYER_SUCCESS_URL ??
      process.env.POLAR_SUCCESS_URL ??
      "https://app.example.com/success";

    const cancelUrl =
      input.cancelUrl ??
      process.env.PAYLAYER_CANCEL_URL ??
      process.env.POLAR_CANCEL_URL ??
      "https://app.example.com/cancel";

    // Create checkout session for subscription
    // Polar will create the subscription automatically when customer completes checkout
    const metadata: Record<string, unknown> = {
      paylayer_provider: this.name,
      paylayer_plan: input.plan,
      currency: input.currency,
      paylayer_type: "subscription",
    };
    if (input.metadata) {
      Object.assign(metadata, input.metadata);
    }

    const checkoutPayload: Record<string, unknown> = {
      products: [input.plan], // Product ID for subscription
      success_url: successUrl,
      return_url: cancelUrl, // Polar uses return_url for cancel
      metadata,
    };

    // Include customer email
    checkoutPayload.customer_email = input.email;

    const response = await this.request<PolarCheckout>(
      "POST",
      "/checkouts",
      checkoutPayload
    );

    // The subscription will be created after checkout completion
    // For now, return the checkout URL and a temporary subscription ID
    // The actual subscription ID will be available via webhook after checkout
    return {
      id: response.id, // Checkout ID (subscription will be created after checkout)
      url: response.url, // Checkout URL for customer to complete subscription
      status: "pending", // Will be updated via webhook after checkout completion
      plan: input.plan,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    // Cancel subscription immediately using DELETE endpoint
    // First, get the subscription details before canceling
    let subscription: PolarSubscription;
    try {
      subscription = await this.request<PolarSubscription>(
        "GET",
        `/subscriptions/${subscriptionId}`
      );
    } catch (error) {
      // If subscription doesn't exist, throw a more helpful error
      if (error instanceof Error && error.message.includes("404")) {
        throw new Error(
          `Subscription ${subscriptionId} not found. Please verify the subscription ID is correct.`
        );
      }
      throw error;
    }

    // Cancel subscription using DELETE method
    // Polar API uses DELETE /v1/subscriptions/{id} to revoke subscriptions
    const path = `/subscriptions/${subscriptionId}`;
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Not Found" }));
      throw new Error(
        `Polar API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    // DELETE may return empty body or subscription object
    // We already have the subscription details from the GET request above
    return {
      id: subscription.id,
      status: "cancelled",
      plan: subscription.product_id || "unknown",
      currency: subscription.currency?.toUpperCase() || "USD",
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
    // First, get the subscription to check its current status
    let subscription: PolarSubscription;
    try {
      subscription = await this.request<PolarSubscription>(
        "GET",
        `/subscriptions/${subscriptionId}`
      );
    } catch (error) {
      // If subscription doesn't exist, throw a more helpful error
      if (error instanceof Error) {
        if (error.message.includes("404")) {
          throw new Error(
            `Subscription ${subscriptionId} not found. Please verify the subscription ID is correct. ` +
              `If the subscription was permanently cancelled (deleted), it cannot be resumed.`
          );
        }
        // Re-throw network errors with context
        if (
          error.message.includes("fetch failed") ||
          error.message.includes("network") ||
          error.message.includes("connection")
        ) {
          throw new Error(
            `Failed to fetch subscription ${subscriptionId}: ${error.message}`
          );
        }
      }
      throw error;
    }

    // Check if subscription can be resumed
    // If status is "canceled" (permanently cancelled), it cannot be resumed
    if (
      subscription.status === "canceled" ||
      subscription.status === "cancelled"
    ) {
      throw new Error(
        `Cannot resume subscription ${subscriptionId}: subscription is permanently cancelled. ` +
          `Permanently cancelled subscriptions cannot be resumed. You may need to create a new subscription.`
      );
    }

    // Check if subscription is already active and not scheduled to cancel
    // If cancel_at_period_end is false or undefined, the subscription is already active
    if (
      subscription.cancel_at_period_end === false ||
      subscription.cancel_at_period_end === undefined
    ) {
      // Subscription is already active, return current state
      return {
        id: subscription.id,
        status: "active",
        plan: subscription.product_id || "unknown",
        currency: subscription.currency?.toUpperCase() || "USD",
        provider: this.name,
      };
    }

    // Resume by setting cancel_at_period_end to false
    // This works if the subscription is scheduled to cancel (cancel_at_period_end is true)
    try {
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
    } catch (error) {
      // Handle 410 error specifically
      if (error instanceof Error && error.message.includes("410")) {
        throw new Error(
          `Cannot resume subscription ${subscriptionId}: subscription is no longer available for resuming. ` +
            `This typically means the subscription was permanently cancelled or is in a state that cannot be resumed.`
        );
      }
      throw error;
    }
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
