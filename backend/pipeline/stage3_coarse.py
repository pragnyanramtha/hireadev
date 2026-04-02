"""
Stage 3 — Coarse Filter (Groq 8B)
Fast, cheap scoring to eliminate bottom 60% of candidates.
"""
from utils.groq_client import chat

MODEL = "llama-3.1-8b-instant"
COARSE_THRESHOLD = 40  # Candidates below this are filtered out


def build_prompt(title: str, keywords: str, description: str, excerpt: str) -> str:
    return f"""You are a resume screener. Score this resume's relevance to the job from 0 to 100.

Job Title: {title}
Keywords: {keywords}
Job Description (summary):
{description[:800]}

Resume Excerpt:
{excerpt[:1500]}

Reply with a single integer from 0 to 100. No explanation, no punctuation. Just the number."""


def run(title: str, keywords: str, description: str, excerpt: str) -> int:
    """Returns coarse score 0-100."""
    prompt = build_prompt(title, keywords, description, excerpt)
    response = chat(prompt, model=MODEL, max_tokens=10, temperature=0.0)

    # Parse integer from response
    import re
    match = re.search(r"\d+", response)
    if match:
        score = int(match.group(0))
        return max(0, min(100, score))

    raise ValueError(f"Could not parse integer from Groq response: {response!r}")


def should_proceed(coarse_score: int) -> bool:
    return coarse_score >= COARSE_THRESHOLD
