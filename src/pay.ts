import type {
  ChargeInput,
  ChargeResult,
  SubscribeInput,
  SubscriptionResult,
  CheckoutInput,
  CheckoutResult,
} from "./types.js";
import { getProvider } from "./providers/factory.js";

/**
 * Creates a one-time payment charge
 *
 * @param input - Charge parameters (amount or priceId, currency, optional email)
 * @returns Promise resolving to charge result
 *
 * @example
 * ```ts
 * // Using amount
 * const result = await pay.charge({
 *   amount: 29.99,
 *   currency: 'USD',
 *   email: 'customer@example.com'
 * });
 *
 * // Using price ID
 * const result = await pay.charge({
 *   priceId: 'price_1234567890',
 *   currency: 'USD',
 *   email: 'customer@example.com'
 * });
 * ```
 */
async function charge(input: ChargeInput): Promise<ChargeResult> {
  if (!input.amount && !input.priceId && !input.productId) {
    throw new Error("Either amount, priceId, or productId must be provided");
  }
  if (input.amount && input.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (!input.currency) {
    throw new Error("Currency is required");
  }

  const provider = getProvider();
  return provider.charge(input);
}

/**
 * Creates a subscription
 *
 * @param input - Subscription parameters (plan, currency, optional email)
 * @returns Promise resolving to subscription result
 *
 * @example
 * ```ts
 * const subscription = await pay.subscribe({
 *   plan: 'pro-monthly',
 *   currency: 'USD',
 *   email: 'customer@example.com'
 * });
 * ```
 */
async function subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
  if (!input.plan) {
    throw new Error("Plan is required");
  }
  if (!input.currency) {
    throw new Error("Currency is required");
  }

  const provider = getProvider();
  return provider.subscribe(input);
}

/**
 * Cancels a subscription
 *
 * @param subscriptionId - The subscription ID to cancel
 * @returns Promise resolving to updated subscription result
 *
 * @example
 * ```ts
 * const cancelled = await pay.cancel('sub_123456');
 * ```
 */
async function cancel(subscriptionId: string): Promise<SubscriptionResult> {
  if (!subscriptionId) {
    throw new Error("Subscription ID is required");
  }

  const provider = getProvider();
  return provider.cancel(subscriptionId);
}

/**
 * Pauses a subscription
 *
 * @param subscriptionId - The subscription ID to pause
 * @returns Promise resolving to updated subscription result
 *
 * @example
 * ```ts
 * const paused = await pay.pause('sub_123456');
 * ```
 */
async function pause(subscriptionId: string): Promise<SubscriptionResult> {
  if (!subscriptionId) {
    throw new Error("Subscription ID is required");
  }

  const provider = getProvider();
  return provider.pause(subscriptionId);
}

/**
 * Resumes a paused subscription
 *
 * @param subscriptionId - The subscription ID to resume
 * @returns Promise resolving to updated subscription result
 *
 * @example
 * ```ts
 * const resumed = await pay.resume('sub_123456');
 * ```
 */
async function resume(subscriptionId: string): Promise<SubscriptionResult> {
  if (!subscriptionId) {
    throw new Error("Subscription ID is required");
  }

  const provider = getProvider();
  return provider.resume(subscriptionId);
}

/**
 * Generates a billing portal URL for customer self-service
 *
 * @param input - Portal parameters (email)
 * @returns Promise resolving to billing portal URL
 *
 * @example
 * ```ts
 * const url = await pay.portal({ email: 'customer@example.com' });
 * // Redirect user to url
 * ```
 */
async function portal(input: { email: string }): Promise<string> {
  if (!input.email) {
    throw new Error("Email is required for billing portal");
  }

  const provider = getProvider();
  return provider.portal(input.email);
}

/**
 * Creates a checkout session/payment link
 * Returns a URL that can be opened in a browser to complete payment
 *
 * @param input - Checkout parameters (amount or plan, currency, email, URLs)
 * @returns Promise resolving to checkout result with URL
 *
 * @example
 * ```ts
 * // One-time payment
 * const checkout = await pay.checkout({
 *   amount: 29.99,
 *   currency: 'USD',
 *   email: 'customer@example.com',
 *   successUrl: 'https://myapp.com/success',
 *   cancelUrl: 'https://myapp.com/cancel'
 * });
 * // Redirect user to checkout.url
 *
 * // Subscription
 * const checkout = await pay.checkout({
 *   plan: 'pro-monthly',
 *   currency: 'USD',
 *   email: 'customer@example.com',
 *   successUrl: 'https://myapp.com/success',
 *   cancelUrl: 'https://myapp.com/cancel'
 * });
 * ```
 */
async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.currency) {
    throw new Error("Currency is required for checkout");
  }

  const provider = getProvider();
  return provider.checkout(input);
}

export const pay = {
  charge,
  subscribe,
  cancel,
  pause,
  resume,
  portal,
  checkout,
};
