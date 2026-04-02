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
  "summary": "2-sentence summary of the candidate's online professional presence"
}"""


def build_prompt(name: str, email: str | None, location: str | None) -> str:
    location_hint = f" based in {location}" if location else ""
    email_hint = f" (email for disambiguation: {email})" if email else ""
    return f"""Search the web for the professional online presence of: {name}, software engineer{location_hint}{email_hint}.

Find their:
- GitHub profile URL
- LinkedIn profile URL
- Portfolio or personal site URL
- A brief 2-sentence summary of their online professional activity

Return a single valid JSON object matching this schema:
{SCHEMA}

Return ONLY the JSON. No markdown, no explanation."""


def run(name: str, email: str | None = None, location: str | None = None) -> dict:
    """
    Returns enrichment dict.
    Keys: githubUrl, linkedinUrl, portfolioUrl, summary
    """
    prompt = build_prompt(name, email, location)
    raw = chat(prompt, model=MODEL, max_tokens=512, temperature=0.1)
    result = extract_json(raw)

    return {
        "githubUrl": result.get("githubUrl"),
        "linkedinUrl": result.get("linkedinUrl"),
        "portfolioUrl": result.get("portfolioUrl"),
        "summary": result.get("summary") or "",
    }
