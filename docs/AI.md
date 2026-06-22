# AI Integration

The backend calls an LLM via OpenRouter using the OpenAI-compatible API.

## Setup

- Provider: OpenRouter, base URL `https://openrouter.ai/api/v1`.
- Client: the `openai` Python SDK pointed at OpenRouter (`app/ai.py`).
- Model: `openai/gpt-oss-120b` (override with `OPENROUTER_MODEL`).
- Auth: `OPENROUTER_API_KEY` from the environment (`.env`, passed via `--env-file`).

## Endpoints

- `POST /api/ai/ping` (auth required) - sends "what is 2+2" and returns `{ "answer": ... }`. Connectivity smoke test. On any client/API error it returns 502 with the upstream message in `detail`.

## Connectivity status

Verified live: `POST /api/ai/ping` returns `{"answer":"4"}` (HTTP 200) against OpenRouter with `openai/gpt-oss-120b`.

(An earlier key hit a `403 Key limit exceeded` cap; replacing it resolved the issue. If the ping ever returns 502 with that message, top up credits or raise the key's limit in the OpenRouter dashboard - no code change needed.)

## Structured Outputs (Part 9)

Verified live that `openai/gpt-oss-120b` via OpenRouter supports the OpenAI-compatible `response_format` with a strict JSON schema (`{ type: "json_schema", json_schema: { strict: true, schema: ... } }`): a test request returned valid schema-conforming JSON that parsed cleanly.

Part 9 will use this directly: the model returns `{ reply, board_update? }` validated server-side against Pydantic models. No prompt-only JSON fallback is needed.
