# Stop the Kanban PM container (Windows).
$ErrorActionPreference = "Stop"

docker stop kanban-pm
Write-Host "Kanban PM stopped"
