/**
 * Lemon Squeezy provider implementation
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

export class LemonSqueezyProvider implements PaymentProvider {
  readonly name = "lemonsqueezy";
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "LEMONSQUEEZY_API_KEY environment variable is required for Lemon Squeezy provider"
      );
    }
    this.apiKey = apiKey;
    this.baseUrl =
      process.env.LEMONSQUEEZY_BASE_URL || "https://api.lemonsqueezy.com";
  }

  private async request(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(
        `Lemon Squeezy API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Lemon Squeezy uses checkouts for one-time payments
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!storeId) {
      throw new Error("LEMONSQUEEZY_STORE_ID is required for charges");
    }

    let variantId: string;

    if (input.productId) {
      // Product ID - fetch product and use its first variant
      const product = (await this.request(
        "GET",
        `/v1/products/${input.productId}`
      )) as {
        data: {
          id: string;
          attributes: {
            variants?: {
              data?: Array<{ id: string }>;
            };
          };
        };
      };

      if (
        !product.data.attributes.variants ||
        !product.data.attributes.variants.data ||
        product.data.attributes.variants.data.length === 0
      ) {
        throw new Error(
          `No variants found for product "${input.productId}". Please ensure the product has at least one variant configured.`
        );
      }

      variantId = product.data.attributes.variants.data[0].id;
    } else {
      // Prioritize input.priceId over environment variable
      // In Lemon Squeezy, priceId refers to a variant ID
      variantId = input.priceId || process.env.LEMONSQUEEZY_DEFAULT_VARIANT_ID;
      if (!variantId) {
        throw new Error(
          "Either productId, priceId must be provided in input or LEMONSQUEEZY_DEFAULT_VARIANT_ID environment variable must be set. Create a variant in Lemon Squeezy dashboard first."
        );
      }
    }

    // Build checkout attributes
    const checkoutAttributes: Record<string, unknown> = {
      product_options: {
        name: "One-time Payment",
        description: input.amount
          ? `Payment of ${input.amount} ${input.currency}`
          : `Payment in ${input.currency}`,
      },
      checkout_options: {
        embed: false,
        media: false,
        logo: false,
      },
      checkout_data: {
        email: input.email,
        custom: {
          paylayer_provider: this.name,
        },
      },
      expires_at: null,
      preview: false,
      test_mode: isSandbox(this.name),
    };

    // If amount is provided, use custom_price (overrides variant price)
    // If only priceId is provided, use the variant's default price
    if (input.amount) {
      // Convert amount to cents (Lemon Squeezy uses smallest currency unit)
      const amountInCents = Math.round(input.amount * 100);
      checkoutAttributes.custom_price = amountInCents;
    }

    const response = (await this.request("POST", "/v1/checkouts", {
      data: {
        type: "checkouts",
        attributes: checkoutAttributes,
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
      },
    })) as {
      data: {
        id: string;
        attributes: {
          status?: string;
          url: string;
        };
      };
    };

    // Checkouts are created in pending state until completed
    // Status may not be present in initial response, default to pending
    const checkoutStatus = response.data.attributes.status || "pending";
    const checkoutUrl = response.data.attributes.url;

    return {
      id: response.data.id,
      url: checkoutUrl,
      status:
        checkoutStatus === "paid" || checkoutStatus === "completed"
          ? "succeeded"
          : checkoutStatus === "pending"
            ? "pending"
            : "pending",
      amount: input.amount || 0, // Will be updated from checkout if using variant price
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    if (!input.email) {
      throw new Error("Email is required for Lemon Squeezy subscriptions");
    }

    // Lemon Squeezy uses subscriptions
    // The plan should be a variant ID with subscription pricing
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!storeId) {
      throw new Error("LEMONSQUEEZY_STORE_ID is required for subscriptions");
    }

    // Create a checkout for subscription
    const response = (await this.request("POST", "/v1/checkouts", {
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            name: input.plan,
          },
          checkout_options: {
            embed: false,
            media: false,
            logo: false,
          },
          checkout_data: {
            email: input.email,
            custom: {
              paylayer_provider: this.name,
              paylayer_plan: input.plan,
            },
          },
          expires_at: null,
          preview: false,
          test_mode: isSandbox(this.name),
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: input.plan, // Plan must be a Lemon Squeezy variant ID
            },
          },
        },
      },
    })) as {
      data: {
        id: string;
        attributes: {
          status: string;
          url?: string;
        };
      };
    };

    // Extract checkout URL if available
    const checkoutUrl = response.data.attributes.url;

    // Note: In Lemon Squeezy, subscriptions are created after checkout completion
    // This returns the checkout ID - the actual subscription will be created via webhook
    return {
      id: response.data.id,
      url: checkoutUrl,
      status: "pending", // Will be updated via webhook when subscription is created
      plan: input.plan,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    const response = (await this.request(
      "DELETE",
      `/v1/subscriptions/${subscriptionId}`
    )) as {
      data: {
        id: string;
        attributes: {
          status: string;
          variant_id: string;
          currency?: string;
        };
      };
    };

    // Verify the subscription was cancelled
    if (response.data.attributes.status !== "cancelled") {
      throw new Error(
        `Failed to cancel subscription: status is ${response.data.attributes.status}`
      );
    }

    return {
      id: response.data.id,
      status: "cancelled",
      plan: response.data.attributes.variant_id || "unknown",
      currency: response.data.attributes.currency?.toUpperCase() || "USD",
      provider: this.name,
    };
  }

  async pause(subscriptionId: string): Promise<SubscriptionResult> {
    // Lemon Squeezy pause: PATCH with pause object
    // Calculate resume date (30 days from now as default)
    const resumesAt = new Date();
    resumesAt.setDate(resumesAt.getDate() + 30);

    const response = (await this.request(
      "PATCH",
      `/v1/subscriptions/${subscriptionId}`,
      {
        data: {
          type: "subscriptions",
          id: subscriptionId,
          attributes: {
            pause: {
              mode: "free", // Options: "free" or "void"
              resumes_at: resumesAt.toISOString(),
            },
          },
        },
      }
    )) as {
      data: {
        id: string;
        attributes: {
          status: string;
          variant_id: string;
          currency: string;
        };
      };
    };

    return {
      id: response.data.id,
      status: "paused",
      plan: response.data.attributes.variant_id || "unknown",
      currency: response.data.attributes.currency.toUpperCase(),
      provider: this.name,
    };
  }

  async resume(subscriptionId: string): Promise<SubscriptionResult> {
    // Lemon Squeezy resume: PATCH with pause: null and cancelled: false
    const response = (await this.request(
      "PATCH",
      `/v1/subscriptions/${subscriptionId}`,
      {
        data: {
          type: "subscriptions",
          id: subscriptionId,
          attributes: {
            pause: null,
            cancelled: false,
          },
        },
      }
    )) as {
      data: {
        id: string;
        attributes: {
          status: string;
          variant_id: string;
          currency: string;
        };
      };
    };

    return {
      id: response.data.id,
      status: "active",
      plan: response.data.attributes.variant_id || "unknown",
      currency: response.data.attributes.currency.toUpperCase(),
      provider: this.name,
    };
  }

  async portal(email: string): Promise<string> {
    // Lemon Squeezy customer portal - try to get signed URL from API
    // First, try to find customer by email
    try {
      const storeId = process.env.LEMONSQUEEZY_STORE_ID;
      if (storeId) {
        // List customers and filter by email
        const response = (await this.request(
          "GET",
          `/v1/customers?filter[store_id]=${storeId}&filter[email]=${encodeURIComponent(email)}`
        )) as {
          data: Array<{
            id: string;
            attributes: {
              urls?: {
                customer_portal?: string;
              };
            };
          }>;
        };

        // If customer found, use signed URL from customer object
        if (response.data && response.data.length > 0) {
          const customer = response.data[0];
          if (customer.attributes.urls?.customer_portal) {
            return customer.attributes.urls.customer_portal;
          }
        }
      }
    } catch (error) {
      // If API call fails, fall back to unsigned URL
      // eslint-disable-next-line no-console
      console.warn(
        "Failed to retrieve signed customer portal URL, using unsigned URL:",
        error
      );
    }

    // Fallback to unsigned URL using store subdomain
    const storeSubdomain = process.env.LEMONSQUEEZY_STORE_SUBDOMAIN;
    if (storeSubdomain) {
      return `https://${storeSubdomain}.lemonsqueezy.com/billing`;
    }

    // Last resort: use generic billing URL (will require login)
    const baseUrl =
      process.env.LEMONSQUEEZY_PORTAL_BASE_URL ||
      "https://app.lemonsqueezy.com";
    return `${baseUrl}/billing`;
  }

  verifyWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    const webhookSecret =
      secret || process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";
    if (!webhookSecret || !signature) {
      return false;
    }

    // Lemon Squeezy uses HMAC SHA256 for webhook verification
    try {
      const payloadString =
        typeof payload === "string" ? payload : payload.toString("utf-8");

      // Compute HMAC SHA256
      const hmac = createHmac("sha256", webhookSecret);
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
      meta: {
        event_name: string;
        custom_data: unknown;
      };
      data: {
        id: string;
        type: string;
        attributes: unknown;
      };
    };
    return {
      type: event.meta.event_name,
      id: event.data.id,
      data: event.data,
      custom_data: event.meta.custom_data,
    };
  }
}
