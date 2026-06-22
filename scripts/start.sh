#!/usr/bin/env bash
# Build and run the Kanban PM container (Mac/Linux).
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8000}"

docker build -t kanban-pm .
docker run -d --rm --name kanban-pm -p "${PORT}:8000" --env-file .env kanban-pm

echo "Kanban PM running at http://localhost:${PORT}"
