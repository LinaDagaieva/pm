# Kanban PM

A small project-management web app: a single Kanban board with drag-and-drop, a fake login, persistence, and an AI chat assistant that can edit the board.

- Next.js frontend (static export), served by a Python FastAPI backend
- SQLite for storage
- AI via OpenRouter (`openai/gpt-oss-120b`)
- Everything runs in one Docker container

## Requirements

- Docker
- A `.env` file in this directory with an OpenRouter key:

  ```
  OPENROUTER_API_KEY=sk-or-v1-...
  ```

## Run

From this directory:

```
# Windows
.\scripts\start.ps1

# Mac / Linux
./scripts/start.sh
```

Then open http://localhost:8000 and log in with `user` / `password`.

Stop it with `.\scripts\stop.ps1` (or `./scripts/stop.sh`).

The start scripts build the image and run the container with `--env-file .env`, so the AI key is loaded automatically. Without it, the board works but the AI chat returns an error.

## Use

- Rename columns, drag cards between them, add and remove cards - changes persist via the backend.
- Click "Ask AI" (bottom right) to chat. Ask questions about the board, or tell it to add, move, edit, or remove cards; the board refreshes automatically when the AI makes a change.

## Tests

```
# Frontend (from frontend/)
npm install
npm run test:unit
npm run test:e2e

# Backend (in a container with the project mounted)
docker run --rm -v "<abs-path>/backend:/app" -e UV_PROJECT_ENVIRONMENT=/opt/venv -w /app kanban-pm sh -c "uv run --dev pytest -q"
```

## Notes

- The database is created automatically. The container runs with `--rm` and no volume, so the SQLite data resets when the container is removed. Add a Docker volume mapping `DB_PATH` for persistence across container removal.
- Credentials are hardcoded (`user` / `password`) for the MVP; the schema supports multiple users for the future.

## Docs

- `docs/PLAN.md` - build plan and decisions
- `docs/DATABASE.md` - schema and storage approach
- `docs/AI.md` - AI integration and endpoints
- `AGENTS.md`, `frontend/AGENTS.md`, `backend/AGENTS.md` - component overviews
