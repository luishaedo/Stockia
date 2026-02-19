#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4000}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
ADMIN_TOKEN="${ADMIN_TOKEN:-1882}"
JWT_SECRET="${JWT_SECRET:-smoke-ci-secret}"
AUTH_USERNAME="${AUTH_USERNAME:-admin}"
AUTH_PASSWORD="${AUTH_PASSWORD:-smoke-password}"

export JWT_SECRET
export AUTH_USERNAME
export AUTH_PASSWORD
export PORT

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" || true
  fi
}
trap cleanup EXIT

node dist/index.js &
API_PID=$!

for _ in {1..30}; do
  if curl -fsS "$BASE_URL/health" >/dev/null; then
    break
  fi
  sleep 1
done

echo "Smoke: GET /health"
curl -fsS "$BASE_URL/health" | grep -q '"status":"ok"'

echo "Smoke: GET /facturas"
get_status=$(curl -s -o /tmp/smoke_get_facturas.out -w "%{http_code}" "$BASE_URL/facturas")
if [[ "$get_status" != "200" ]]; then
  echo "Expected 200 for GET /facturas, got $get_status"
  cat /tmp/smoke_get_facturas.out
  exit 1
fi

echo "Smoke: POST /facturas without token"
unauth_status=$(curl -s -o /tmp/smoke_post_unauth.out -w "%{http_code}" -X POST "$BASE_URL/facturas" -H 'Content-Type: application/json' -d '{}')
if [[ "$unauth_status" != "401" ]]; then
  echo "Expected 401 for unauth POST /facturas, got $unauth_status"
  cat /tmp/smoke_post_unauth.out
  exit 1
fi

echo "Smoke: POST /facturas with token"
token_response=$(curl -s -o /tmp/smoke_auth_login.out -w "%{http_code}" -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}")
if [[ "$token_response" != "200" ]]; then
  echo "Expected 200 for POST /auth/login, got $token_response"
  cat /tmp/smoke_auth_login.out
  exit 1
fi

access_token=$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('/tmp/smoke_auth_login.out', 'utf8')); process.stdout.write(data.accessToken || '');")
if [[ -z "$access_token" ]]; then
  echo "Missing accessToken in /auth/login response"
  cat /tmp/smoke_auth_login.out
  exit 1
fi

auth_status=$(curl -s -o /tmp/smoke_post_auth.out -w "%{http_code}" -X POST "$BASE_URL/facturas" -H 'Content-Type: application/json' -H "Authorization: Bearer $access_token" -d '{}')
if [[ "$auth_status" != "201" && "$auth_status" != "400" ]]; then
  echo "Expected 201 or 400 for auth POST /facturas, got $auth_status"
  cat /tmp/smoke_post_auth.out
  exit 1
fi

echo "Smoke checks passed"
