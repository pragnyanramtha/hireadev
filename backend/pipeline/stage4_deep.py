"""
Stage 4 — Deep Scoring (Groq 70B)
Runs only on candidates that passed the coarse filter (top ~40%).
Produces structured JSON: scores, match bands, flags, rationale, evidence.
"""
from utils.groq_client import chat, extract_json

MODEL = "llama-3.3-70b-versatile"

SCHEMA = """{
  "name": "string or null",
  "email": "string or null",
  "location": "string or null",
  "yearsExp": integer or null,
  "score": integer 0-100,
  "matchBands": { "skill": 0-100, "experience": 0-100, "keyword": 0-100 },
  "flags": ["array of short risk strings, e.g. 'Job hop risk'"],
  "rationale": "2-3 sentence summary of candidate fit",
  "evidence": ["up to 3 direct quoted excerpts from the resume that justify the score"]
}"""


def build_prompt(title: str, keywords: str, description: str, full_text: str) -> str:
    return f"""You are an expert technical recruiter performing a structured evaluation.

Job Title: {title}
Mandatory Keywords: {keywords}
Full Job Description:
{description}

Candidate Resume:
{full_text[:6000]}

Evaluate the candidate and return a single valid JSON object exactly matching this schema:
{SCHEMA}

Return ONLY the JSON. No explanation, no markdown fences."""


def run(title: str, keywords: str, description: str, full_text: str) -> dict:
    """
    Returns parsed evaluation dict.
    Keys: name, email, location, yearsExp, score, matchBands, flags, rationale, evidence
    """
    prompt = build_prompt(title, keywords, description, full_text)
    raw = chat(prompt, model=MODEL, max_tokens=1024, temperature=0.1)
    result = extract_json(raw)

    # Sanitize + clamp numeric fields
    result["score"] = max(0, min(100, int(result.get("score") or 0)))
    bands = result.get("matchBands") or {}
    result["matchBands"] = {
        "skill": max(0, min(100, int(bands.get("skill") or 0))),
        "experience": max(0, min(100, int(bands.get("experience") or 0))),
        "keyword": max(0, min(100, int(bands.get("keyword") or 0))),
    }
    result["flags"] = result.get("flags") or []
    result["evidence"] = (result.get("evidence") or [])[:3]
    result["rationale"] = result.get("rationale") or ""

    return result
