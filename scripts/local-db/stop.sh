#!/usr/bin/env bash
set -euo pipefail
docker rm -f parmarpro-test-api parmarpro-test-db >/dev/null 2>&1 || true
docker network rm parmarpro-test >/dev/null 2>&1 || true
rm -f "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.env.test.local"
echo "Local test stack removed."
