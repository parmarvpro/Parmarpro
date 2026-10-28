import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Baseline security headers for every response. The Content-Security-Policy
 * (with per-request nonces) is set by clerkMiddleware in src/proxy.ts.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")',
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const nextConfig: NextConfig = {
  // Tenant data is never cached across requests: every authenticated route
  // renders dynamically per request. (Cache Components stays disabled.)
  poweredByHeader: false,
  reactStrictMode: true,
  // PostHog is proxied through this origin so the CSP can stay 'self'.
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${posthogHost.replace("://us.i.", "://us-assets.i.").replace("://eu.i.", "://eu-assets.i.")}/static/:path*` },
      { source: "/ingest/:path*", destination: `${posthogHost}/:path*` },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Browser events go through this origin (keeps the CSP connect-src 'self').
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  telemetry: false,
});
