import type {
  EventType,
  NormalizedEvent,
  Provider,
  CurrencyCode,
} from "./types.js";
import { getProvider } from "./providers/factory.js";

/**
 * Normalizes a provider-specific webhook event to a PayLayer event
 *
 * @param providerName - The payment provider identifier
 * @param rawEvent - The raw webhook event from the provider
 * @returns Normalized PayLayer event
 */
export function normalizeEvent(
  providerName: Provider,
  rawEvent: unknown
): NormalizedEvent {
  // Get the provider instance to use its normalization method
  const provider = getProvider();

  // First, let the provider normalize the event to a common structure
  const providerNormalized = provider.normalizeWebhookEvent(rawEvent);

  // Then, convert to our normalized format
  const event = providerNormalized as Record<string, unknown>;

  // Determine event type from provider event
  let type: EventType = "payment.success";

  // Map provider-specific event types to our normalized types
  const eventType = String(event.type || "").toLowerCase();

  // Stripe event mapping
  if (providerName === "stripe") {
    if (
      eventType.includes("payment_intent.succeeded") ||
      eventType.includes("charge.succeeded")
    ) {
      type = "payment.success";
    } else if (
      eventType.includes("payment_intent.payment_failed") ||
      eventType.includes("charge.failed")
    ) {
      type = "payment.failed";
    } else if (eventType.includes("customer.subscription.created")) {
      type = "subscription.created";
    } else if (
      eventType.includes("customer.subscription.deleted") ||
      eventType.includes("customer.subscription.canceled")
    ) {
      type = "subscription.cancelled";
    } else if (eventType.includes("customer.subscription.paused")) {
      type = "subscription.paused";
    } else if (eventType.includes("customer.subscription.resumed")) {
      type = "subscription.resumed";
    }
  }
  // Paddle event mapping
  else if (providerName === "paddle") {
    if (eventType.includes("transaction.completed")) {
      type = "payment.success";
    } else if (eventType.includes("transaction.failed")) {
      type = "payment.failed";
    } else if (eventType.includes("subscription.created")) {
      type = "subscription.created";
    } else if (
      eventType.includes("subscription.canceled") ||
      eventType.includes("subscription.cancelled")
    ) {
      type = "subscription.cancelled";
    }
  }
  // PayPal event mapping
  else if (providerName === "paypal") {
    if (eventType.includes("payment.capture.completed")) {
      type = "payment.success";
    } else if (eventType.includes("payment.capture.denied")) {
      type = "payment.failed";
    } else if (eventType.includes("billing.subscription.created")) {
      type = "subscription.created";
    } else if (eventType.includes("billing.subscription.cancelled")) {
      type = "subscription.cancelled";
    } else if (eventType.includes("billing.subscription.suspended")) {
      type = "subscription.paused";
    } else if (eventType.includes("billing.subscription.activated")) {
      type = "subscription.resumed";
    }
  }
  // Lemon Squeezy event mapping
  else if (providerName === "lemonsqueezy") {
    if (
      eventType.includes("order_created") ||
      eventType.includes("subscription_payment_success")
    ) {
      type = "payment.success";
    } else if (eventType.includes("subscription_payment_failed")) {
      type = "payment.failed";
    } else if (eventType.includes("subscription_created")) {
      type = "subscription.created";
    } else if (
      eventType.includes("subscription_cancelled") ||
      eventType.includes("subscription_canceled")
    ) {
      type = "subscription.cancelled";
    } else if (eventType.includes("subscription_paused")) {
      type = "subscription.paused";
    } else if (
      eventType.includes("subscription_unpaused") ||
      eventType.includes("subscription_resumed")
    ) {
      type = "subscription.resumed";
    } else if (eventType.includes("subscription_expired")) {
      type = "subscription.cancelled";
    }
  }
  // Polar event mapping
  else if (providerName === "polar") {
    if (
      eventType.includes("checkout.completed") ||
      (eventType.includes("checkout.updated") &&
        (event.data as { status?: string })?.status === "completed")
    ) {
      type = "payment.success";
    } else if (
      eventType.includes("checkout.failed") ||
      (eventType.includes("checkout.updated") &&
        (event.data as { status?: string })?.status === "failed")
    ) {
      type = "payment.failed";
    } else if (eventType.includes("subscription.created")) {
      type = "subscription.created";
    } else if (
      eventType.includes("subscription.cancelled") ||
      eventType.includes("subscription.canceled")
    ) {
      type = "subscription.cancelled";
    } else if (
      eventType.includes("subscription.updated") &&
      (event.data as { cancel_at_period_end?: boolean })
        ?.cancel_at_period_end === true
    ) {
      type = "subscription.paused";
    } else if (
      eventType.includes("subscription.updated") &&
      (event.data as { cancel_at_period_end?: boolean })
        ?.cancel_at_period_end === false &&
      (event.data as { status?: string })?.status === "active"
    ) {
      type = "subscription.resumed";
    }
  }
  // Fallback for generic event types
  else {
    if (eventType.includes("subscription.created")) {
      type = "subscription.created";
    } else if (
      eventType.includes("subscription.cancelled") ||
      eventType.includes("subscription.canceled")
    ) {
      type = "subscription.cancelled";
    } else if (eventType.includes("subscription.paused")) {
      type = "subscription.paused";
    } else if (eventType.includes("subscription.resumed")) {
      type = "subscription.resumed";
    } else if (
      eventType.includes("payment.failed") ||
      eventType.includes("charge.failed")
    ) {
      type = "payment.failed";
    } else if (
      eventType.includes("payment.success") ||
      eventType.includes("charge.succeeded")
    ) {
      type = "payment.success";
    }
  }

  // Extract data from provider-specific event structure
  let amount: number | undefined;
  let currency: CurrencyCode | undefined;
  let email: string | undefined;
  let subscriptionId: string | undefined;
  let paymentId: string | undefined;

  // Extract from Stripe event
  if (providerName === "stripe" && event.data) {
    const data = (event.data as { object: Record<string, unknown> }).object;
    amount = typeof data.amount === "number" ? data.amount / 100 : undefined; // Stripe uses cents
    currency =
      typeof data.currency === "string"
        ? (data.currency.toUpperCase() as CurrencyCode)
        : undefined;
    email =
      typeof data.customer_email === "string" ? data.customer_email : undefined;
    subscriptionId =
      typeof data.subscription === "string" ? data.subscription : undefined;
    paymentId = typeof data.id === "string" ? data.id : undefined;
  }
  // Extract from Paddle event
  else if (providerName === "paddle" && event.data) {
    const data = event.data as Record<string, unknown>;
    amount = typeof data.amount === "number" ? data.amount : undefined;
    currency =
      typeof data.currency_code === "string"
        ? (data.currency_code.toUpperCase() as CurrencyCode)
        : undefined;
    email =
      typeof data.customer_email === "string" ? data.customer_email : undefined;
    subscriptionId =
      typeof data.subscription_id === "string"
        ? data.subscription_id
        : undefined;
    paymentId = typeof data.id === "string" ? data.id : undefined;
  }
  // Extract from PayPal event
  else if (providerName === "paypal" && event.resource) {
    const resource = event.resource as Record<string, unknown>;
    amount =
      typeof resource.amount === "object" && resource.amount !== null
        ? typeof (resource.amount as { value: unknown }).value === "string"
          ? parseFloat((resource.amount as { value: string }).value)
          : undefined
        : undefined;
    currency =
      typeof resource.amount === "object" && resource.amount !== null
        ? typeof (resource.amount as { currency_code: unknown })
            .currency_code === "string"
          ? ((
              resource.amount as { currency_code: string }
            ).currency_code.toUpperCase() as CurrencyCode)
          : undefined
        : undefined;
    subscriptionId = typeof resource.id === "string" ? resource.id : undefined;
  }
  // Extract from Polar event
  else if (providerName === "polar" && event.data) {
    const data = event.data as Record<string, unknown>;
    // Polar amounts are in cents, convert to dollars
    amount =
      typeof data.price_amount === "number"
        ? data.price_amount / 100
        : typeof data.amount === "number"
          ? data.amount / 100
          : undefined;
    currency =
      typeof data.price_currency === "string"
        ? (data.price_currency.toUpperCase() as CurrencyCode)
        : typeof data.currency === "string"
          ? (data.currency.toUpperCase() as CurrencyCode)
          : undefined;
    email =
      typeof data.customer_email === "string"
        ? data.customer_email
        : typeof (data.customer as { email?: string })?.email === "string"
          ? (data.customer as { email: string }).email
          : undefined;
    subscriptionId =
      typeof data.subscription_id === "string"
        ? data.subscription_id
        : typeof data.id === "string" && eventType.includes("subscription")
          ? data.id
          : undefined;
    paymentId =
      typeof data.checkout_id === "string"
        ? data.checkout_id
        : typeof data.id === "string" && eventType.includes("checkout")
          ? data.id
          : undefined;
  }
  // Extract from Lemon Squeezy event
  else if (providerName === "lemonsqueezy" && event.data) {
    const data = event.data as {
      type?: string;
      id?: string;
      attributes?: Record<string, unknown>;
    };
    const attributes = data.attributes || {};

    // Lemon Squeezy amounts are in cents, convert to dollars
    amount =
      typeof attributes.total === "number"
        ? attributes.total / 100
        : typeof attributes.subtotal === "number"
          ? attributes.subtotal / 100
          : undefined;

    currency =
      typeof attributes.currency === "string"
        ? (attributes.currency.toUpperCase() as CurrencyCode)
        : undefined;

    email =
      typeof attributes.user_email === "string"
        ? attributes.user_email
        : typeof attributes.customer_email === "string"
          ? attributes.customer_email
          : undefined;

    // Subscription ID: use data.id if type is "subscriptions", or from attributes
    subscriptionId =
      data.type === "subscriptions" && typeof data.id === "string"
        ? data.id
        : typeof attributes.subscription_id === "string"
          ? attributes.subscription_id
          : undefined;

    // Payment ID: use data.id for orders, or order_id from attributes
    paymentId =
      data.type === "orders" && typeof data.id === "string"
        ? data.id
        : typeof attributes.order_id === "string"
          ? String(attributes.order_id)
          : undefined;
  }
  // Generic extraction
  else {
    amount = typeof event.amount === "number" ? event.amount : undefined;
    currency =
      typeof event.currency === "string"
        ? (event.currency.toUpperCase() as CurrencyCode)
        : undefined;
    email = typeof event.email === "string" ? event.email : undefined;
    subscriptionId =
      typeof event.subscriptionId === "string"
        ? event.subscriptionId
        : undefined;
    paymentId =
      typeof event.paymentId === "string" ? event.paymentId : undefined;
  }

  return {
    type,
    amount,
    currency,
    email,
    provider: providerName,
    subscriptionId,
    paymentId,
    metadata:
      typeof event.metadata === "object" && event.metadata !== null
        ? (event.metadata as Record<string, unknown>)
        : typeof event.custom_data === "object" && event.custom_data !== null
          ? (event.custom_data as Record<string, unknown>)
          : undefined,
  };
}
