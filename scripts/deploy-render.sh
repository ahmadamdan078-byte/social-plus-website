#!/bin/bash
# Deploy Social Plus website to Render (static site)
# Usage: RENDER_API_KEY=your_key ./scripts/deploy-render.sh

set -euo pipefail

REPO="https://github.com/ahmadamdan078-byte/social-plus-website"
BRANCH="main"
SERVICE_NAME="social-plus-website"

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo ""
  echo "  Missing RENDER_API_KEY"
  echo ""
  echo "  1. Open: https://dashboard.render.com/u/settings#api-keys"
  echo "  2. Click 'Create API Key' → name it 'deploy'"
  echo "  3. Copy the key, then run:"
  echo ""
  echo "     RENDER_API_KEY=paste_key_here ./scripts/deploy-render.sh"
  echo ""
  exit 1
fi

API="https://api.render.com/v1"
AUTH="Authorization: Bearer $RENDER_API_KEY"

echo "→ Fetching Render workspace..."
OWNER_JSON=$(curl -s -H "$AUTH" "$API/owners?limit=1")
OWNER_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['owner']['id'] if d else '')" <<< "$OWNER_JSON")

if [ -z "$OWNER_ID" ]; then
  echo "Could not get workspace ID. Check your API key."
  exit 1
fi

echo "→ Workspace ID: $OWNER_ID"

echo "→ Checking for existing service..."
EXISTING=$(curl -s -H "$AUTH" "$API/services?limit=100" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data:
    s=item.get('service',item)
    if s.get('name')=='$SERVICE_NAME':
        print(s.get('id',''))
        break
" || true)

if [ -n "$EXISTING" ]; then
  echo "→ Service already exists: $EXISTING"
  echo "→ Triggering deploy..."
  curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
    "$API/services/$EXISTING/deploys" \
    -d '{"clearCache":"do_not_clear"}' > /dev/null
  echo ""
  echo "  Deploy started!"
  echo "  Check: https://dashboard.render.com"
  echo "  Site:  https://social-plus-website.onrender.com"
  exit 0
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
    "buildCommand": "echo Static site",
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
  URL=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('service',{}).get('serviceDetails',{}).get('url','https://social-plus-website.onrender.com'))" <<< "$BODY" 2>/dev/null || echo "https://social-plus-website.onrender.com")
  echo ""
  echo "  ✓ Static site created on Render!"
  echo "  Dashboard: https://dashboard.render.com"
  echo "  Live URL:  $URL"
  echo ""
  echo "  First deploy takes 2–5 minutes."
else
  echo "Failed (HTTP $HTTP_CODE):"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi
