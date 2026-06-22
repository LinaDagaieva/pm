import os

from openai import OpenAI
from pydantic import BaseModel

from app.models import Board, Card, Column

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-oss-120b")

SYSTEM_PROMPT = (
    "You are a project management assistant for a single Kanban board. "
    "You can answer questions about the board and optionally modify it. "
    "When the user asks to add, edit, move, or remove cards, or rename a column, "
    "return the full updated board in board_update; otherwise set board_update to null. "
    "Always include a short, friendly reply for the user. "
    "Keep existing ids stable and generate new unique string ids for new cards. "
    "Do not add or remove columns - only rename them or move cards between them. "
    "Every id listed in a column's cardIds must exist in cards. "
    "Do not use emojis."
)


# AI-facing board: cards as a list (OpenAI strict json_schema does not support
# arbitrary-key maps). Converted to/from the internal Board (cards map).
class AiBoard(BaseModel):
    columns: list[Column]
    cards: list[Card]


class ChatResult(BaseModel):
    reply: str
    board_update: AiBoard | None = None


def board_to_ai_board(board: Board) -> AiBoard:
    return AiBoard(columns=board.columns, cards=list(board.cards.values()))


def ai_board_to_board(ai_board: AiBoard) -> Board:
    return Board(
        columns=ai_board.columns,
        cards={card.id: card for card in ai_board.cards},
    )


def _client() -> OpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    return OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)


def ask(question: str) -> str:
    """Send a single question to the model and return its text answer."""
    response = _client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": question}],
    )
    return response.choices[0].message.content or ""


def chat(message: str, history: list[dict], board: Board) -> ChatResult:
    """Ask the model about the board, optionally returning a board update."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"Current board JSON:\n{board_to_ai_board(board).model_dump_json()}",
        },
        *history,
        {"role": "user", "content": message},
    ]
    completion = _client().chat.completions.parse(
        model=MODEL,
        messages=messages,
        response_format=ChatResult,
    )
    result = completion.choices[0].message.parsed
    if result is None:
        raise RuntimeError("AI returned no structured output")
    return result
