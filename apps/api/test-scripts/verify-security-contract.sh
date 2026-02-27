#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4000}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
JWT_SECRET="${JWT_SECRET:-contract-check-secret}"
AUTH_USERNAME="${AUTH_USERNAME:-admin}"
AUTH_PASSWORD="${AUTH_PASSWORD:-contract-password}"

export JWT_SECRET AUTH_USERNAME AUTH_PASSWORD PORT

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" || true
  fi
}
trap cleanup EXIT

LOG_FILE="${LOG_FILE:-/tmp/verify-security-contract-api.log}"
node dist/index.js >"$LOG_FILE" 2>&1 &
API_PID=$!

for _ in {1..40}; do
  if curl -fsS "$BASE_URL/health" >/dev/null; then
    break
  fi
  sleep 1
done

echo "Verify contract: POST /auth/login with valid credentials"
status=$(curl -s -o /tmp/contract_login_ok.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}")
[[ "$status" == "200" ]] || (echo "Expected 200, got $status" && cat /tmp/contract_login_ok.json && exit 1)

node <<'NODE'
const fs = require('node:fs');
const response = JSON.parse(fs.readFileSync('/tmp/contract_login_ok.json', 'utf8'));
if (response.tokenType !== 'Bearer') throw new Error('tokenType must be Bearer');
if (typeof response.accessToken !== 'string' || response.accessToken.length === 0) {
  throw new Error('accessToken missing');
}
const parts = response.accessToken.split('.');
if (parts.length !== 3) throw new Error('JWT format invalid');
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
if (typeof payload.sub !== 'string') throw new Error('JWT payload sub must be string');
if (payload.role !== 'admin') throw new Error('JWT payload role must be admin');
if (typeof payload.exp !== 'number') throw new Error('JWT payload exp must be number');
NODE

echo "Verify contract: POST /auth/login invalid credentials"
status=$(curl -s -o /tmp/contract_login_bad.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"bad\",\"password\":\"bad\"}")
[[ "$status" == "401" ]] || (echo "Expected 401, got $status" && cat /tmp/contract_login_bad.json && exit 1)

echo "Verify contract: /facturas without bearer"
status=$(curl -s -o /tmp/contract_no_token.json -w "%{http_code}" "$BASE_URL/facturas")
[[ "$status" == "401" ]] || (echo "Expected 401, got $status" && cat /tmp/contract_no_token.json && exit 1)

echo "Verify contract: security headers"
headers=$(curl -s -D - -o /dev/null "$BASE_URL/health")
echo "$headers" | grep -qi '^x-content-type-options: nosniff$'
echo "$headers" | grep -qi '^x-frame-options: DENY$'
echo "$headers" | grep -qi '^referrer-policy: no-referrer$'
echo "$headers" | grep -qi '^x-dns-prefetch-control: off$'
echo "$headers" | grep -qi '^strict-transport-security: max-age=15552000; includeSubDomains$'

echo "Security contract checks passed"
