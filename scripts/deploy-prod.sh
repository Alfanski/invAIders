#!/bin/bash
# Deploy to production Convex and set env vars
#
# Usage:
#   Local:  source .env.local && bash scripts/deploy-prod.sh
#   CI:     env vars injected from GitHub Secrets

set -euo pipefail

required_vars=(
  CONVEX_DEPLOY_KEY
  STRAVA_CLIENT_ID
  STRAVA_CLIENT_SECRET
  GROQ_API_KEY
  CONVEX_WEBHOOK_SECRET
  SESSION_SECRET
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: required variable $var is not set" >&2
    exit 1
  fi
done

echo "=== Deploying to production Convex ==="
npx convex deploy --cmd 'npm run build' 2>&1

echo ""
echo "=== Setting environment variables ==="

convex_env_vars=(
  STRAVA_CLIENT_ID
  STRAVA_CLIENT_SECRET
  GROQ_API_KEY
  CONVEX_WEBHOOK_SECRET
  SESSION_SECRET
)

optional_env_vars=(
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_ID
  N8N_STRAVA_WEBHOOK_URL
  APP_URL
)

for var in "${convex_env_vars[@]}"; do
  echo "  Setting $var..."
  npx convex env set "$var" "${!var}" 2>&1
done

for var in "${optional_env_vars[@]}"; do
  if [[ -n "${!var:-}" ]]; then
    echo "  Setting $var..."
    npx convex env set "$var" "${!var}" 2>&1
  fi
done

echo ""
echo "=== Done ==="
