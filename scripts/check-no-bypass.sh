#!/usr/bin/env bash
# Fails if application code contains auth/test bypass patterns (threat T24).
set -euo pipefail
cd "$(dirname "$0")/.."
patterns='SKIP_AUTH|DISABLE_AUTH|AUTH_BYPASS|BYPASS_RLS|bypassAuth|isTestUser|__TEST_ONLY__|NODE_ENV *=== *"test"|process\.env\.CI'
if grep -RInE "$patterns" src; then
  echo "Found a potential auth/test bypass in src/ (see above)." >&2
  exit 1
fi
if grep -RIn "service_role\|SUPABASE_SECRET_KEY" src --include=*.ts --include=*.tsx | grep -v "^src/lib/env.ts" | grep -v "^src/server/privileged/"; then
  echo "Privileged Supabase credentials referenced outside src/lib/env.ts and src/server/privileged/." >&2
  exit 1
fi
echo "No bypass patterns found."
