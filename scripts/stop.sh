#!/usr/bin/env bash
# Stop the Kanban PM container (Mac/Linux).
set -euo pipefail

docker stop kanban-pm
echo "Kanban PM stopped"
