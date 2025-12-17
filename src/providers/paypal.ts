import type { PaymentProvider } from "./types.js";
import type {
  ChargeInput,
  ChargeResult,
  SubscribeInput,
  SubscriptionResult,
  CurrencyCode,
} from "../types.js";
import { isSandbox } from "./env.js";

export class PayPalProvider implements PaymentProvider {
  readonly name = "paypal";
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables are required for PayPal provider"
      );
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl =
      process.env.PAYPAL_BASE_URL ||
      (isSandbox(this.name)
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com");

    // Validate optional but recommended environment variables
    // PAYPAL_RETURN_URL and PAYPAL_CANCEL_URL are required for charge() redirect flow
    // PAYPAL_WEBHOOK_ID is required for webhook verification
    if (
      process.env.NODE_ENV === "production" &&
      (!process.env.PAYPAL_RETURN_URL || !process.env.PAYPAL_CANCEL_URL)
    ) {
      console.warn(
        "PayPal: PAYPAL_RETURN_URL and PAYPAL_CANCEL_URL should be set for production use with charge() method"
      );
    }
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.PAYPAL_WEBHOOK_ID
    ) {
      console.warn(
        "PayPal: PAYPAL_WEBHOOK_ID should be set for production webhook verification"
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get new access token
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64"
    );
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal auth error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 60s early

    return this.accessToken;
  }

  private async request(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        message: "Unknown error",
      }))) as {
        name?: string;
        message?: string;
        debug_id?: string;
        details?: Array<{ field?: string; issue?: string }>;
        information_link?: string;
      };

      // Parse PayPal's structured error format
      const errorMessage = error.message || "Unknown error";
      const errorName = error.name || "UNKNOWN_ERROR";
      const debugId = error.debug_id || "";
      const details = error.details || [];
      const infoLink = error.information_link || "";

      let fullMessage = `PayPal API error: ${response.status} - ${errorName}: ${errorMessage}`;
      if (debugId) {
        fullMessage += ` (debug_id: ${debugId})`;
      }
      if (details.length > 0) {
        const detailMessages = details
          .map((d) => `${d.field || "unknown"}: ${d.issue || "unknown issue"}`)
          .join(", ");
        fullMessage += ` - Details: ${detailMessages}`;
      }
      if (infoLink) {
        fullMessage += ` - More info: ${infoLink}`;
      }

      const errorObj = new Error(fullMessage);
      (errorObj as unknown as { debug_id?: string }).debug_id = debugId;
      (errorObj as unknown as { paypal_error?: typeof error }).paypal_error =
        error;
      throw errorObj;
    }

    return response.json();
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // PayPal uses Orders API for one-time payments
    // Note: PayPal Orders API requires user approval via redirect for most cases
    // This creates an order that will be in CREATED status until user approves
    let amount: number;

    if (input.productId) {
      // Product ID - fetch product and use its price
      // Note: PayPal Catalog API can be used to get product details
      try {
        const product = (await this.request(
          "GET",
          `/v1/catalogs/products/${input.productId}`
        )) as {
          id: string;
          pricing_models?: Array<{
            pricing_tiers?: Array<{
              amount?: { value: string; currency_code: string };
            }>;
          }>;
        };

        // Try to get price from product
        // PayPal product pricing structure can vary, so we'll try to extract it
        if (
          product.pricing_models &&
          product.pricing_models.length > 0 &&
          product.pricing_models[0].pricing_tiers &&
          product.pricing_models[0].pricing_tiers.length > 0 &&
          product.pricing_models[0].pricing_tiers[0].amount
        ) {
          const productAmount = parseFloat(
            product.pricing_models[0].pricing_tiers[0].amount.value
          );
          if (productAmount > 0) {
            amount = productAmount;
          }
        }

        if (!amount) {
          throw new Error(
            `Could not determine price for product "${input.productId}". Please provide amount directly or ensure the product has pricing configured.`
          );
        }
      } catch (error) {
        throw new Error(
          `Failed to fetch product "${input.productId}": ${error instanceof Error ? error.message : "Unknown error"}. Please provide amount directly.`
        );
      }
    } else if (input.amount) {
      amount = input.amount;
    } else {
      throw new Error(
        "PayPal requires either productId or amount for one-time payments. priceId is not supported for charges."
      );
    }

    const returnUrl =
      input.successUrl ||
      process.env.PAYPAL_RETURN_URL ||
      "https://app.example.com/success";
    const cancelUrl =
      input.cancelUrl ||
      process.env.PAYPAL_CANCEL_URL ||
      "https://app.example.com/cancel";

    const order = (await this.request("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: input.currency,
            value: amount.toFixed(2),
          },
          description: `Payment of ${amount} ${input.currency}`,
          payee: input.email
            ? {
                email_address: input.email,
              }
            : undefined,
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    })) as {
      id: string;
      status: string;
      links?: Array<{ href: string; rel: string; method: string }>;
    };

    // Extract approval URL from order links
    const approvalLink = order.links?.find((link) => link.rel === "approve");
    const approvalUrl = approvalLink?.href;

    return {
      id: order.id,
      url: approvalUrl,
      status:
        order.status === "COMPLETED"
          ? "succeeded"
          : order.status === "FAILED" || order.status === "VOIDED"
            ? "failed"
            : "pending", // CREATED and other statuses map to pending
      amount,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  /**
   * Captures a PayPal order after user approval
   * This must be called after the user approves the payment on PayPal
   *
   * @param orderId - The PayPal order ID from the charge() response
   * @returns Promise resolving to charge result with updated status
   */
  async captureOrder(orderId: string): Promise<ChargeResult> {
    const capture = (await this.request(
      "POST",
      `/v2/checkout/orders/${orderId}/capture`,
      {}
    )) as {
      id: string;
      status: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
            amount: { currency_code: string; value: string };
          }>;
        };
      }>;
    };

    // Extract amount and currency from capture response
    const captureData = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const amount = captureData?.amount
      ? parseFloat(captureData.amount.value)
      : 0;
    const currency = (captureData?.amount?.currency_code?.toUpperCase() ||
      "USD") as CurrencyCode;

    return {
      id: capture.id,
      status:
        capture.status === "COMPLETED"
          ? "succeeded"
          : capture.status === "FAILED" || capture.status === "VOIDED"
            ? "failed"
            : "pending",
      amount,
      currency,
      provider: this.name,
    };
  }

  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    if (!input.email) {
      throw new Error("Email is required for PayPal subscriptions");
    }

    // PayPal uses Subscriptions API
    // Plan ID must be pre-configured in PayPal
    const subscription = (await this.request(
      "POST",
      "/v1/billing/subscriptions",
      {
        plan_id: input.plan, // Plan ID must be pre-configured in PayPal
        subscriber: {
          email_address: input.email,
        },
        application_context: {
          brand_name: process.env.PAYPAL_BRAND_NAME || "PayLayer",
          return_url:
            process.env.PAYPAL_RETURN_URL || "https://app.example.com/success",
          cancel_url:
            process.env.PAYPAL_CANCEL_URL || "https://app.example.com/cancel",
        },
      }
    )) as {
      id: string;
      status: string;
      plan_id: string;
      links?: Array<{ href: string; rel: string }>;
    };

    // Extract approval URL from subscription links
    const approvalLink = subscription.links?.find(
      (link) => link.rel === "approve" || link.rel === "approval_url"
    );
    const approvalUrl = approvalLink?.href;

    return {
      id: subscription.id,
      url: approvalUrl,
      status:
        subscription.status === "ACTIVE"
          ? "active"
          : subscription.status === "SUSPENDED"
            ? "paused"
            : subscription.status === "CANCELLED"
              ? "cancelled"
              : "pending",
      plan: subscription.plan_id || input.plan,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    await this.request(
      "POST",
      `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        reason: "User requested cancellation",
      }
    );

    const subscription = (await this.request(
      "GET",
      `/v1/billing/subscriptions/${subscriptionId}`
    )) as {
      id: string;
      status: string;
      plan_id: string;
      billing_info?: {
        outstanding_balance?: {
          currency_code: string;
          value: string;
        };
        last_payment?: {
          amount: {
            currency_code: string;
            value: string;
          };
        };
        cycle_executions?: Array<{
          tenure_type: string;
          sequence: number;
          cycles_completed: number;
          cycles_remaining: number;
          current_pricing_scheme_version?: number;
        }>;
      };
      plan?: {
        payment_preferences?: {
          auto_bill_outstanding?: boolean;
          setup_fee?: {
            currency_code: string;
            value: string;
          };
        };
      };
    };

    // Extract currency from various possible locations
    let currency: CurrencyCode = "USD";
    if (subscription.billing_info?.outstanding_balance?.currency_code) {
      currency =
        subscription.billing_info.outstanding_balance.currency_code.toUpperCase() as CurrencyCode;
    } else if (subscription.billing_info?.last_payment?.amount?.currency_code) {
      currency =
        subscription.billing_info.last_payment.amount.currency_code.toUpperCase() as CurrencyCode;
    } else if (
      subscription.plan?.payment_preferences?.setup_fee?.currency_code
    ) {
      currency =
        subscription.plan.payment_preferences.setup_fee.currency_code.toUpperCase() as CurrencyCode;
    }

    return {
      id: subscription.id,
      status: "cancelled",
      plan: subscription.plan_id || "unknown",
      currency,
      provider: this.name,
    };
  }

  async pause(subscriptionId: string): Promise<SubscriptionResult> {
    await this.request(
      "POST",
      `/v1/billing/subscriptions/${subscriptionId}/suspend`,
      {
        reason: "User requested pause",
      }
    );

    const subscription = (await this.request(
      "GET",
      `/v1/billing/subscriptions/${subscriptionId}`
    )) as {
      id: string;
      status: string;
      plan_id: string;
      billing_info?: {
        outstanding_balance?: {
          currency_code: string;
          value: string;
        };
        last_payment?: {
          amount: {
            currency_code: string;
            value: string;
          };
        };
      };
      plan?: {
        payment_preferences?: {
          setup_fee?: {
            currency_code: string;
            value: string;
          };
        };
      };
    };

    // Extract currency from various possible locations
    let currency: CurrencyCode = "USD";
    if (subscription.billing_info?.outstanding_balance?.currency_code) {
      currency =
        subscription.billing_info.outstanding_balance.currency_code.toUpperCase() as CurrencyCode;
    } else if (subscription.billing_info?.last_payment?.amount?.currency_code) {
      currency =
        subscription.billing_info.last_payment.amount.currency_code.toUpperCase() as CurrencyCode;
    } else if (
      subscription.plan?.payment_preferences?.setup_fee?.currency_code
    ) {
      currency =
        subscription.plan.payment_preferences.setup_fee.currency_code.toUpperCase() as CurrencyCode;
    }

    return {
      id: subscription.id,
      status: "paused",
      plan: subscription.plan_id || "unknown",
      currency,
      provider: this.name,
    };
  }

  async resume(subscriptionId: string): Promise<SubscriptionResult> {
    await this.request(
      "POST",
      `/v1/billing/subscriptions/${subscriptionId}/activate`,
      {
        reason: "User requested resume",
      }
    );

    const subscription = (await this.request(
      "GET",
      `/v1/billing/subscriptions/${subscriptionId}`
    )) as {
      id: string;
      status: string;
      plan_id: string;
      billing_info?: {
        outstanding_balance?: {
          currency_code: string;
          value: string;
        };
        last_payment?: {
          amount: {
            currency_code: string;
            value: string;
          };
        };
      };
      plan?: {
        payment_preferences?: {
          setup_fee?: {
            currency_code: string;
            value: string;
          };
        };
      };
    };

    // Extract currency from various possible locations
    let currency: CurrencyCode = "USD";
    if (subscription.billing_info?.outstanding_balance?.currency_code) {
      currency =
        subscription.billing_info.outstanding_balance.currency_code.toUpperCase() as CurrencyCode;
    } else if (subscription.billing_info?.last_payment?.amount?.currency_code) {
      currency =
        subscription.billing_info.last_payment.amount.currency_code.toUpperCase() as CurrencyCode;
    } else if (
      subscription.plan?.payment_preferences?.setup_fee?.currency_code
    ) {
      currency =
        subscription.plan.payment_preferences.setup_fee.currency_code.toUpperCase() as CurrencyCode;
    }

    return {
      id: subscription.id,
      status: "active",
      plan: subscription.plan_id || "unknown",
      currency,
      provider: this.name,
    };
  }

  async portal(email: string): Promise<string> {
    // PayPal account management URL
    const baseUrl =
      process.env.PAYPAL_PORTAL_BASE_URL || "https://www.paypal.com";
    return `${baseUrl}/myaccount/autopay`;
  }

  async verifyWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string,
    headers?: Record<string, string>
  ): Promise<boolean> {
    // PayPal webhook verification uses PayPal's verification API endpoint
    // This is the recommended approach per PayPal documentation

    if (!signature || !headers) {
      return false;
    }

    // Extract required PayPal headers
    const authAlgo = headers["paypal-auth-algo"] || headers["PAYPAL-AUTH-ALGO"];
    const certUrl = headers["paypal-cert-url"] || headers["PAYPAL-CERT-URL"];
    const transmissionId =
      headers["paypal-transmission-id"] || headers["PAYPAL-TRANSMISSION-ID"];
    const transmissionSig =
      headers["paypal-transmission-sig"] || headers["PAYPAL-TRANSMISSION-SIG"];
    const transmissionTime =
      headers["paypal-transmission-time"] ||
      headers["PAYPAL-TRANSMISSION-TIME"];

    // Validate all required headers are present
    if (
      !authAlgo ||
      !certUrl ||
      !transmissionId ||
      !transmissionSig ||
      !transmissionTime
    ) {
      return false;
    }

    // Get webhook ID from environment (required for verification)
    const webhookId = secret || process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      // eslint-disable-next-line no-console
      console.warn(
        "PAYPAL_WEBHOOK_ID not set. Webhook verification requires webhook ID."
      );
      return false;
    }

    // Parse payload as JSON for verification
    let webhookEvent: unknown;
    try {
      const payloadString =
        typeof payload === "string" ? payload : payload.toString("utf-8");
      webhookEvent = JSON.parse(payloadString);
    } catch {
      return false;
    }

    try {
      // Call PayPal's verification API endpoint
      const token = await this.getAccessToken();
      const verificationResponse = await fetch(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: webhookId,
            webhook_event: webhookEvent,
          }),
        }
      );

      if (!verificationResponse.ok) {
        return false;
      }

      const verificationResult = (await verificationResponse.json()) as {
        verification_status: string;
      };

      return verificationResult.verification_status === "SUCCESS";
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("PayPal webhook verification error:", error);
      return false;
    }
  }

  normalizeWebhookEvent(rawEvent: unknown): unknown {
    const event = rawEvent as {
      id: string;
      event_type: string;
      resource: unknown;
      create_time: string;
    };
    return {
      type: event.event_type,
      id: event.id,
      resource: event.resource,
      create_time: event.create_time,
    };
  }
}
