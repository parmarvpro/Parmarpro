import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "@/lib/observability/sentry-options";

Sentry.init({
  ...sentryBaseOptions(),
  // Session Replay is deliberately not enabled: it could capture patient data on screen.
  integrations: [],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
