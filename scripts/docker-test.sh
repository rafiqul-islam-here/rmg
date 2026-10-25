#!/usr/bin/env bash
# Full test of the Docker setup. Needs only Docker + Compose v2 on the machine.
#
#   1. Compose file is valid
#   2. `test` image: lint + typecheck + unit/API/component tests (inside Docker)
#   3. Production image builds; size, non-root user, no test/dev files inside
#   4. `docker compose up`: container becomes healthy; key routes answer correctly
#   5. Playwright browser tests run in a container against the app container
#   6. Restart policy: a killed server process comes back by itself
#   7. Mock data resets on restart (documented behaviour)
#   8. The image can be built for a real backend (NEXT_PUBLIC_API_BASE_URL set)
#
# Usage: ./scripts/docker-test.sh          (cleans up at the end)
#        ./scripts/docker-test.sh --keep   (leaves the app running on :3000)
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
step() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; FAIL=$((FAIL + 1)); }
check() { # description, command…
  local d="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi
}
http() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
wait_healthy() {
  local s=""
  for _ in $(seq 1 90); do
    s="$(docker inspect -f '{{.State.Health.Status}}' threadflow-web 2>/dev/null || true)"
    [ "$s" = healthy ] && return 0
    sleep 2
  done
  echo "  last health status: $s"; return 1
}
cleanup() { docker compose --profile test down --remove-orphans >/dev/null 2>&1 || true; }

step "1. Compose file"
check "docker compose config is valid" docker compose --profile test config --quiet

step "2. Lint, typecheck and unit tests inside Docker (target: test)"
if docker compose --profile test build unit; then ok "lint + typecheck + unit/API/component tests passed in the test image"; else bad "test image failed (see output above)"; fi

step "3. Production image (target: runner)"
docker compose build web
size="$(docker image inspect threadflow-web:latest -f '{{.Size}}')"
echo "  image size: $((size / 1024 / 1024)) MB"
[ "$size" -lt $((400 * 1024 * 1024)) ] && ok "image is under 400 MB" || bad "image is larger than 400 MB"
user="$(docker run --rm --entrypoint id threadflow-web:latest -un)"
[ "$user" = nextjs ] && ok "runs as non-root user ($user)" || bad "runs as $user"
if docker run --rm --entrypoint sh threadflow-web:latest -c 'test ! -d tests && test ! -d src && test ! -e playwright.config.ts && test ! -d node_modules/vitest && test ! -d node_modules/@playwright'; then
  ok "no source, tests or dev tools inside the production image"
else
  bad "production image contains source/tests/dev tools"
fi

step "4. docker compose up"
cleanup
docker compose up -d web
if wait_healthy; then ok "container is healthy"; else bad "container did not become healthy"; docker compose logs web | tail -40; exit 1; fi
BASE=http://127.0.0.1:3000
[ "$(http "$BASE/login")" = 200 ] && ok "GET /login → 200" || bad "GET /login"
[ "$(http "$BASE/orders")" = 307 ] && ok "signed-out /orders → 307 redirect to login" || bad "GET /orders redirect"
[ "$(http "$BASE/brand/threadflow-logo.png")" = 200 ] && ok "static brand image served" || bad "brand image"
[ "$(http "$BASE/api/mock/orders")" = 401 ] && ok "API without session → 401" || bad "API 401"
jar="$(mktemp)"
code="$(http -c "$jar" -X POST -H 'content-type: application/json' -d '{"company":"Demo Garments Ltd.","login":"rahim.ahmed","password":"factory@2026"}' "$BASE/api/mock/auth/login")"
[ "$code" = 200 ] && ok "login with company + username + password → 200" || bad "login → $code"
[ "$(http -b "$jar" "$BASE/dashboard")" = 200 ] && ok "dashboard with session → 200" || bad "dashboard with session"
[ "$(http -X POST -H 'content-type: application/json' -d '{"company":"Nope","login":"rahim.ahmed","password":"factory@2026"}' "$BASE/api/mock/auth/login")" = 401 ] && ok "wrong company → 401" || bad "wrong company"

step "5. Browser tests in Docker (target: e2e, Playwright Chromium → http://web:3000)"
rm -rf playwright-report test-results
if docker compose --profile test run --rm e2e; then ok "all Playwright browser tests passed against the container"; else bad "browser tests failed (report: ./playwright-report/index.html)"; fi

step "6. Crash recovery, restart policy and clean shutdown"
docker exec threadflow-web sh -c 'kill -9 "$(pgrep -f "node server.js")"' >/dev/null 2>&1 || true
sleep 3
if wait_healthy; then ok "server process killed → container restarted and healthy again"; else bad "container did not come back"; fi
restarts="$(docker inspect -f '{{.RestartCount}}' threadflow-web)"
[ "$restarts" -ge 1 ] && ok "restart count = $restarts" || bad "restart count = $restarts"
start=$(date +%s)
docker compose stop web >/dev/null 2>&1
took=$(( $(date +%s) - start ))
[ "$took" -le 5 ] && ok "docker compose stop finished in ${took}s (SIGTERM handled, no 10s kill timeout)" || bad "stop took ${took}s"
docker compose start web >/dev/null 2>&1
wait_healthy && ok "started again and healthy" || bad "did not start again"

step "7. Mock data resets on restart"
http -c "$jar" -X POST -H 'content-type: application/json' -d '{"company":"Demo Garments Ltd.","login":"rahim.ahmed","password":"factory@2026"}' "$BASE/api/mock/auth/login" >/dev/null
count="$(curl -s -b "$jar" "$BASE/api/mock/orders" | grep -o '"total":[0-9]*' | cut -d: -f2)"
[ "$count" = 23 ] && ok "seed data is back to 23 orders after restart" || bad "orders after restart: $count (expected 23)"
rm -f "$jar"

step "8. Build for a real backend"
if docker build -q --target runner --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com -t threadflow-web:api-check . >/dev/null; then
  if docker run --rm --entrypoint sh threadflow-web:api-check -c 'grep -rq "https://api.example.com" .next/static'; then
    ok "NEXT_PUBLIC_API_BASE_URL is baked into the browser bundle"
  else
    bad "API URL not found in the bundle"
  fi
  docker image rm -f threadflow-web:api-check >/dev/null
else
  bad "build with NEXT_PUBLIC_API_BASE_URL failed"
fi

printf '\n\033[1mResult: %d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
if [ "${1:-}" != "--keep" ]; then cleanup; fi
[ "$FAIL" -eq 0 ]
