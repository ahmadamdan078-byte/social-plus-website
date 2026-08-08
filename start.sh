#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org"
  exit 1
fi

if [ ! -d server/node_modules ]; then
  echo "Installing server dependencies..."
  npm install --prefix server
fi

PORT="${PORT:-5500}"
while lsof -i :"$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

export PORT
echo ""
echo "  Social Plus — website + Admin Control Center"
echo "  Website:  http://localhost:$PORT"
echo "  Admin:    http://localhost:$PORT/admin"
echo "  Press Ctrl+C to stop"
echo ""

NODE_PATH="$(pwd)/server/node_modules" node server.js
