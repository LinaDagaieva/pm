import os

from openai import OpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-oss-120b")


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
