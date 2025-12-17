/**
 * Provider factory - creates provider instances based on environment configuration
 */

import type { PaymentProvider } from "./types.js";
import { StripeProvider } from "./stripe.js";
import { PaddleProvider } from "./paddle.js";
import { PayPalProvider } from "./paypal.js";
import { LemonSqueezyProvider } from "./lemonsqueezy.js";
import { PolarProvider } from "./polar.js";
import { MockProvider } from "./mock.js";

let cachedProvider: PaymentProvider | null = null;

/**
 * Gets the configured payment provider instance
 * Uses singleton pattern to cache the provider
 */
export function getProvider(): PaymentProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = process.env.PAYLAYER_PROVIDER || "mock";

  switch (providerName.toLowerCase()) {
    case "stripe":
      cachedProvider = new StripeProvider();
      break;
    case "paddle":
      cachedProvider = new PaddleProvider();
      break;
    case "paypal":
      cachedProvider = new PayPalProvider();
      break;
    case "lemonsqueezy":
    case "lemon-squeezy":
      cachedProvider = new LemonSqueezyProvider();
      break;
    case "polar":
    case "polar.sh":
      cachedProvider = new PolarProvider();
      break;
    case "mock":
    default:
      cachedProvider = new MockProvider();
      break;
  }

  return cachedProvider;
}

/**
 * Resets the cached provider (useful for testing)
 */
export function resetProvider(): void {
  cachedProvider = null;
}
