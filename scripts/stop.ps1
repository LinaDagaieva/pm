# Stop the Kanban PM container (Windows).
$ErrorActionPreference = "Stop"

docker stop kanban-pm 2>$null || $true
Write-Host "Kanban PM stopped"
