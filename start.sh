#!/bin/bash
cd "$(dirname "$0")"
PORT=5500

while lsof -i :"$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo ""
echo "  Social Plus website"
echo "  Open in your browser: http://localhost:$PORT"
echo "  Press Ctrl+C to stop"
echo ""

python3 -m http.server "$PORT"
