# Build and run the Kanban PM container (Windows).
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

$port = if ($env:PORT) { $env:PORT } else { "8000" }

docker build -t kanban-pm .
docker run -d --rm --name kanban-pm -p "${port}:8000" --env-file .env kanban-pm

Write-Host "Kanban PM running at http://localhost:$port"
