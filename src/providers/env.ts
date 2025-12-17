/**
 * Determines if the current environment is in sandbox/test mode
 *
 * Checks in order:
 * 1. PAYLAYER_ENVIRONMENT (unified variable) - accepts: "sandbox", "test", "production", "live" (case-insensitive)
 * 2. Provider-specific variables for backward compatibility:
 *    - PADDLE_SANDBOX
 *    - PAYPAL_SANDBOX
 *    - LEMONSQUEEZY_TEST_MODE
 *    - POLAR_SANDBOX
 *
 * @param providerName - Optional provider name for backward compatibility fallback
 * @returns true if in sandbox/test mode, false if in production mode
 */
export function isSandbox(providerName?: string): boolean {
  // Check unified environment variable first
  const env = process.env.PAYLAYER_ENVIRONMENT;
  if (env) {
    const envLower = env.toLowerCase();
    // Sandbox/test mode values
    if (envLower === "sandbox" || envLower === "test") {
      return true;
    }
    // Production/live mode values
    if (envLower === "production" || envLower === "live") {
      return false;
    }
    // Invalid value - default to production for safety
    console.warn(
      `Invalid PAYLAYER_ENVIRONMENT value: "${env}". Expected "sandbox", "test", "production", or "live". Defaulting to production mode.`
    );
    return false;
  }

  // Fallback to provider-specific variables for backward compatibility
  if (providerName) {
    const providerLower = providerName.toLowerCase();
    switch (providerLower) {
      case "paddle":
        return process.env.PADDLE_SANDBOX === "true";
      case "paypal":
        return process.env.PAYPAL_SANDBOX === "true";
      case "lemonsqueezy":
        return process.env.LEMONSQUEEZY_TEST_MODE === "true";
      case "polar":
        return process.env.POLAR_SANDBOX === "true";
      case "stripe":
        // Stripe uses key prefix to determine mode
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          return stripeKey.startsWith("sk_test_");
        }
        return false;
      default:
        return false;
    }
  }

  // Default to production mode if nothing is set (safe default)
  return false;
}
