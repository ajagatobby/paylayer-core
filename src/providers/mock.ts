/**
 * Mock provider for testing and development
 */

import type { PaymentProvider } from "./types.js";
import type {
  ChargeInput,
  ChargeResult,
  SubscribeInput,
  SubscriptionResult,
} from "../types.js";

export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  async charge(input: ChargeInput): Promise<ChargeResult> {
    return {
      id: `ch_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async subscribe(input: SubscribeInput): Promise<SubscriptionResult> {
    return {
      id: `sub_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: "active",
      plan: input.plan,
      currency: input.currency,
      provider: this.name,
      email: input.email,
    };
  }

  async cancel(subscriptionId: string): Promise<SubscriptionResult> {
    return {
      id: subscriptionId,
      status: "cancelled",
      plan: "unknown",
      currency: "USD",
      provider: this.name,
    };
  }

  async pause(subscriptionId: string): Promise<SubscriptionResult> {
    return {
      id: subscriptionId,
      status: "paused",
      plan: "unknown",
      currency: "USD",
      provider: this.name,
    };
  }

  async resume(subscriptionId: string): Promise<SubscriptionResult> {
    return {
      id: subscriptionId,
      status: "active",
      plan: "unknown",
      currency: "USD",
      provider: this.name,
    };
  }

  async portal(email: string): Promise<string> {
    const baseUrl =
      process.env.PAYLAYER_PORTAL_BASE_URL || "https://portal.paylayer.com";
    return `${baseUrl}/customer/${encodeURIComponent(email)}?provider=${this.name}`;
  }

  verifyWebhook(): boolean {
    return true; // Mock always verifies
  }

  normalizeWebhookEvent(rawEvent: unknown): unknown {
    return rawEvent;
  }
}
