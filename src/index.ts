import { pay } from "./pay.js";
import {
  onPaymentSuccess,
  onPaymentFailed,
  onSubscriptionCreated,
  onSubscriptionCancelled,
  onSubscriptionUpdated,
  onSubscriptionDeleted,
  onSubscriptionPaused,
  onSubscriptionResumed,
  webhook as processWebhook,
  type WebhookRequest,
} from "./webhooks.js";

export { pay };
export { Currency } from "./types.js";
export type * from "./types.js";
export type { CustomerInfo } from "./types.js";

export const webhook = {
  onPaymentSuccess,
  onPaymentFailed,
  onSubscriptionCreated,
  onSubscriptionCancelled,
  onSubscriptionUpdated,
  onSubscriptionDeleted,
  onSubscriptionPaused,
  onSubscriptionResumed,
  process: processWebhook,
};

export type { WebhookRequest };
