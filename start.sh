#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 22.12+ first: https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies with npm ci (about 2 minutes)..."
  npm ci
fi

PORT="${PORT:-3000}"
if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" >/dev/null 2>&1; then
  PORT=$((PORT + 1))
fi

if [ "${NO_BROWSER:-0}" != "1" ]; then
  (
    sleep 5
    if command -v open >/dev/null 2>&1; then
      open "http://localhost:$PORT"
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "http://localhost:$PORT" >/dev/null 2>&1
    fi
  ) >/dev/null 2>&1 &
fi

echo "Smart AI is starting: http://localhost:$PORT"
npm run dev -- -p "$PORT"
