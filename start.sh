#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js is not installed."
  echo "  Install from: https://nodejs.org"
  echo "  Or use checkout on GitHub Pages with WhatsApp pay (no install needed)."
  echo ""
  exit 1
fi

if [ ! -d server/node_modules ]; then
  echo "Installing server dependencies..."
  npm install --prefix server
fi

# Load local env if present (Stripe keys etc.)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${PORT:-5500}"
while lsof -i :"$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

export PORT
echo ""
echo "  Social Plus — website + checkout + admin"
echo "  Website:   http://localhost:$PORT"
echo "  Checkout:  http://localhost:$PORT/checkout.html?plan=growth"
echo "  Admin:     http://localhost:$PORT/admin"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

NODE_PATH="$(pwd)/server/node_modules" node server.js
