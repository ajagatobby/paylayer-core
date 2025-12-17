export type Currency = string; // ISO 4217 currency code (e.g., 'USD', 'EUR')

export type Provider = string; // Payment provider identifier

export interface ChargeInput {
  amount: number;
  currency: Currency;
  email?: string;
}

export interface ChargeResult {
  id: string;
  status: "pending" | "succeeded" | "failed";
  amount: number;
  currency: Currency;
  provider: Provider;
  email?: string;
}

export interface SubscribeInput {
  plan: string;
  currency: Currency;
  email?: string;
}

export interface SubscriptionResult {
  id: string;
  status: "active" | "paused" | "cancelled" | "past_due";
  plan: string;
  currency: Currency;
  provider: Provider;
  email?: string;
}

export type EventType =
  | "payment.success"
  | "payment.failed"
  | "subscription.created"
  | "subscription.cancelled"
  | "subscription.paused"
  | "subscription.resumed";

export interface NormalizedEvent {
  type: EventType;
  amount?: number;
  currency?: Currency;
  email?: string;
  provider: Provider;
  subscriptionId?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}

export type EventHandler = (event: NormalizedEvent) => void | Promise<void>;
