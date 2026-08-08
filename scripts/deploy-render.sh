#!/bin/bash
# Deploy Social Plus website to Render (static site)
# Usage: RENDER_API_KEY=your_key ./scripts/deploy-render.sh

set -euo pipefail

REPO="https://github.com/ahmadamdan078-byte/social-plus-website"
BRANCH="main"
SERVICE_NAME="social-plus-website"
BUILD_CMD="node scripts/inject-firebase-config.js"

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo ""
  echo "  Missing RENDER_API_KEY"
  echo ""
  echo "  1. Open: https://dashboard.render.com/u/settings#api-keys"
  echo "  2. Create API Key → copy it"
  echo "  3. Run: RENDER_API_KEY=your_key ./scripts/deploy-render.sh"
  echo ""
  exit 1
fi

API="https://api.render.com/v1"
AUTH="Authorization: Bearer $RENDER_API_KEY"

echo "→ Checking Render API key..."
OWNER_JSON=$(curl -s -w "\n%{http_code}" -H "$AUTH" "$API/owners?limit=1")
HTTP=$(echo "$OWNER_JSON" | tail -1)
BODY=$(echo "$OWNER_JSON" | sed '$d')

if [ "$HTTP" = "401" ]; then
  echo "  API key expired or invalid. Create a new one at:"
  echo "  https://dashboard.render.com/u/settings#api-keys"
  exit 1
fi

OWNER_ID=$(python3 -c "
import json, sys
d = json.load(sys.stdin)
if isinstance(d, list) and d:
    print(d[0].get('owner', {}).get('id', ''))
elif isinstance(d, dict) and d.get('owner'):
    print(d['owner'].get('id', ''))
" <<< "$BODY" 2>/dev/null || true)

if [ -z "$OWNER_ID" ]; then
  echo "Could not get workspace ID."
  echo "$BODY"
  exit 1
fi

echo "→ Workspace ID: $OWNER_ID"

echo "→ Looking for service '$SERVICE_NAME'..."
SERVICES_JSON=$(curl -s -H "$AUTH" "$API/services?limit=100")
SERVICE_ID=$(python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    s = item.get('service', item)
    if s.get('name') == '$SERVICE_NAME':
        print(s.get('id', ''))
        break
" <<< "$SERVICES_JSON" || true)

if [ -n "$SERVICE_ID" ]; then
  echo "→ Service found: $SERVICE_ID"
  echo "→ Updating build settings..."
  curl -s -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
    "$API/services/$SERVICE_ID" \
    -d "{\"serviceDetails\":{\"buildCommand\":\"$BUILD_CMD\",\"publishPath\":\".\",\"autoDeploy\":\"yes\"}}" > /dev/null || true
  echo "→ Triggering deploy..."
  DEPLOY=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" -H "Content-Type: application/json" \
    "$API/services/$SERVICE_ID/deploys" \
    -d '{"clearCache":"clear"}')
  DEPLOY_HTTP=$(echo "$DEPLOY" | tail -1)
  if [ "$DEPLOY_HTTP" = "201" ] || [ "$DEPLOY_HTTP" = "200" ] || [ "$DEPLOY_HTTP" = "202" ]; then
    echo ""
    echo "  ✓ Deploy started on Render!"
    echo "  Live: https://social-plus-website.onrender.com"
    echo "  Wait 2–3 minutes, then hard refresh (Cmd+Shift+R)."
    exit 0
  fi
  echo "Deploy request returned HTTP $DEPLOY_HTTP"
  echo "$DEPLOY" | sed '$d'
  exit 1
fi

echo "→ Creating static site..."
PAYLOAD=$(cat <<EOF
{
  "type": "static_site",
  "name": "$SERVICE_NAME",
  "ownerId": "$OWNER_ID",
  "repo": "$REPO",
  "branch": "$BRANCH",
  "autoDeploy": "yes",
  "serviceDetails": {
    "buildCommand": "$BUILD_CMD",
    "publishPath": "."
  }
}
EOF
)

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "$API/services" -d "$PAYLOAD")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo ""
  echo "  ✓ Static site created on Render!"
  echo "  Live: https://social-plus-website.onrender.com"
  exit 0
fi

echo "Failed (HTTP $HTTP_CODE):"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
exit 1
