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
 * Registers a handler for subscription update events
 *
 * @param handler - Function to call when subscription is updated
 *
 * @example
 * ```ts
 * pay.onSubscriptionUpdated((event) => {
 *   console.log('Subscription updated:', event);
 * });
 * ```
 */
export function onSubscriptionUpdated(handler: EventHandler): void {
  if (!handlers.has("subscription.updated")) {
    handlers.set("subscription.updated", []);
  }
  handlers.get("subscription.updated")!.push(handler);
}

/**
 * Registers a handler for subscription deletion events
 *
 * @param handler - Function to call when subscription is deleted
 *
 * @example
 * ```ts
 * pay.onSubscriptionDeleted((event) => {
 *   console.log('Subscription deleted:', event);
 * });
 * ```
 */
export function onSubscriptionDeleted(handler: EventHandler): void {
  if (!handlers.has("subscription.deleted")) {
    handlers.set("subscription.deleted", []);
  }
  handlers.get("subscription.deleted")!.push(handler);
}

/**
 * Registers a handler for subscription pause events
 *
 * @param handler - Function to call when subscription is paused
 *
 * @example
 * ```ts
 * pay.onSubscriptionPaused((event) => {
 *   console.log('Subscription paused:', event);
 * });
 * ```
 */
export function onSubscriptionPaused(handler: EventHandler): void {
  if (!handlers.has("subscription.paused")) {
    handlers.set("subscription.paused", []);
  }
  handlers.get("subscription.paused")!.push(handler);
}

/**
 * Registers a handler for subscription resume events
 *
 * @param handler - Function to call when subscription is resumed
 *
 * @example
 * ```ts
 * pay.onSubscriptionResumed((event) => {
 *   console.log('Subscription resumed:', event);
 * });
 * ```
 */
export function onSubscriptionResumed(handler: EventHandler): void {
  if (!handlers.has("subscription.resumed")) {
    handlers.set("subscription.resumed", []);
  }
  handlers.get("subscription.resumed")!.push(handler);
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
  const providerName = getProviderFromRequest(req);
  const provider = getProvider();

  let rawEvent: unknown;
  let rawPayload: string | Buffer;

  if ("json" in req && typeof req.json === "function") {
    rawEvent = await req.json();
    rawPayload = JSON.stringify(rawEvent);
  } else if ("body" in req) {
    rawEvent = req.body;
    if ("rawBody" in req && typeof (req as any).rawBody === "string") {
      rawPayload = (req as any).rawBody;
    } else if (typeof req.body === "string") {
      rawPayload = req.body;
    } else {
      rawPayload = Buffer.from(JSON.stringify(req.body));
    }
  } else {
    throw new Error("Invalid webhook request: missing body or json method");
  }

  const signature = getSignatureFromRequest(req, providerName);
  const allHeaders = extractAllHeaders(req);
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

  const normalizedEvent = normalizeEvent(providerName, rawEvent);
  const eventHandlers = handlers.get(normalizedEvent.type) || [];

  Promise.all(
    eventHandlers.map(async (handler) => {
      try {
        await handler(normalizedEvent);
      } catch (error) {
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

  return {
    status: 200,
    body: { received: true },
  };
}

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
  const envProvider = process.env.PAYLAYER_PROVIDER;
  if (envProvider) {
    return envProvider;
  }

  const headers = "headers" in req ? req.headers : {};
  if (Array.isArray(headers)) {
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

  return "mock";
}

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
    for (const [key, value] of headers as [string, string][]) {
      normalized[key.toLowerCase()] = value;
    }
  } else {
    const headerObj = headers as Record<string, string>;
    for (const key in headerObj) {
      normalized[key.toLowerCase()] = headerObj[key];
    }
  }

  return normalized;
}

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
    paypal: "paypal-transmission-sig",
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

function getWebhookSecret(providerName: Provider): string {
  const secretEnvVars: Record<string, string> = {
    stripe: "STRIPE_WEBHOOK_SECRET",
    paddle: "PADDLE_WEBHOOK_SECRET",
    paypal: "PAYPAL_WEBHOOK_ID",
    lemonsqueezy: "LEMONSQUEEZY_WEBHOOK_SECRET",
    polar: "POLAR_WEBHOOK_SECRET",
  };

  const envVar = secretEnvVars[providerName.toLowerCase()];
  return envVar ? process.env[envVar] || "" : "";
}
