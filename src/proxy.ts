import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * First-layer routing only: send signed-out browsers to sign-in for app
 * pages. This is NOT the security boundary. Every Server Action, Route
 * Handler and data loader calls requirePermission(), and PostgreSQL RLS
 * enforces tenant isolation independently.
 *
 * API routes are deliberately not redirected here: handlers answer 401/403
 * JSON themselves, and webhook routes authenticate by signature.
 *
 * Content-Security-Policy: Clerk generates a per-request nonce with
 * 'strict-dynamic'. Sentry (/monitoring) and PostHog (/ingest) are proxied
 * through this origin, so only Razorpay Checkout needs extra origins.
 */
const isAppPage = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isAppPage(request)) {
      await auth.protect();
    }
  },
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "connect-src": ["https://api.razorpay.com", "https://lumberjack.razorpay.com"],
        "frame-src": ["https://api.razorpay.com", "https://checkout.razorpay.com"],
        "script-src": ["https://checkout.razorpay.com"],
        "img-src": ["data:", "https://cdn.razorpay.com"],
        "base-uri": ["self"],
        "object-src": ["none"],
        "frame-ancestors": ["none"],
        "form-action": ["self"],
      },
    },
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
