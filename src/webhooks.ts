import type { EventHandler, NormalizedEvent, Provider } from "./types.js";
import { normalizeEvent } from "./events.js";
import { getProvider } from "./providers/factory.js";

// Event handler registry
const handlers: Map<string, EventHandler[]> = new Map();

/**
 * Registers a handler for payment success events
 *
 * @param handler - Function to call when payment succeeds
 *
 * @example
 * ```ts
 * pay.onPaymentSuccess((event) => {
 *   console.log('Payment succeeded:', event);
 * });
 * ```
 */
export function onPaymentSuccess(handler: EventHandler): void {
  if (!handlers.has("payment.success")) {
    handlers.set("payment.success", []);
  }
  handlers.get("payment.success")!.push(handler);
}

/**
 * Registers a handler for payment failure events
 *
 * @param handler - Function to call when payment fails
 *
 * @example
 * ```ts
 * pay.onPaymentFailed((event) => {
 *   console.log('Payment failed:', event);
 * });
 * ```
 */
export function onPaymentFailed(handler: EventHandler): void {
  if (!handlers.has("payment.failed")) {
    handlers.set("payment.failed", []);
  }
  handlers.get("payment.failed")!.push(handler);
}

/**
 * Registers a handler for subscription creation events
 *
 * @param handler - Function to call when subscription is created
 *
 * @example
 * ```ts
 * pay.onSubscriptionCreated((event) => {
 *   console.log('Subscription created:', event);
 * });
 * ```
 */
export function onSubscriptionCreated(handler: EventHandler): void {
  if (!handlers.has("subscription.created")) {
    handlers.set("subscription.created", []);
  }
  handlers.get("subscription.created")!.push(handler);
}

/**
 * Registers a handler for subscription cancellation events
 *
 * @param handler - Function to call when subscription is cancelled
 *
 * @example
 * ```ts
 * pay.onSubscriptionCancelled((event) => {
 *   console.log('Subscription cancelled:', event);
 * });
 * ```
 */
export function onSubscriptionCancelled(handler: EventHandler): void {
  if (!handlers.has("subscription.cancelled")) {
    handlers.set("subscription.cancelled", []);
  }
  handlers.get("subscription.cancelled")!.push(handler);
}

/**
 * Webhook request type - compatible with Express, Fetch API, and other frameworks
 */
export interface WebhookRequest {
  body: unknown;
  headers: Record<string, string> | string[][] | { [key: string]: string };
}

/**
 * Processes a webhook request from a payment provider
 *
 * This function:
 * 1. Verifies the webhook signature using provider-specific verification
 * 2. Normalizes the provider-specific event
 * 3. Triggers registered event handlers
 * 4. Always returns 200 if webhook is accepted
 *
 * @param req - Webhook request (Request object or compatible)
 * @returns Promise resolving to response status and body
 *
 * @example
 * ```ts
 * // Express.js example
 * app.post('/webhooks/paylayer', async (req, res) => {
 *   const result = await pay.webhook(req);
 *   res.status(result.status).json(result.body);
 * });
 * ```
 */
export async function webhook(
  req:
    | WebhookRequest
    | {
        json(): Promise<unknown>;
        headers:
          | Record<string, string>
          | string[][]
          | { [key: string]: string };
      }
): Promise<{ status: number; body: { received: boolean } }> {
  // Get provider from environment or request headers
  const providerName = getProviderFromRequest(req);
  const provider = getProvider();

  // Extract raw event from request body
  let rawEvent: unknown;
  let rawPayload: string | Buffer;

  if ("json" in req && typeof req.json === "function") {
    rawEvent = await req.json();
    // For signature verification, we need the raw body
    // In Express, you'd need to use raw body middleware
    rawPayload = JSON.stringify(rawEvent);
  } else if ("body" in req) {
    rawEvent = req.body;
    rawPayload =
      typeof req.body === "string"
        ? req.body
        : Buffer.from(JSON.stringify(req.body));
  } else {
    throw new Error("Invalid webhook request: missing body or json method");
  }

  // Get signature from headers
  const signature = getSignatureFromRequest(req, providerName);

  // Extract all headers for providers that need them (e.g., PayPal)
  const allHeaders = extractAllHeaders(req);

  // Verify webhook signature using provider-specific verification
  const webhookSecret = getWebhookSecret(providerName);
  if (webhookSecret && signature) {
    const isValid = await provider.verifyWebhook(
      rawPayload,
      signature,
      webhookSecret,
      allHeaders
    );
    if (!isValid) {
      return {
        status: 401,
        body: { received: false },
      };
    }
  }

  // Normalize the event using provider-specific normalization
  const normalizedEvent = normalizeEvent(providerName, rawEvent);

  // Trigger registered handlers for this event type
  const eventHandlers = handlers.get(normalizedEvent.type) || [];

  // Execute all handlers (fire and forget - don't wait for them)
  Promise.all(
    eventHandlers.map(async (handler) => {
      try {
        await handler(normalizedEvent);
      } catch (error) {
        // Log error but don't fail the webhook
        // eslint-disable-next-line no-console
        console.error(
          `Error in webhook handler for ${normalizedEvent.type}:`,
          error
        );
      }
    })
  ).catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Error executing webhook handlers:", error);
  });

  // Always return 200 if webhook is accepted
  return {
    status: 200,
    body: { received: true },
  };
}

/**
 * Gets the provider identifier from the request
 *
 * @param req - Webhook request
 * @returns Provider identifier
 */
function getProviderFromRequest(
  req:
    | WebhookRequest
    | {
        headers:
          | Record<string, string>
          | string[][]
          | { [key: string]: string };
      }
): Provider {
  // Try to get provider from environment first
  const envProvider = process.env.PAYLAYER_PROVIDER;
  if (envProvider) {
    return envProvider;
  }

  // Try to infer from request headers
  const headers = "headers" in req ? req.headers : {};

  // Check for provider-specific headers
  if (Array.isArray(headers)) {
    // Headers as array of tuples
    const headerMap = new Map(headers as [string, string][]);
    if (headerMap.has("stripe-signature")) return "stripe";
    if (headerMap.has("paddle-signature")) return "paddle";
    if (
      headerMap.has("paypal-transmission-sig") ||
      headerMap.has("paypal-transmission-id")
    )
      return "paypal";
    if (headerMap.has("X-Signature")) return "lemonsqueezy";
    if (headerMap.has("x-polar-signature")) return "polar";
  } else {
    // Headers as object
    const headerObj = headers as Record<string, string>;
    const lowerHeaders: Record<string, string> = {};
    for (const key in headerObj) {
      lowerHeaders[key.toLowerCase()] = headerObj[key];
    }
    if (lowerHeaders["stripe-signature"]) return "stripe";
    if (lowerHeaders["paddle-signature"]) return "paddle";
    if (
      lowerHeaders["paypal-transmission-sig"] ||
      lowerHeaders["paypal-transmission-id"]
    )
      return "paypal";
    if (lowerHeaders["x-signature"]) return "lemonsqueezy";
    if (lowerHeaders["x-polar-signature"]) return "polar";
  }

  // Default to mock if no provider detected
  return "mock";
}

/**
 * Extracts all headers from the request as a normalized object
 */
function extractAllHeaders(
  req:
    | WebhookRequest
    | {
        headers:
          | Record<string, string>
          | string[][]
          | { [key: string]: string };
      }
): Record<string, string> {
  const headers = "headers" in req ? req.headers : {};
  const normalized: Record<string, string> = {};

  if (Array.isArray(headers)) {
    // Headers as array of tuples
    for (const [key, value] of headers as [string, string][]) {
      normalized[key.toLowerCase()] = value;
    }
  } else {
    // Headers as object
    const headerObj = headers as Record<string, string>;
    for (const key in headerObj) {
      normalized[key.toLowerCase()] = headerObj[key];
    }
  }

  return normalized;
}

/**
 * Gets the signature from the request headers
 */
function getSignatureFromRequest(
  req:
    | WebhookRequest
    | {
        headers:
          | Record<string, string>
          | string[][]
          | { [key: string]: string };
      },
  providerName: Provider
): string {
  const headers = "headers" in req ? req.headers : {};
  const signatureHeaders: Record<string, string> = {
    stripe: "stripe-signature",
    paddle: "paddle-signature",
    paypal: "paypal-transmission-sig", // PayPal uses PAYPAL-TRANSMISSION-SIG for signature
    lemonsqueezy: "X-Signature",
    polar: "x-polar-signature",
  };

  const headerName = signatureHeaders[providerName.toLowerCase()];
  if (!headerName) {
    return "";
  }

  if (Array.isArray(headers)) {
    const headerMap = new Map(headers as [string, string][]);
    return headerMap.get(headerName) || "";
  } else {
    const headerObj = headers as Record<string, string>;
    const lowerHeaders: Record<string, string> = {};
    for (const key in headerObj) {
      lowerHeaders[key.toLowerCase()] = headerObj[key];
    }
    return lowerHeaders[headerName.toLowerCase()] || "";
  }
}

/**
 * Gets the webhook secret for the provider
 * For PayPal, this returns the webhook ID (not a secret)
 */
function getWebhookSecret(providerName: Provider): string {
  const secretEnvVars: Record<string, string> = {
    stripe: "STRIPE_WEBHOOK_SECRET",
    paddle: "PADDLE_WEBHOOK_SECRET",
    paypal: "PAYPAL_WEBHOOK_ID", // PayPal uses webhook ID, not secret
    lemonsqueezy: "LEMONSQUEEZY_WEBHOOK_SECRET",
    polar: "POLAR_WEBHOOK_SECRET",
  };

  const envVar = secretEnvVars[providerName.toLowerCase()];
  return envVar ? process.env[envVar] || "" : "";
}
