#!/usr/bin/env bash
# Build and run the Kanban PM container (Mac/Linux).
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8000}"

docker build -t kanban-pm .
docker rm -f kanban-pm >/dev/null 2>&1 || true
docker run -d --rm --name kanban-pm -p "${PORT}:8000" --env-file .env kanban-pm

echo "Kanban PM running at http://localhost:${PORT}"
