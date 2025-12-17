import { pay } from "./pay.js";
import {
  onPaymentSuccess,
  onPaymentFailed,
  onSubscriptionCreated,
  onSubscriptionCancelled,
  webhook,
} from "./webhooks.js";

// Attach webhook methods to pay object
Object.assign(pay, {
  onPaymentSuccess,
  onPaymentFailed,
  onSubscriptionCreated,
  onSubscriptionCancelled,
  webhook,
});

export { pay };
export type * from "./types.js";
