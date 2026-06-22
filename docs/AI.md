# AI Integration

The backend calls an LLM via OpenRouter using the OpenAI-compatible API.

## Setup

- Provider: OpenRouter, base URL `https://openrouter.ai/api/v1`.
- Client: the `openai` Python SDK pointed at OpenRouter (`app/ai.py`).
- Model: `openai/gpt-oss-120b` (override with `OPENROUTER_MODEL`).
- Auth: `OPENROUTER_API_KEY` from the environment (`.env`, passed via `--env-file`).

## Endpoints

- `POST /api/ai/ping` (auth required) - sends "what is 2+2" and returns `{ "answer": ... }`. Connectivity smoke test. On any client/API error it returns 502 with the upstream message in `detail`.
- `POST /api/ai/chat` (auth required) - body `{ message, history: [{ role, content }] }`. The server attaches the current board JSON and asks the model for structured output `ChatResult { reply, board_update? }`. If `board_update` is present it is converted and persisted; the response is `{ reply, board: BoardData | null }`. Errors return 502 with the upstream message.

## Chat board schema

The internal `Board` stores `cards` as a map (`dict[str, Card]`), which strict `json_schema` cannot express (no arbitrary-key maps). The AI-facing `AiBoard` therefore uses `cards` as a list; `app/ai.py` converts between the two (`board_to_ai_board` / `ai_board_to_board`). The model is instructed to keep columns fixed, keep ids stable, generate new ids for new cards, keep `cardIds` consistent with `cards`, and avoid emojis.

## Connectivity status

Verified live: `POST /api/ai/ping` returns `{"answer":"4"}` (HTTP 200) against OpenRouter with `openai/gpt-oss-120b`.

(An earlier key hit a `403 Key limit exceeded` cap; replacing it resolved the issue. If the ping ever returns 502 with that message, top up credits or raise the key's limit in the OpenRouter dashboard - no code change needed.)

## Structured Outputs (Part 9)

Verified live that `openai/gpt-oss-120b` via OpenRouter supports the OpenAI-compatible `response_format` with a strict JSON schema (`{ type: "json_schema", json_schema: { strict: true, schema: ... } }`): a test request returned valid schema-conforming JSON that parsed cleanly.

Part 9 will use this directly: the model returns `{ reply, board_update? }` validated server-side against Pydantic models. No prompt-only JSON fallback is needed.
