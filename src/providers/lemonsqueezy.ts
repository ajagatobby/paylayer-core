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

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Unknown error" }));
        throw new Error(
          `Lemon Squeezy API error: ${response.status} - ${JSON.stringify(error)}`
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle AbortController timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Lemon Squeezy API request timed out after 30 seconds. Please check your network connection and try again.`
        );
      }

      // Handle network-level errors (connection timeouts, DNS failures, etc.)
      if (error instanceof Error) {
        // Check for AggregateError (common in Node.js fetch/undici)
        if (error.name === "AggregateError" && "errors" in error) {
          const aggregateError = error as Error & {
            errors?: unknown[];
            code?: string;
          };
          const errors = aggregateError.errors || [];
          const errorCodes = new Set<string>();

          // Extract error codes from nested errors
          for (const nestedError of errors) {
            if (
              nestedError &&
              typeof nestedError === "object" &&
              "code" in nestedError
            ) {
              errorCodes.add(String(nestedError.code));
            }
          }

          // Check for common network error codes
          if (
            errorCodes.has("ETIMEDOUT") ||
            aggregateError.code === "ETIMEDOUT"
          ) {
            throw new Error(
              `Lemon Squeezy API connection timed out. This usually indicates:\n` +
                `  1. Network connectivity issues\n` +
                `  2. The API endpoint (${url}) is unreachable\n` +
                `  3. Firewall or proxy blocking the connection\n` +
                `  4. DNS resolution problems\n\n` +
                `Please verify:\n` +
                `  - Your internet connection is working\n` +
                `  - The LEMONSQUEEZY_BASE_URL is correct (currently: ${this.baseUrl})\n` +
                `  - No firewall/proxy is blocking outbound HTTPS connections\n` +
                `  - Try accessing ${this.baseUrl} in your browser to verify it's reachable`
            );
          }

          if (
            errorCodes.has("ECONNREFUSED") ||
            aggregateError.code === "ECONNREFUSED"
          ) {
            throw new Error(
              `Lemon Squeezy API connection refused. The server at ${url} is not accepting connections.\n` +
                `Please verify the LEMONSQUEEZY_BASE_URL is correct (currently: ${this.baseUrl})`
            );
          }

          if (
            errorCodes.has("ENOTFOUND") ||
            aggregateError.code === "ENOTFOUND"
          ) {
            throw new Error(
              `Lemon Squeezy API hostname not found. DNS resolution failed for ${this.baseUrl}.\n` +
                `Please verify:\n` +
                `  - Your DNS settings are correct\n` +
                `  - The LEMONSQUEEZY_BASE_URL is correct (currently: ${this.baseUrl})\n` +
                `  - You have internet connectivity`
            );
          }

          // Generic AggregateError handling
          throw new Error(
            `Lemon Squeezy API network error: ${error.message}\n` +
              `This may indicate connectivity issues. Please check your network connection and try again.\n` +
              `Request URL: ${url}`
          );
        }

        // Handle individual network error codes
        if ("code" in error) {
          const errorCode = (error as Error & { code?: string }).code;

          if (errorCode === "ETIMEDOUT") {
            throw new Error(
              `Lemon Squeezy API connection timed out. Please check your network connection.\n` +
                `Request URL: ${url}`
            );
          }

          if (errorCode === "ECONNREFUSED") {
            throw new Error(
              `Lemon Squeezy API connection refused. The server is not accepting connections.\n` +
                `Request URL: ${url}`
            );
          }

          if (errorCode === "ENOTFOUND") {
            throw new Error(
              `Lemon Squeezy API hostname not found. DNS resolution failed.\n` +
                `Request URL: ${url}`
            );
          }
        }

        // Check if error message contains timeout-related keywords
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out")
        ) {
          throw new Error(
            `Lemon Squeezy API request timed out: ${error.message}\n` +
              `This usually indicates network connectivity issues. Please check your connection and try again.\n` +
              `Request URL: ${url}`
          );
        }

        // Check if error message contains fetch failed
        if (errorMessage.includes("fetch failed")) {
          throw new Error(
            `Lemon Squeezy API request failed: ${error.message}\n` +
              `This usually indicates a network connectivity issue. Please verify:\n` +
              `  - Your internet connection is working\n` +
              `  - The API endpoint is reachable: ${url}\n` +
              `  - No firewall or proxy is blocking the connection`
          );
        }
      }

      // Re-throw if we couldn't categorize the error
      throw error;
    }
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Lemon Squeezy uses checkouts for one-time payments
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!storeId) {
      throw new Error("LEMONSQUEEZY_STORE_ID is required for charges");
    }

    let variantId: string;

    if (input.productId) {
      // Product ID - fetch variants for this product
      // Lemon Squeezy API: filter variants by product_id
      // URL encode the product ID to handle special characters
      const encodedProductId = encodeURIComponent(input.productId);
      // Use a shorter timeout for the variants lookup (10 seconds)
      const variantsUrl = `${this.baseUrl}/v1/variants?filter[product_id]=${encodedProductId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(variantsUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: "Unknown error" }));
          throw new Error(
            `Lemon Squeezy API error: ${response.status} - ${JSON.stringify(error)}`
          );
        }

        const variants = (await response.json()) as {
          data?: Array<{ id: string }>;
        };

        if (!variants.data || variants.data.length === 0) {
          throw new Error(
            `No variants found for product "${input.productId}". Please ensure the product has at least one variant configured.`
          );
        }

        variantId = variants.data[0].id;
      } catch (error) {
        clearTimeout(timeoutId);

        // If fetching variants fails, provide a helpful error message
        if (error instanceof Error) {
          // Preserve "No variants found" errors
          if (error.message.includes("No variants found")) {
            throw error;
          }

          // Handle AbortController timeout
          if (error.name === "AbortError") {
            throw new Error(
              `Request to fetch variants for product "${input.productId}" timed out after 10 seconds. ` +
                `This may indicate a network issue or the Lemon Squeezy API is unavailable. ` +
                `Please try using priceId (variant ID) directly instead of productId, or check your network connection.`
            );
          }

          // Handle network-level errors (connection timeouts, DNS failures, etc.)
          if (error.name === "AggregateError" && "errors" in error) {
            const aggregateError = error as Error & {
              errors?: unknown[];
              code?: string;
            };
            const errorCodes = new Set<string>();

            // Extract error codes from nested errors
            for (const nestedError of aggregateError.errors || []) {
              if (
                nestedError &&
                typeof nestedError === "object" &&
                "code" in nestedError
              ) {
                errorCodes.add(String(nestedError.code));
              }
            }

            if (
              errorCodes.has("ETIMEDOUT") ||
              aggregateError.code === "ETIMEDOUT"
            ) {
              throw new Error(
                `Failed to fetch variants for product "${input.productId}": Connection timed out. ` +
                  `This usually indicates network connectivity issues. ` +
                  `Please try using priceId (variant ID) directly instead of productId, or check your network connection.`
              );
            }

            if (
              errorCodes.has("ECONNREFUSED") ||
              aggregateError.code === "ECONNREFUSED"
            ) {
              throw new Error(
                `Failed to fetch variants for product "${input.productId}": Connection refused. ` +
                  `The Lemon Squeezy API server is not accepting connections. ` +
                  `Please verify your network connection and API endpoint configuration.`
              );
            }

            if (
              errorCodes.has("ENOTFOUND") ||
              aggregateError.code === "ENOTFOUND"
            ) {
              throw new Error(
                `Failed to fetch variants for product "${input.productId}": Hostname not found. ` +
                  `DNS resolution failed. Please check your network connection and DNS settings.`
              );
            }
          }

          // Handle individual network error codes
          if ("code" in error) {
            const errorCode = (error as Error & { code?: string }).code;
            if (
              errorCode === "ETIMEDOUT" ||
              errorCode === "ECONNREFUSED" ||
              errorCode === "ENOTFOUND"
            ) {
              throw new Error(
                `Failed to fetch variants for product "${input.productId}": Network error (${errorCode}). ` +
                  `Please try using priceId (variant ID) directly instead of productId, or check your network connection.`
              );
            }
          }

          // Check if error message contains timeout-related keywords
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes("timeout") ||
            errorMessage.includes("timed out") ||
            errorMessage.includes("fetch failed")
          ) {
            throw new Error(
              `Failed to fetch variants for product "${input.productId}": ${error.message}. ` +
                `This usually indicates network connectivity issues. ` +
                `Please try using priceId (variant ID) directly instead of productId, or check your network connection.`
            );
          }
        }

        throw new Error(
          `Failed to fetch variants for product "${input.productId}": ${error instanceof Error ? error.message : "Unknown error"}. ` +
            `Please verify the product ID is correct and you have API access, or use priceId (variant ID) directly instead.`
        );
      }
    } else if (input.priceId) {
      // In Lemon Squeezy, priceId refers to a variant ID
      // Validate that the variant is one-time (not subscription)
      try {
        const variant = (await this.request(
          "GET",
          `/v1/variants/${input.priceId}`
        )) as {
          data: {
            id: string;
            attributes: {
              is_subscription?: boolean;
            };
          };
        };

        // Also check prices to be thorough
        const encodedVariantId = encodeURIComponent(input.priceId);
        const prices = (await this.request(
          "GET",
          `/v1/prices?filter[variant_id]=${encodedVariantId}`
        )) as {
          data?: Array<{
            attributes: {
              category?: string;
            };
          }>;
        };

        const isSubscription =
          variant.data.attributes.is_subscription === true ||
          (prices.data &&
            prices.data.length > 0 &&
            prices.data.some(
              (price) => price.attributes.category === "subscription"
            ));

        if (isSubscription) {
          throw new Error(
            `The variant "${input.priceId}" is configured as a recurring subscription, but you're using it with charge().\n` +
              `To create a one-time payment, please:\n` +
              `1. Go to your Lemon Squeezy Dashboard → Products\n` +
              `2. Create a new variant with one-time pricing (not subscription)\n` +
              `3. Use the new one-time variant ID in charge()\n\n` +
              `Alternatively, if you want a recurring subscription, use pay.subscribe() instead of pay.charge().`
          );
        }
      } catch (error) {
        // If it's our validation error, re-throw it
        if (
          error instanceof Error &&
          error.message.includes("configured as a recurring subscription")
        ) {
          throw error;
        }
        // For other errors (network, invalid variant ID, etc.), let them propagate
        // The API will handle them appropriately
      }

      variantId = input.priceId;
    } else {
      // Only amount provided - use default variant ID from environment
      variantId = process.env.LEMONSQUEEZY_DEFAULT_VARIANT_ID;
      if (!variantId) {
        throw new Error(
          "Either productId or priceId must be provided in input, or LEMONSQUEEZY_DEFAULT_VARIANT_ID environment variable must be set when using only amount. Create a variant in Lemon Squeezy dashboard first."
        );
      }
    }

    // Build checkout attributes
    const customData: Record<string, unknown> = {
      paylayer_provider: this.name,
    };
    if (input.metadata) {
      Object.assign(customData, input.metadata);
    }

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
        custom: customData,
      },
      expires_at: null,
      preview: false,
      test_mode: isSandbox(this.name),
    };

    // If priceId is explicitly provided, use the variant's price (don't override with amount)
    // If productId is provided (without priceId), allow amount to override variant price
    // If only amount is provided (fetched variant from store), allow amount to override variant price
    // Only set custom_price when amount should override the variant price
    if (input.amount && !input.priceId) {
      // Convert amount to cents (Lemon Squeezy uses smallest currency unit)
      const amountInCents = Math.round(input.amount * 100);
      checkoutAttributes.custom_price = amountInCents;
    }
    // If priceId is explicitly provided, we don't set custom_price - the variant's price will be used

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

    // Validate that the variant is configured for subscriptions (not one-time)
    try {
      const variant = (await this.request(
        "GET",
        `/v1/variants/${input.plan}`
      )) as {
        data: {
          id: string;
          attributes: {
            is_subscription?: boolean;
          };
        };
      };

      // Also check prices to be thorough
      const encodedVariantId = encodeURIComponent(input.plan);
      const prices = (await this.request(
        "GET",
        `/v1/prices?filter[variant_id]=${encodedVariantId}`
      )) as {
        data?: Array<{
          attributes: {
            category?: string;
          };
        }>;
      };

      const isSubscription =
        variant.data.attributes.is_subscription === true ||
        (prices.data &&
          prices.data.length > 0 &&
          prices.data.some(
            (price) => price.attributes.category === "subscription"
          ));

      if (!isSubscription) {
        throw new Error(
          `The variant "${input.plan}" is configured as a one-time payment, but you're using it with subscribe().\n` +
            `To create a subscription, please:\n` +
            `1. Go to your Lemon Squeezy Dashboard → Products\n` +
            `2. Create a new variant with subscription pricing enabled\n` +
            `3. Set the renewal interval (monthly, yearly, etc.)\n` +
            `4. Use the new subscription variant ID in subscribe()\n\n` +
            `Alternatively, if you want a one-time payment, use pay.charge() instead of pay.subscribe().`
        );
      }
    } catch (error) {
      // If it's our validation error, re-throw it
      if (
        error instanceof Error &&
        error.message.includes("configured as a one-time payment")
      ) {
        throw error;
      }
      // For other errors (network, invalid variant ID, etc.), let them propagate
      // The API will handle them appropriately
    }

    // Create a checkout for subscription
    const customData: Record<string, unknown> = {
      paylayer_provider: this.name,
      paylayer_plan: input.plan,
    };
    if (input.metadata) {
      Object.assign(customData, input.metadata);
    }

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
            custom: customData,
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
      currency: response.data.attributes.currency?.toUpperCase() || "USD",
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
      currency: response.data.attributes.currency?.toUpperCase() || "USD",
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
