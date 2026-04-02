"""
Groq API client with retry + exponential backoff.
"""
import time
import os
import json
import re
from groq import Groq, RateLimitError, APIError

_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable not set")
        _client = Groq(api_key=api_key)
    return _client


def chat(
    prompt: str,
    model: str,
    max_retries: int = 3,
    backoff_base: float = 2.0,
    temperature: float = 0.1,
    max_tokens: int = 2048,
) -> str:
    """Send a chat completion request with retry on rate limits."""
    client = get_client()
    last_exc = None

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()

        except RateLimitError as e:
            last_exc = e
            wait = backoff_base ** attempt
            print(f"[groq] rate limited, waiting {wait}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)

        except APIError as e:
            last_exc = e
            if attempt < max_retries - 1:
                time.sleep(backoff_base ** attempt)
            continue

    raise last_exc or RuntimeError("Groq request failed after retries")


def extract_json(text: str) -> dict:
    """Extract first JSON object from a string response."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON block from markdown
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"No valid JSON found in response: {text[:300]}")
