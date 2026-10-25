#!/usr/bin/env bash
# Builds and starts the stack with Docker Compose, waits until the container is healthy,
# then checks the main routes. Usage: ./scripts/docker-smoke.sh [--keep]
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE_URL:-http://localhost:3000}"
docker compose up -d --build

echo "Waiting for the container to become healthy…"
status=""
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' threadflow-web 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  sleep 2
done
echo "health: $status"
[ "$status" = "healthy" ] || { docker compose logs web | tail -50; exit 1; }

check() { # name expected-status curl-args…
  local name="$1" want="$2"; shift 2
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  printf '%-40s %s (want %s)\n' "$name" "$got" "$want"
  [ "$got" = "$want" ]
}

check "GET /login" 200 "$BASE/login"
check "GET /orders (signed out → redirect)" 307 "$BASE/orders"
check "GET /brand/threadflow-mark.png" 200 "$BASE/brand/threadflow-mark.png"
check "GET /api/mock/orders (no session)" 401 "$BASE/api/mock/orders"
check "POST /api/mock/auth/login" 200 -X POST -H 'content-type: application/json' -d '{"userId":"u-manager"}' -c /tmp/tf-cookies "$BASE/api/mock/auth/login"
check "GET /api/mock/orders (signed in)" 200 -b /tmp/tf-cookies "$BASE/api/mock/orders"
check "GET /dashboard (signed in)" 200 -b /tmp/tf-cookies "$BASE/dashboard"

echo "container user: $(docker exec threadflow-web id -un)"
docker image ls threadflow-web --format 'image size: {{.Size}}'
echo "All smoke checks passed."

if [ "${1:-}" != "--keep" ]; then docker compose down; fi
