#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/pg.sh start
bash scripts/s3.sh start

if [[ ! -d backend/node_modules ]]; then
  npm install --prefix backend
fi
if [[ ! -d frontend/node_modules ]]; then
  npm install --prefix frontend
fi

(cd backend && npm run seed)
(cd backend && npm run start:dev) &
back_pid=$!
(cd frontend && npm run dev -- --host 127.0.0.1) &
front_pid=$!

trap 'kill "$back_pid" "$front_pid" 2>/dev/null || true' EXIT INT TERM
wait
