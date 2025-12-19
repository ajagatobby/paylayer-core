import type {
  EventType,
  NormalizedEvent,
  Provider,
  CurrencyCode,
  CustomerInfo,
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

  // Keep reference to raw event for Lemon Squeezy to access included resources
  const rawEventObj = rawEvent as {
    meta?: unknown;
    data?: unknown;
    included?: Array<{
      type: string;
      id: string;
      attributes?: Record<string, unknown>;
    }>;
  } | null;

  // Determine event type from provider event
  let type: EventType = "payment.success";

  // Map provider-specific event types to our normalized types
  const eventType = String(event.type || "").toLowerCase();

  // Stripe event mapping
  if (providerName === "stripe") {
    if (
      eventType.includes("payment_intent.succeeded") ||
      eventType.includes("charge.succeeded") ||
      eventType.includes("checkout.session.completed")
    ) {
      type = "payment.success";
    } else if (
      eventType.includes("payment_intent.payment_failed") ||
      eventType.includes("charge.failed")
    ) {
      type = "payment.failed";
    } else if (eventType.includes("customer.subscription.created")) {
      type = "subscription.created";
    } else if (eventType.includes("customer.subscription.updated")) {
      type = "subscription.updated";
    } else if (eventType.includes("customer.subscription.deleted")) {
      type = "subscription.deleted";
    } else if (eventType.includes("customer.subscription.canceled")) {
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
    } else if (eventType.includes("subscription.updated")) {
      type = "subscription.updated";
    } else if (
      eventType.includes("subscription.canceled") ||
      eventType.includes("subscription.cancelled")
    ) {
      type = "subscription.cancelled";
    } else if (eventType.includes("subscription.paused")) {
      type = "subscription.paused";
    } else if (eventType.includes("subscription.resumed")) {
      type = "subscription.resumed";
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
    } else if (eventType.includes("billing.subscription.updated")) {
      type = "subscription.updated";
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
    } else if (eventType.includes("subscription_updated")) {
      type = "subscription.updated";
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
    } else if (eventType.includes("subscription.updated")) {
      type = "subscription.updated";
    }
  }
  // Fallback for generic event types
  else {
    if (eventType.includes("subscription.created")) {
      type = "subscription.created";
    } else if (eventType.includes("subscription.updated")) {
      type = "subscription.updated";
    } else if (eventType.includes("subscription.deleted")) {
      type = "subscription.deleted";
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
  let customerId: string | undefined;
  let customer: CustomerInfo | undefined;
  let status: string | undefined;
  let description: string | undefined;
  let createdAt: string | undefined;
  let plan: string | undefined;
  let productId: string | undefined;

  // Extract from Stripe event
  if (providerName === "stripe" && event.data) {
    const eventData = event.data as { object: Record<string, unknown> };
    const data = eventData.object;

    // Check if this is a subscription object (for customer.subscription.* events)
    // More robust check: subscription events have subscription-specific fields
    const isSubscriptionObject =
      eventType.includes("subscription") &&
      typeof data.id === "string" &&
      (data.items !== undefined ||
        data.plan !== undefined ||
        data.status !== undefined ||
        data.customer !== undefined);

    if (isSubscriptionObject) {
      // Handle subscription object
      subscriptionId = typeof data.id === "string" ? data.id : undefined;

      // Extract customer ID
      if (typeof data.customer === "string" && data.customer !== null) {
        customerId = data.customer;
      } else if (
        data.customer &&
        typeof data.customer === "object" &&
        data.customer !== null
      ) {
        const customerObj = data.customer as Record<string, unknown>;
        customerId =
          typeof customerObj.id === "string" ? customerObj.id : undefined;
        // Extract email from customer object if expanded
        if (typeof customerObj.email === "string") {
          email = customerObj.email;
        }
      }

      // Extract amount and currency from subscription items
      if (data.items && typeof data.items === "object" && data.items !== null) {
        const items = data.items as {
          data?: Array<{
            price?: {
              unit_amount?: number;
              currency?: string;
              id?: string;
              lookup_key?: string;
              product?: string;
            };
          }>;
        };
        if (items.data && Array.isArray(items.data) && items.data.length > 0) {
          const firstItem = items.data[0];
          if (firstItem.price) {
            if (
              typeof firstItem.price.unit_amount === "number" &&
              firstItem.price.unit_amount > 0
            ) {
              amount = firstItem.price.unit_amount / 100; // Stripe uses cents
            }
            if (typeof firstItem.price.currency === "string") {
              currency = firstItem.price.currency.toUpperCase() as CurrencyCode;
            }
            plan =
              typeof firstItem.price.lookup_key === "string"
                ? firstItem.price.lookup_key
                : typeof firstItem.price.id === "string"
                  ? firstItem.price.id
                  : undefined;
            productId =
              typeof firstItem.price.product === "string"
                ? firstItem.price.product
                : undefined;
          }
        }
      }
      // Fallback to plan object if items not available
      else if (data.plan && typeof data.plan === "object") {
        const planObj = data.plan as Record<string, unknown>;
        if (
          typeof planObj.amount === "number" &&
          (planObj.amount as number) > 0
        ) {
          amount = (planObj.amount as number) / 100; // Stripe uses cents
        }
        if (typeof planObj.currency === "string") {
          currency = planObj.currency.toUpperCase() as CurrencyCode;
        }
        plan =
          typeof planObj.lookup_key === "string"
            ? planObj.lookup_key
            : typeof planObj.id === "string"
              ? planObj.id
              : undefined;
        productId =
          typeof planObj.product === "string" ? planObj.product : undefined;
      }
      // Additional fallback: try to get amount from latest_invoice if available
      else if (data.latest_invoice) {
        const latestInvoice =
          typeof data.latest_invoice === "object" &&
          data.latest_invoice !== null
            ? (data.latest_invoice as Record<string, unknown>)
            : null;
        if (latestInvoice) {
          // Try to get amount from invoice amount_due or total
          if (typeof latestInvoice.amount_due === "number") {
            amount = latestInvoice.amount_due / 100;
          } else if (typeof latestInvoice.total === "number") {
            amount = latestInvoice.total / 100;
          }
          // Get currency from invoice
          if (typeof latestInvoice.currency === "string") {
            currency = latestInvoice.currency.toUpperCase() as CurrencyCode;
          }
        }
      }

      // Try to extract email from latest_invoice if customer email not available
      if (!email && data.latest_invoice) {
        const latestInvoice =
          typeof data.latest_invoice === "object" &&
          data.latest_invoice !== null
            ? (data.latest_invoice as Record<string, unknown>)
            : null;
        if (latestInvoice) {
          // Check customer_details in invoice
          if (
            latestInvoice.customer_details &&
            typeof latestInvoice.customer_details === "object"
          ) {
            const customerDetails = latestInvoice.customer_details as Record<
              string,
              unknown
            >;
            if (typeof customerDetails.email === "string") {
              email = customerDetails.email;
            }
          }
          // Check customer_email directly
          if (!email && typeof latestInvoice.customer_email === "string") {
            email = latestInvoice.customer_email;
          }
          // Check if customer is expanded in invoice
          if (!email && latestInvoice.customer) {
            const invoiceCustomer =
              typeof latestInvoice.customer === "object" &&
              latestInvoice.customer !== null
                ? (latestInvoice.customer as Record<string, unknown>)
                : null;
            if (invoiceCustomer && typeof invoiceCustomer.email === "string") {
              email = invoiceCustomer.email;
            }
          }
        }
      }

      // Try to extract email from default_payment_method if available
      if (!email && data.default_payment_method) {
        const paymentMethod =
          typeof data.default_payment_method === "object" &&
          data.default_payment_method !== null
            ? (data.default_payment_method as Record<string, unknown>)
            : null;
        if (paymentMethod) {
          // Check if customer is expanded in payment method
          if (paymentMethod.customer) {
            const pmCustomer =
              typeof paymentMethod.customer === "object" &&
              paymentMethod.customer !== null
                ? (paymentMethod.customer as Record<string, unknown>)
                : null;
            if (pmCustomer && typeof pmCustomer.email === "string") {
              email = pmCustomer.email;
            }
          }
        }
      }

      // Try to extract email from default_source if available (legacy)
      if (!email && data.default_source) {
        const source =
          typeof data.default_source === "object" &&
          data.default_source !== null
            ? (data.default_source as Record<string, unknown>)
            : null;
        if (source) {
          // Check if customer is expanded in source
          if (source.customer) {
            const sourceCustomer =
              typeof source.customer === "object" && source.customer !== null
                ? (source.customer as Record<string, unknown>)
                : null;
            if (sourceCustomer && typeof sourceCustomer.email === "string") {
              email = sourceCustomer.email;
            }
          }
        }
      }

      // Check metadata for email (some integrations store it here)
      if (!email && data.metadata && typeof data.metadata === "object") {
        const metadata = data.metadata as Record<string, unknown>;
        if (typeof metadata.email === "string") {
          email = metadata.email;
        } else if (typeof metadata.customer_email === "string") {
          email = metadata.customer_email;
        }
      }

      // Check pending_setup_intent for customer details (for subscriptions requiring setup)
      if (!email && data.pending_setup_intent) {
        const setupIntent =
          typeof data.pending_setup_intent === "object" &&
          data.pending_setup_intent !== null
            ? (data.pending_setup_intent as Record<string, unknown>)
            : null;
        if (setupIntent) {
          // Check if customer is expanded in setup intent
          if (setupIntent.customer) {
            const siCustomer =
              typeof setupIntent.customer === "object" &&
              setupIntent.customer !== null
                ? (setupIntent.customer as Record<string, unknown>)
                : null;
            if (siCustomer && typeof siCustomer.email === "string") {
              email = siCustomer.email;
            }
          }
        }
      }

      // Check if subscription items have customer details (unlikely but possible)
      if (
        !email &&
        data.items &&
        typeof data.items === "object" &&
        data.items !== null
      ) {
        const items = data.items as {
          data?: Array<{
            subscription?: {
              customer?: {
                email?: string;
              };
            };
          }>;
        };
        if (items.data && Array.isArray(items.data)) {
          for (const item of items.data) {
            if (item.subscription?.customer?.email) {
              email = item.subscription.customer.email;
              break;
            }
          }
        }
      }

      status = typeof data.status === "string" ? data.status : undefined;
      description =
        typeof data.description === "string" ? data.description : undefined;

      // Build customer info
      if (email || customerId) {
        customer = {
          id: customerId,
          email,
        };
      }

      // Extract created timestamp
      if (typeof data.created === "number") {
        createdAt = new Date(data.created * 1000).toISOString();
      } else if (typeof event.created === "number") {
        createdAt = new Date(event.created * 1000).toISOString();
      }
    } else {
      // Handle checkout session, payment intent, or charge objects
      // For Checkout Sessions, amount is in amount_total
      // For PaymentIntents, amount is in amount
      if (typeof data.amount_total === "number") {
        amount = data.amount_total / 100; // Stripe uses cents
      } else if (typeof data.amount === "number") {
        amount = data.amount / 100; // Stripe uses cents
      }

      currency =
        typeof data.currency === "string"
          ? (data.currency.toUpperCase() as CurrencyCode)
          : undefined;

      // Extract customer information
      // For Checkout Sessions: customer ID is in data.customer (can be string or null for guests)
      // For PaymentIntents: customer ID is in data.customer
      // For Charges: customer ID is in data.customer

      // Primary location: data.customer (most common)
      if (typeof data.customer === "string" && data.customer !== null) {
        customerId = data.customer;
      } else if (
        data.customer &&
        typeof data.customer === "object" &&
        data.customer !== null
      ) {
        // Sometimes customer is an object with an id field
        const customerObj = data.customer as Record<string, unknown>;
        customerId =
          typeof customerObj.id === "string" ? customerObj.id : undefined;
      }

      // For Checkout Sessions, check payment_intent.customer (when expanded)
      // payment_intent can be a string ID or an expanded object
      if (!customerId && data.payment_intent) {
        if (
          typeof data.payment_intent === "object" &&
          data.payment_intent !== null
        ) {
          const paymentIntent = data.payment_intent as Record<string, unknown>;
          // Check customer field in payment_intent
          if (typeof paymentIntent.customer === "string") {
            customerId = paymentIntent.customer;
          }
          // Also check if customer is an object with id
          else if (
            paymentIntent.customer &&
            typeof paymentIntent.customer === "object" &&
            paymentIntent.customer !== null
          ) {
            const piCustomer = paymentIntent.customer as Record<
              string,
              unknown
            >;
            if (typeof piCustomer.id === "string") {
              customerId = piCustomer.id;
            }
          }
        }
      }

      // For Checkout Sessions with subscriptions, check subscription.customer
      if (!customerId && data.subscription) {
        if (
          typeof data.subscription === "object" &&
          data.subscription !== null
        ) {
          const subscription = data.subscription as Record<string, unknown>;
          if (typeof subscription.customer === "string") {
            customerId = subscription.customer;
          } else if (
            subscription.customer &&
            typeof subscription.customer === "object" &&
            subscription.customer !== null
          ) {
            const subCustomer = subscription.customer as Record<
              string,
              unknown
            >;
            if (typeof subCustomer.id === "string") {
              customerId = subCustomer.id;
            }
          }
        }
      }

      // For Checkout Sessions with subscriptions, check subscription.customer
      if (!customerId && data.subscription) {
        const subscription =
          typeof data.subscription === "string"
            ? null
            : typeof data.subscription === "object" &&
                data.subscription !== null
              ? (data.subscription as Record<string, unknown>)
              : null;
        if (subscription && typeof subscription.customer === "string") {
          customerId = subscription.customer;
        }
      }

      // For Checkout Sessions, email might be in customer_details or customer_email
      if (typeof data.customer_email === "string") {
        email = data.customer_email;
      } else if (
        data.customer_details &&
        typeof data.customer_details === "object" &&
        data.customer_details !== null
      ) {
        const customerDetails = data.customer_details as Record<
          string,
          unknown
        >;
        email =
          typeof customerDetails.email === "string"
            ? customerDetails.email
            : email;
      }

      // For PaymentIntents, customer might be in payment_method
      if (!customerId && data.payment_method) {
        const paymentMethod =
          typeof data.payment_method === "object" &&
          data.payment_method !== null
            ? (data.payment_method as Record<string, unknown>)
            : null;
        if (paymentMethod && typeof paymentMethod.customer === "string") {
          customerId = paymentMethod.customer;
        }
      }

      // For Charges, check if customer is in the charge object
      if (!customerId && data.charge && typeof data.charge === "object") {
        const chargeObj = data.charge as Record<string, unknown>;
        if (typeof chargeObj.customer === "string") {
          customerId = chargeObj.customer;
        }
      }

      // Build customer info - always create if we have any customer data
      if (email || customerId) {
        customer = {
          id: customerId,
          email,
        };

        // Add customer details if available
        if (
          data.customer_details &&
          typeof data.customer_details === "object" &&
          data.customer_details !== null
        ) {
          const customerDetails = data.customer_details as Record<
            string,
            unknown
          >;

          if (typeof customerDetails.name === "string") {
            customer.name = customerDetails.name;
          }

          if (typeof customerDetails.phone === "string") {
            customer.phone = customerDetails.phone;
          }

          // Extract address if available
          if (
            customerDetails.address &&
            typeof customerDetails.address === "object" &&
            customerDetails.address !== null
          ) {
            const addr = customerDetails.address as Record<string, unknown>;
            customer.address = {
              line1: typeof addr.line1 === "string" ? addr.line1 : undefined,
              line2: typeof addr.line2 === "string" ? addr.line2 : undefined,
              city: typeof addr.city === "string" ? addr.city : undefined,
              state: typeof addr.state === "string" ? addr.state : undefined,
              postalCode:
                typeof addr.postal_code === "string"
                  ? addr.postal_code
                  : typeof addr.postalCode === "string"
                    ? addr.postalCode
                    : undefined,
              country:
                typeof addr.country === "string" ? addr.country : undefined,
            };
          }
        }
      }

      // Extract subscription ID - check multiple possible locations
      if (!subscriptionId) {
        subscriptionId =
          typeof data.subscription === "string" ? data.subscription : undefined;
        // If event type is subscription-related and we have an id, use it as subscriptionId
        if (
          !subscriptionId &&
          eventType.includes("subscription") &&
          typeof data.id === "string"
        ) {
          subscriptionId = data.id;
        }
      }
      paymentId = typeof data.id === "string" ? data.id : undefined;

      status = typeof data.status === "string" ? data.status : undefined;
      description =
        typeof data.description === "string" ? data.description : undefined;

      // Extract plan/product info
      if (data.line_items && Array.isArray(data.line_items)) {
        const lineItem = data.line_items[0] as Record<string, unknown>;
        if (lineItem.price) {
          const price = lineItem.price as Record<string, unknown>;
          plan =
            typeof price.lookup_key === "string"
              ? price.lookup_key
              : typeof price.id === "string"
                ? price.id
                : undefined;
          productId =
            typeof price.product === "string" ? price.product : undefined;
        }
      } else if (data.items && Array.isArray(data.items)) {
        const item = data.items[0] as Record<string, unknown>;
        if (item.price) {
          const price = item.price as Record<string, unknown>;
          plan =
            typeof price.lookup_key === "string"
              ? price.lookup_key
              : typeof price.id === "string"
                ? price.id
                : undefined;
          productId =
            typeof price.product === "string" ? price.product : undefined;
        }
      }

      // Extract created timestamp
      if (typeof event.created === "number") {
        createdAt = new Date(event.created * 1000).toISOString();
      } else if (typeof data.created === "number") {
        createdAt = new Date(data.created * 1000).toISOString();
      }
    }
  }
  // Extract from Paddle event
  else if (providerName === "paddle" && event.data) {
    const data = event.data as Record<string, unknown>;

    // Access raw event to check for included customer/transaction data
    const rawPaddleEvent = rawEvent as {
      data?: unknown;
      included?: Array<{
        type: string;
        id: string;
        attributes?: Record<string, unknown>;
      }>;
    } | null;

    // Check if this is a subscription event
    const isSubscriptionEvent = eventType.includes("subscription");

    // For subscription events, extract from items array first
    if (
      isSubscriptionEvent &&
      data.items &&
      Array.isArray(data.items) &&
      data.items.length > 0
    ) {
      const firstItem = data.items[0] as Record<string, unknown>;

      // Extract amount from price.unit_price.amount (Paddle uses smallest currency unit)
      if (
        firstItem.price &&
        typeof firstItem.price === "object" &&
        firstItem.price !== null
      ) {
        const price = firstItem.price as Record<string, unknown>;
        if (
          price.unit_price &&
          typeof price.unit_price === "object" &&
          price.unit_price !== null
        ) {
          const unitPrice = price.unit_price as Record<string, unknown>;
          if (typeof unitPrice.amount === "string") {
            // Paddle uses smallest currency unit (cents), convert to dollars
            amount = parseFloat(unitPrice.amount) / 100;
          } else if (typeof unitPrice.amount === "number") {
            // Paddle uses smallest currency unit (cents), convert to dollars
            amount = unitPrice.amount / 100;
          }
          if (typeof unitPrice.currency_code === "string") {
            currency = unitPrice.currency_code.toUpperCase() as CurrencyCode;
          }
        }
        // Fallback: check if price has amount/currency directly
        if (!amount && typeof price.amount === "number") {
          // Paddle uses smallest currency unit (cents), convert to dollars
          amount = price.amount / 100;
        }
        if (!currency && typeof price.currency_code === "string") {
          currency = price.currency_code.toUpperCase() as CurrencyCode;
        }
        // Extract plan/product from price
        plan = typeof price.id === "string" ? price.id : undefined;
        productId =
          typeof price.product_id === "string" ? price.product_id : undefined;
      }

      // Extract plan/product from item if not found in price
      if (!plan && typeof firstItem.price_id === "string") {
        plan = firstItem.price_id;
      }
      if (!productId && typeof firstItem.product_id === "string") {
        productId = firstItem.product_id;
      }
    }

    // Fallback to top-level fields if items not available or not subscription event
    if (amount === undefined) {
      // Paddle uses smallest currency unit (cents), convert to dollars
      amount = typeof data.amount === "number" ? data.amount / 100 : undefined;
    }
    if (!currency) {
      currency =
        typeof data.currency_code === "string"
          ? (data.currency_code.toUpperCase() as CurrencyCode)
          : undefined;
    }

    // Extract email - check multiple possible locations
    // Note: Paddle's subscription.created webhook typically doesn't include customer email
    // It only provides customer_id. Email is usually available in transaction events or via API.
    email =
      typeof data.customer_email === "string" ? data.customer_email : undefined;

    // Check if customer is an object with email property
    if (!email && data.customer && typeof data.customer === "object") {
      const customer = data.customer as Record<string, unknown>;
      if (typeof customer.email === "string") {
        email = customer.email;
      }
    }

    // Check transaction object for customer email (Paddle sometimes includes transaction data)
    if (!email && data.transaction && typeof data.transaction === "object") {
      const transaction = data.transaction as Record<string, unknown>;
      if (typeof transaction.customer_email === "string") {
        email = transaction.customer_email;
      }
      // Check if transaction has customer object
      if (
        !email &&
        transaction.customer &&
        typeof transaction.customer === "object"
      ) {
        const txCustomer = transaction.customer as Record<string, unknown>;
        if (typeof txCustomer.email === "string") {
          email = txCustomer.email;
        }
      }
    }

    // Check raw event data structure for customer information
    // Paddle webhooks may have customer data nested in the raw event
    if (!email && rawPaddleEvent?.data) {
      const rawData = rawPaddleEvent.data as Record<string, unknown>;
      // Check if customer is directly in raw data
      if (rawData.customer && typeof rawData.customer === "object") {
        const rawCustomer = rawData.customer as Record<string, unknown>;
        if (typeof rawCustomer.email === "string") {
          email = rawCustomer.email;
        }
      }
      // Check for customer_email in raw data
      if (!email && typeof rawData.customer_email === "string") {
        email = rawData.customer_email;
      }
    }

    // Check raw event included resources for customer data (Paddle may include related objects)
    if (
      !email &&
      rawPaddleEvent?.included &&
      Array.isArray(rawPaddleEvent.included)
    ) {
      for (const resource of rawPaddleEvent.included) {
        if (resource.type === "customer" && resource.attributes) {
          if (typeof resource.attributes.email === "string") {
            email = resource.attributes.email;
            break;
          }
        }
      }
    }

    // Check custom_data for email
    if (!email && data.custom_data && typeof data.custom_data === "object") {
      const customData = data.custom_data as Record<string, unknown>;
      if (typeof customData.email === "string") {
        email = customData.email;
      }
    }

    // Check metadata for email
    if (!email && data.metadata && typeof data.metadata === "object") {
      const metadata = data.metadata as Record<string, unknown>;
      if (typeof metadata.email === "string") {
        email = metadata.email;
      } else if (typeof metadata.customer_email === "string") {
        email = metadata.customer_email;
      }
    }

    // Extract subscription ID - check multiple locations
    subscriptionId =
      typeof data.subscription_id === "string"
        ? data.subscription_id
        : isSubscriptionEvent && typeof data.id === "string"
          ? data.id
          : undefined;

    paymentId = typeof data.id === "string" ? data.id : undefined;
    customerId =
      typeof data.customer_id === "string" ? data.customer_id : undefined;
    status = typeof data.status === "string" ? data.status : undefined;
    description =
      typeof data.description === "string" ? data.description : undefined;

    // Build customer info
    if (email || customerId) {
      customer = {
        id: customerId,
        email,
        name:
          typeof data.customer_name === "string"
            ? data.customer_name
            : undefined,
      };
    }

    // Extract plan/product from top-level if not already extracted
    if (!plan) {
      plan = typeof data.product_id === "string" ? data.product_id : undefined;
    }
    if (!productId) {
      productId = plan;
    }

    // Extract created timestamp
    if (typeof data.created_at === "string") {
      createdAt = data.created_at;
    } else if (typeof data.event_time === "string") {
      createdAt = data.event_time;
    } else if (typeof data.occurred_at === "string") {
      createdAt = data.occurred_at;
    }
  }
  // Extract from PayPal event
  else if (providerName === "paypal" && event.resource) {
    const resource = event.resource as Record<string, unknown>;

    // Check if this is a subscription event
    const isSubscriptionEvent = eventType.includes("billing.subscription");

    subscriptionId = typeof resource.id === "string" ? resource.id : undefined;
    paymentId = subscriptionId;
    status = typeof resource.status === "string" ? resource.status : undefined;
    description =
      typeof resource.description === "string"
        ? resource.description
        : undefined;

    // Extract plan from plan_id (for subscriptions)
    if (isSubscriptionEvent) {
      plan =
        typeof resource.plan_id === "string" ? resource.plan_id : undefined;
      productId = plan;
    }

    // Extract amount and currency
    // For subscriptions, check billing_info.outstanding_balance first
    if (isSubscriptionEvent && resource.billing_info) {
      const billingInfo = resource.billing_info as Record<string, unknown>;
      if (
        billingInfo.outstanding_balance &&
        typeof billingInfo.outstanding_balance === "object"
      ) {
        const outstandingBalance = billingInfo.outstanding_balance as Record<
          string,
          unknown
        >;
        if (typeof outstandingBalance.value === "string") {
          amount = parseFloat(outstandingBalance.value);
        } else if (typeof outstandingBalance.value === "number") {
          amount = outstandingBalance.value;
        }
        if (typeof outstandingBalance.currency_code === "string") {
          currency =
            outstandingBalance.currency_code.toUpperCase() as CurrencyCode;
        }
      }
    }

    // Fallback: extract from resource.amount (for payment events)
    if (amount === undefined) {
      amount =
        typeof resource.amount === "object" && resource.amount !== null
          ? typeof (resource.amount as { value: unknown }).value === "string"
            ? parseFloat((resource.amount as { value: string }).value)
            : undefined
          : undefined;
    }
    if (!currency) {
      currency =
        typeof resource.amount === "object" && resource.amount !== null
          ? typeof (resource.amount as { currency_code: unknown })
              .currency_code === "string"
            ? ((
                resource.amount as { currency_code: string }
              ).currency_code.toUpperCase() as CurrencyCode)
            : undefined
          : undefined;
    }

    // Extract customer info - for subscriptions, check subscriber first
    if (isSubscriptionEvent && resource.subscriber) {
      const subscriber = resource.subscriber as Record<string, unknown>;

      // Extract email from subscriber.email_address
      if (typeof subscriber.email_address === "string") {
        email = subscriber.email_address;
      }

      // Extract name from subscriber.name
      let subscriberName: string | undefined;
      if (subscriber.name && typeof subscriber.name === "object") {
        const name = subscriber.name as Record<string, unknown>;
        const givenName =
          typeof name.given_name === "string" ? name.given_name : undefined;
        const surname =
          typeof name.surname === "string" ? name.surname : undefined;
        if (givenName && surname) {
          subscriberName = `${givenName} ${surname}`;
        } else if (givenName) {
          subscriberName = givenName;
        } else if (surname) {
          subscriberName = surname;
        }
      }

      if (email || subscriberName) {
        customer = {
          email,
          name: subscriberName,
        };
      }
    }

    // Fallback: extract from payer.payer_info (for payment events)
    if (!email && resource.payer) {
      const payer = resource.payer as Record<string, unknown>;
      const payerInfo = payer.payer_info as Record<string, unknown>;
      if (payerInfo) {
        const payerEmail =
          typeof payerInfo.email === "string" ? payerInfo.email : undefined;
        const payerName =
          typeof payerInfo.first_name === "string" &&
          typeof payerInfo.last_name === "string"
            ? `${payerInfo.first_name} ${payerInfo.last_name}`
            : typeof payerInfo.first_name === "string"
              ? payerInfo.first_name
              : undefined;

        if (payerEmail || payerName) {
          customer = {
            email: payerEmail,
            name: payerName,
          };
          email = payerEmail;
        }
      }
    }

    // Extract created timestamp
    // For subscriptions, prefer start_time, then status_update_time, then create_time
    if (isSubscriptionEvent) {
      if (typeof resource.start_time === "string") {
        createdAt = resource.start_time;
      } else if (typeof resource.status_update_time === "string") {
        createdAt = resource.status_update_time;
      } else if (typeof resource.create_time === "string") {
        createdAt = resource.create_time;
      } else if (typeof resource.update_time === "string") {
        createdAt = resource.update_time;
      }
    } else {
      if (typeof resource.create_time === "string") {
        createdAt = resource.create_time;
      } else if (typeof resource.update_time === "string") {
        createdAt = resource.update_time;
      }
    }
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
    status = typeof data.status === "string" ? data.status : undefined;
    description =
      typeof data.description === "string" ? data.description : undefined;

    // Extract customer info
    if (data.customer && typeof data.customer === "object") {
      const customerData = data.customer as Record<string, unknown>;
      customerId =
        typeof customerData.id === "string" ? customerData.id : undefined;
      customer = {
        id: customerId,
        email:
          typeof customerData.email === "string" ? customerData.email : email,
        name:
          typeof customerData.name === "string" ? customerData.name : undefined,
      };
    } else if (email) {
      customer = { email };
    }

    // Extract product/plan info
    productId =
      typeof data.product_id === "string" ? data.product_id : undefined;
    plan = typeof data.price_id === "string" ? data.price_id : productId;

    // Extract created timestamp
    if (typeof data.created_at === "string") {
      createdAt = data.created_at;
    } else if (typeof event.created_at === "string") {
      createdAt = event.created_at;
    }
  }
  // Extract from Lemon Squeezy event
  else if (providerName === "lemonsqueezy" && event.data) {
    // Lemon Squeezy webhook events have a specific structure:
    // event.data contains { type, id, attributes, relationships, etc. }
    const data = event.data as {
      type?: string;
      id?: string;
      attributes?: Record<string, unknown>;
      relationships?: Record<string, unknown>;
    };

    // The attributes might be nested - check both direct and nested access
    // Sometimes event.data is the full data object, sometimes it's nested
    let attributes = (data.attributes || {}) as Record<string, unknown>;

    // If attributes is empty, the data might be the attributes directly
    if (!attributes || Object.keys(attributes).length === 0) {
      // Check if event.data itself has the attributes
      if ((event.data as any).attributes) {
        attributes = (event.data as any).attributes as Record<string, unknown>;
      } else {
        // Fallback: treat event.data as attributes if it has subscription fields
        if ((event.data as any).status || (event.data as any).variant_id) {
          attributes = event.data as Record<string, unknown>;
        }
      }
    }

    // Check if this is a subscription event
    const isSubscriptionEvent =
      data.type === "subscriptions" || eventType.includes("subscription");

    // For subscription events, amount and currency can be in different places:
    // 1. first_subscription_item (if present in attributes)
    // 2. relationships.first_subscription_item.data (if in relationships)
    // 3. Or we need to check the raw event structure

    if (isSubscriptionEvent) {
      // Try first_subscription_item in attributes
      let firstItem:
        | { unit_price?: number; currency?: string; quantity?: number }
        | undefined;

      if (attributes.first_subscription_item) {
        firstItem = attributes.first_subscription_item as {
          unit_price?: number;
          currency?: string;
          quantity?: number;
        };
      }

      // Check if we found first_subscription_item in attributes
      if (firstItem) {
        if (
          firstItem.unit_price !== undefined &&
          typeof firstItem.unit_price === "number"
        ) {
          // Calculate total amount: unit_price * quantity (default to 1 if quantity not provided)
          const quantity =
            typeof firstItem.quantity === "number" && firstItem.quantity > 0
              ? firstItem.quantity
              : 1;
          // Lemon Squeezy amounts are in cents, convert to dollars
          amount = (firstItem.unit_price * quantity) / 100;
        }

        if (typeof firstItem.currency === "string") {
          currency = firstItem.currency.toUpperCase() as CurrencyCode;
        }
      }
      // If first_subscription_item not found in attributes, check relationships and included resources
      else {
        // Check relationships to find subscription item reference
        const relationships = data.relationships as
          | Record<string, { data?: { type?: string; id?: string } }>
          | undefined;
        if (relationships?.first_subscription_item?.data) {
          const itemRef = relationships.first_subscription_item.data;
          // Try to find it in included resources (JSON:API format)
          if (rawEventObj?.included && itemRef?.id && itemRef?.type) {
            const includedItem = rawEventObj.included.find(
              (inc) => inc.type === itemRef.type && inc.id === itemRef.id
            );
            if (includedItem?.attributes) {
              firstItem = includedItem.attributes as {
                unit_price?: number;
                currency?: string;
                quantity?: number;
              };

              if (
                firstItem.unit_price !== undefined &&
                typeof firstItem.unit_price === "number"
              ) {
                const quantity =
                  typeof firstItem.quantity === "number" &&
                  firstItem.quantity > 0
                    ? firstItem.quantity
                    : 1;
                amount = (firstItem.unit_price * quantity) / 100;
              }

              if (typeof firstItem.currency === "string") {
                currency = firstItem.currency.toUpperCase() as CurrencyCode;
              }
            }
          }
        }

        // Fallback: Check if unit_price is directly in attributes
        if (!amount && typeof attributes.unit_price === "number") {
          const quantity =
            typeof attributes.quantity === "number" && attributes.quantity > 0
              ? attributes.quantity
              : 1;
          amount = (attributes.unit_price * quantity) / 100;
        }

        if (!currency && typeof attributes.currency === "string") {
          currency = attributes.currency.toUpperCase() as CurrencyCode;
        }

        // Debug: log available keys to help troubleshoot (only if still not found)
        if (!amount || !currency) {
          // eslint-disable-next-line no-console
          console.log("[LemonSqueezy Debug] Event type:", eventType);
          // eslint-disable-next-line no-console
          console.log("[LemonSqueezy Debug] Data type:", data.type);
          // eslint-disable-next-line no-console
          console.log(
            "[LemonSqueezy Debug] Available attributes keys:",
            Object.keys(attributes)
          );
          // eslint-disable-next-line no-console
          console.log(
            "[LemonSqueezy Debug] Has first_subscription_item:",
            !!attributes.first_subscription_item
          );
          if (attributes.first_subscription_item) {
            // eslint-disable-next-line no-console
            console.log(
              "[LemonSqueezy Debug] first_subscription_item keys:",
              Object.keys(
                attributes.first_subscription_item as Record<string, unknown>
              )
            );
          }
          if (relationships) {
            // eslint-disable-next-line no-console
            console.log(
              "[LemonSqueezy Debug] Relationships keys:",
              Object.keys(relationships)
            );
          }
          if (rawEventObj?.included) {
            // eslint-disable-next-line no-console
            console.log(
              "[LemonSqueezy Debug] Included resources count:",
              rawEventObj.included.length
            );
          }
        }
      }
    } else {
      // For order events, use total/subtotal
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
    }

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

    customerId =
      typeof attributes.customer_id === "string"
        ? attributes.customer_id
        : undefined;
    status =
      typeof attributes.status === "string" ? attributes.status : undefined;
    description =
      typeof attributes.notes === "string" ? attributes.notes : undefined;

    // Build customer info
    if (email || customerId) {
      customer = {
        id: customerId,
        email,
        name:
          typeof attributes.customer_name === "string"
            ? attributes.customer_name
            : undefined,
      };
    }

    // Extract product/plan info
    productId =
      typeof attributes.product_id === "string"
        ? attributes.product_id
        : undefined;
    plan =
      typeof attributes.variant_id === "string"
        ? attributes.variant_id
        : productId;

    // Extract created timestamp
    if (typeof attributes.created_at === "string") {
      createdAt = attributes.created_at;
    } else if (typeof attributes.updated_at === "string") {
      createdAt = attributes.updated_at;
    }
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
    customerId =
      typeof event.customerId === "string" ? event.customerId : undefined;
    status = typeof event.status === "string" ? event.status : undefined;
    description =
      typeof event.description === "string" ? event.description : undefined;
    plan = typeof event.plan === "string" ? event.plan : undefined;
    productId =
      typeof event.productId === "string" ? event.productId : undefined;

    // Build customer info if available
    if (event.customer && typeof event.customer === "object") {
      const customerData = event.customer as Record<string, unknown>;
      customer = {
        id: typeof customerData.id === "string" ? customerData.id : customerId,
        email:
          typeof customerData.email === "string" ? customerData.email : email,
        name:
          typeof customerData.name === "string" ? customerData.name : undefined,
        phone:
          typeof customerData.phone === "string"
            ? customerData.phone
            : undefined,
      };
    } else if (email || customerId) {
      customer = { id: customerId, email };
    }

    // Extract created timestamp
    if (typeof event.createdAt === "string") {
      createdAt = event.createdAt;
    } else if (typeof event.created_at === "string") {
      createdAt = event.created_at;
    } else if (typeof event.timestamp === "string") {
      createdAt = event.timestamp;
    }
  }

  // Build metadata from various sources
  let metadata: Record<string, unknown> | undefined;

  // For Stripe, metadata can be in multiple places:
  // 1. data.object.metadata (for checkout sessions and subscriptions)
  // 2. For subscription events, metadata might also be in subscription.metadata
  // 3. For checkout.session.completed, metadata is on the session
  if (providerName === "stripe" && event.data) {
    const eventData = event.data as { object: Record<string, unknown> };
    const data = eventData.object;

    // Check metadata on the main object (works for both checkout sessions and subscriptions)
    if (
      data.metadata &&
      typeof data.metadata === "object" &&
      data.metadata !== null
    ) {
      metadata = data.metadata as Record<string, unknown>;
    }

    // For subscription events, also check if there's a checkout_session with metadata
    // (when subscription is created via checkout, metadata might be on the session)
    if (!metadata && data.subscription) {
      const subscription =
        typeof data.subscription === "object" && data.subscription !== null
          ? (data.subscription as Record<string, unknown>)
          : null;
      if (
        subscription &&
        subscription.metadata &&
        typeof subscription.metadata === "object" &&
        subscription.metadata !== null
      ) {
        metadata = subscription.metadata as Record<string, unknown>;
      }
    }
  }
  // For Paddle, metadata is in data.custom_data
  // Also check subscription.custom_data for subscription-specific metadata
  else if (providerName === "paddle" && event.data) {
    const data = event.data as Record<string, unknown>;

    // Check top-level custom_data
    if (
      data.custom_data &&
      typeof data.custom_data === "object" &&
      data.custom_data !== null
    ) {
      metadata = data.custom_data as Record<string, unknown>;
    }

    // Also check subscription.custom_data for subscription events
    if (!metadata && data.subscription) {
      const subscription =
        typeof data.subscription === "object" && data.subscription !== null
          ? (data.subscription as Record<string, unknown>)
          : null;
      if (
        subscription &&
        subscription.custom_data &&
        typeof subscription.custom_data === "object" &&
        subscription.custom_data !== null
      ) {
        metadata = subscription.custom_data as Record<string, unknown>;
      }
    }
  }
  // For Lemon Squeezy, metadata can be in two places:
  // 1. event.custom_data (from meta.custom_data in webhook - this is the custom data passed during checkout/subscription creation)
  // 2. data.attributes.custom (if custom data is stored directly in subscription attributes)
  else if (providerName === "lemonsqueezy") {
    const metadataFromCustomData =
      event.custom_data &&
      typeof event.custom_data === "object" &&
      event.custom_data !== null
        ? (event.custom_data as Record<string, unknown>)
        : undefined;

    let metadataFromAttributes: Record<string, unknown> | undefined;
    if (event.data) {
      const data = event.data as {
        attributes?: Record<string, unknown>;
      };
      const attributes = data.attributes || {};
      if (
        attributes.custom &&
        typeof attributes.custom === "object" &&
        attributes.custom !== null
      ) {
        metadataFromAttributes = attributes.custom as Record<string, unknown>;
      }
    }

    // Merge both sources if they both exist (custom_data takes precedence)
    if (metadataFromCustomData || metadataFromAttributes) {
      metadata = {
        ...(metadataFromAttributes || {}),
        ...(metadataFromCustomData || {}), // custom_data overrides attributes.custom
      };
    }
  }
  // For Polar, metadata is in data.metadata
  // Also check checkout.metadata for checkout-related events
  else if (providerName === "polar" && event.data) {
    const data = event.data as Record<string, unknown>;

    // Check top-level metadata
    if (
      data.metadata &&
      typeof data.metadata === "object" &&
      data.metadata !== null
    ) {
      metadata = data.metadata as Record<string, unknown>;
    }

    // Also check checkout.metadata for checkout events
    if (!metadata && data.checkout) {
      const checkout =
        typeof data.checkout === "object" && data.checkout !== null
          ? (data.checkout as Record<string, unknown>)
          : null;
      if (
        checkout &&
        checkout.metadata &&
        typeof checkout.metadata === "object" &&
        checkout.metadata !== null
      ) {
        metadata = checkout.metadata as Record<string, unknown>;
      }
    }
  }
  // For PayPal, metadata might be in resource.custom_id (JSON string)
  // Also check resource.custom fields and subscription-level custom_id
  else if (providerName === "paypal") {
    let metadataFromResource: Record<string, unknown> | undefined;
    let metadataFromSubscription: Record<string, unknown> | undefined;

    if (event.resource) {
      const resource = event.resource as Record<string, unknown>;

      // Check resource.custom_id (main location for metadata)
      if (typeof resource.custom_id === "string") {
        try {
          const parsed = JSON.parse(resource.custom_id);
          if (typeof parsed === "object" && parsed !== null) {
            metadataFromResource = parsed as Record<string, unknown>;
          }
        } catch {
          // If parsing fails, treat as plain string
          metadataFromResource = { custom_id: resource.custom_id };
        }
      }

      // Also check resource.custom (if it exists)
      if (
        resource.custom &&
        typeof resource.custom === "object" &&
        resource.custom !== null
      ) {
        metadataFromResource = {
          ...metadataFromResource,
          ...(resource.custom as Record<string, unknown>),
        };
      }

      // For subscription events, check subscription resource
      if (resource.id && eventType.includes("billing.subscription")) {
        // The resource itself is the subscription, custom_id should already be checked above
      }
    }

    // Merge both sources if they exist
    if (metadataFromResource || metadataFromSubscription) {
      metadata = {
        ...(metadataFromSubscription || {}),
        ...(metadataFromResource || {}), // resource metadata takes precedence
      };
    }
  }
  // Generic fallback - check top-level metadata or custom_data
  else {
    if (typeof event.metadata === "object" && event.metadata !== null) {
      metadata = event.metadata as Record<string, unknown>;
    } else if (
      typeof event.custom_data === "object" &&
      event.custom_data !== null
    ) {
      metadata = event.custom_data as Record<string, unknown>;
    }
  }

  // Include raw event in metadata for advanced use cases
  if (!metadata) {
    metadata = {};
  }
  metadata._rawEvent = rawEvent;

  return {
    type,
    amount,
    currency,
    email,
    provider: providerName,
    subscriptionId,
    paymentId,
    customerId,
    customer,
    status,
    description,
    createdAt,
    plan,
    productId,
    metadata,
    providerResponse: rawEvent,
  };
}
