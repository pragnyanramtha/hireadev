"""
Stage 5 — Enrichment (Lazy, Top 3 Only)
Uses Groq Compound beta with web search for GitHub, LinkedIn, portfolio discovery.
Only fires after the entire pipeline is stable (all terminal states reached).
"""
from utils.groq_client import chat, extract_json

MODEL = "compound-beta"  # Groq Compound with built-in web search

SCHEMA = """{
  "githubUrl": "string or null",
  "linkedinUrl": "string or null",
  "portfolioUrl": "string or null",
  "summary": "2 short sentences about the candidate's public professional profile and fit for the target role",
  "researchScore": "integer from 0 to 100",
  "signals": ["up to 3 short bullets describing useful public signals"]
}"""


def build_prompt(
    name: str,
    role: str,
    context: str,
    email: str | None,
    location: str | None,
) -> str:
    location_hint = f" based in {location}" if location else ""
    email_hint = f" (email for disambiguation: {email})" if email else ""
    context_hint = f"\nCandidate context: {context}" if context else ""
    return f"""Research this candidate's public professional web presence for the target role below.

Candidate name: {name}{location_hint}{email_hint}
Target role: {role}{context_hint}

Search for public signals only. Keep the output compact.

Return one valid JSON object matching this schema:
{SCHEMA}

Return ONLY the JSON. No markdown. No explanation."""


def run(
    name: str,
    role: str,
    context: str = "",
    email: str | None = None,
    location: str | None = None,
) -> dict:
    """
    Returns enrichment dict.
    Keys: githubUrl, linkedinUrl, portfolioUrl, summary, researchScore, signals
    """
    prompt = build_prompt(name, role, context, email, location)
    raw = chat(prompt, model=MODEL, max_tokens=320, temperature=0.1)
    result = extract_json(raw)

    return {
        "githubUrl": result.get("githubUrl"),
        "linkedinUrl": result.get("linkedinUrl"),
        "portfolioUrl": result.get("portfolioUrl"),
        "summary": result.get("summary") or "",
        "researchScore": max(0, min(100, int(result.get("researchScore") or 0))),
        "signals": (result.get("signals") or [])[:3],
    }
