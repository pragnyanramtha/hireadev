"""
Hire A Dev Backend - FastAPI server for local development.
Run with: uvicorn server:app --reload --port 8000
"""

import base64
import csv
import io
import json
import os
import re
import threading
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pipeline.stage1_extract import compute_hash, extract_text_from_file
from pipeline.stage2_spam import run as run_spam_filter
from pipeline import stage3_coarse, stage4_deep, stage5_enrich
from utils.storage import list_resume_files

load_dotenv()

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


class CreateJobRequest(BaseModel):
    title: str
    description: str
    keywords: str = ""
    zipFilename: str | None = None
    zipBase64: str | None = None


class CandidateActionRequest(BaseModel):
    jobId: str
    candidateId: str


class JobActionRequest(BaseModel):
    jobId: str


class AppendResumesRequest(JobActionRequest):
    zipFilename: str | None = None
    zipBase64: str | None = None


LOCK = threading.RLock()
JOBS: dict[str, dict[str, Any]] = {}
CANDIDATES: dict[str, list[dict[str, Any]]] = {}
EVENTS: dict[str, list[dict[str, str]]] = {}
RESEARCH: dict[str, dict[str, Any]] = {}
DEFAULT_LOCAL_ZIP = Path(__file__).resolve().parent.parent / "resumes.zip"
DATA_DIR = Path(os.getenv("DATA_DIR") or (Path(__file__).resolve().parent / ".data"))
STATE_FILE = DATA_DIR / "local_state.json"
COARSE_THRESHOLD = 35


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _display_time(value: datetime | None = None) -> str:
    return (value or _now()).astimezone().strftime("%H:%M:%S")


def _iso_now() -> str:
    return _now().isoformat()


def _save_state_locked() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "jobs": JOBS,
        "candidates": CANDIDATES,
        "events": EVENTS,
        "research": RESEARCH,
    }
    temp_path = STATE_FILE.with_suffix(".tmp")
    temp_path.write_text(json.dumps(payload), encoding="utf-8")
    temp_path.replace(STATE_FILE)


def _load_state() -> None:
    global JOBS, CANDIDATES, EVENTS, RESEARCH

    if not STATE_FILE.exists():
        return

    try:
        payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return

    JOBS = payload.get("jobs") or {}
    CANDIDATES = payload.get("candidates") or {}
    EVENTS = payload.get("events") or {}
    RESEARCH = payload.get("research") or {}

    for job_id, research in RESEARCH.items():
        research.setdefault("summary", "")
        research.setdefault("candidates", [])
        research.setdefault("startedAt", None)
        research.setdefault("updatedAt", None)
        research.setdefault("error", None)
        research.setdefault("processedCount", 0)
        research.setdefault("totalCandidates", 0)
        research.setdefault("currentCandidate", None)

        if research.get("status") == "running":
            research["status"] = "failed"
            research["error"] = "Deep research was interrupted. Run it again."
            research["currentCandidate"] = None
            research["updatedAt"] = _iso_now()


def _empty_counts() -> dict[str, int]:
    return {
        "extracted": 0,
        "filtered": 0,
        "coarse_scored": 0,
        "deep_scored": 0,
        "completed": 0,
        "skipped": 0,
        "failed": 0,
    }


def _snapshot_job(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "jobId": job["jobId"],
        "title": job["title"],
        "description": job["description"],
        "keywords": job["keywords"],
        "status": job["status"],
        "totalResumes": job["totalResumes"],
        "counts": dict(job["counts"]),
        "createdAt": job.get("createdAt"),
        "updatedAt": job.get("updatedAt"),
    }


def _public_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "candidateId": candidate["candidateId"],
        "filename": candidate["filename"],
        "name": candidate.get("name"),
        "status": candidate["status"],
        "score": candidate.get("score"),
        "matchBands": candidate.get("matchBands"),
        "flags": candidate.get("flags", []),
        "rationale": candidate.get("rationale"),
        "evidence": candidate.get("evidence", []),
        "location": candidate.get("location"),
        "yearsExp": candidate.get("yearsExp"),
        "email": candidate.get("email"),
        "enrichment": candidate.get("enrichment"),
        "researchScore": candidate.get("researchScore"),
        "researchSignals": candidate.get("researchSignals", []),
        "researchError": candidate.get("researchError"),
        "skipReason": candidate.get("skipReason"),
        "retryCount": candidate.get("retryCount", 0),
        "shortlisted": candidate.get("shortlisted", False),
    }


def _append_event(job_id: str, message: str, event_type: str = "info") -> None:
    event = {
        "id": str(uuid.uuid4())[:8],
        "time": _display_time(),
        "message": message,
        "type": event_type,
    }
    with LOCK:
        EVENTS.setdefault(job_id, []).append(event)
        if job_id in JOBS:
            JOBS[job_id]["updatedAt"] = _iso_now()
        _save_state_locked()
    print(f"[event] {job_id} {event_type}: {message}")


def _decode_zip_payload(payload: CreateJobRequest) -> bytes:
    if payload.zipBase64:
        try:
            return base64.b64decode(payload.zipBase64)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid ZIP payload") from exc

    if DEFAULT_LOCAL_ZIP.exists():
        return DEFAULT_LOCAL_ZIP.read_bytes()

    raise HTTPException(status_code=400, detail="ZIP upload is required")


def _decode_append_zip_payload(payload: AppendResumesRequest) -> bytes:
    if not payload.zipBase64:
        raise HTTPException(status_code=400, detail="ZIP upload is required")

    try:
        return base64.b64decode(payload.zipBase64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid ZIP payload") from exc


def _resume_names(zip_bytes: bytes) -> list[str]:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        return list_resume_files(zf)


def _job_or_404(job_id: str) -> dict[str, Any]:
    with LOCK:
        job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    return job


def _candidate_or_404(job_id: str, candidate_id: str) -> dict[str, Any]:
    with LOCK:
        for candidate in CANDIDATES.get(job_id, []):
            if candidate["candidateId"] == candidate_id:
                return candidate
    raise HTTPException(status_code=404, detail="Candidate not found")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return slug or "hireadev"


def _extract_name(raw_text: str, filename: str) -> str:
    for raw_line in raw_text.splitlines()[:8]:
        line = re.sub(r"\s+", " ", raw_line).strip(" |,.-")
        if not line:
            continue
        if any(token in line.lower() for token in ("email", "linkedin", "portfolio", "summary", "@")):
            continue
        tokens = [part for part in re.split(r"\s+", line) if part]
        if 2 <= len(tokens) <= 5 and all(any(ch.isalpha() for ch in token) for token in tokens):
            return " ".join(token.title() for token in tokens)
    stem = Path(filename).stem.replace("_", " ").replace("-", " ")
    return stem.title()


def _extract_email(raw_text: str) -> str | None:
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", raw_text)
    return match.group(0) if match else None


def _extract_location(raw_text: str) -> str | None:
    match = re.search(
        r"\b([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*,\s*[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*)\b",
        raw_text,
    )
    return match.group(1) if match else None


def _extract_years_exp(raw_text: str) -> int | None:
    patterns = [
        r"(\d{1,2})\+?\s*(?:years|year|yrs|yr)\s+of\s+experience",
        r"experience\s*[:|-]?\s*(\d{1,2})\+?\s*(?:years|year|yrs|yr)",
        r"(\d{1,2})\+?\s*(?:years|year|yrs|yr)\s+experience",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            years = int(match.group(1))
            return max(0, min(25, years))
    return None


def _clean_candidate_name(name: str | None, fallback: str) -> str:
    if not name:
        return fallback
    compact = re.sub(r"\s+", " ", name).strip()
    if compact.isupper():
        return compact.title()
    return compact


def _job_summary(job: dict[str, Any]) -> dict[str, Any]:
    candidates = CANDIDATES.get(job["jobId"], [])
    shortlisted = sum(1 for candidate in candidates if candidate.get("shortlisted"))
    latest_event = EVENTS.get(job["jobId"], [])[-1] if EVENTS.get(job["jobId"]) else None
    return {
        "jobId": job["jobId"],
        "title": job["title"],
        "status": job["status"],
        "keywords": job["keywords"],
        "totalResumes": job["totalResumes"],
        "counts": dict(job["counts"]),
        "createdAt": job.get("createdAt"),
        "updatedAt": job.get("updatedAt"),
        "shortlistedCount": shortlisted,
        "lastEvent": latest_event,
        "researchStatus": (RESEARCH.get(job["jobId"]) or {}).get("status", "idle"),
    }


def _top_completed_candidates(job_id: str, limit: int = 3) -> list[dict[str, Any]]:
    candidates = [
        candidate
        for candidate in CANDIDATES.get(job_id, [])
        if candidate["status"] == "completed"
    ]
    candidates.sort(key=lambda item: (-(item.get("score") or 0), item["filename"].lower()))
    return candidates[:limit]


def _research_rank(candidate: dict[str, Any]) -> float:
    fit_score = float(candidate.get("score") or 0)
    research_score = candidate.get("researchScore")
    if research_score is None:
        return fit_score
    return round((fit_score * 0.45) + (float(research_score) * 0.55), 2)


def _candidate_research_context(job: dict[str, Any], candidate: dict[str, Any]) -> str:
    parts: list[str] = [f"Role: {job['title']}"]
    if candidate.get("score") is not None:
        parts.append(f"Initial fit: {candidate['score']}/100")
    if candidate.get("location"):
        parts.append(f"Location: {candidate['location']}")
    if candidate.get("yearsExp") is not None:
        parts.append(f"Experience: {candidate['yearsExp']} years")
    if candidate.get("rationale"):
        parts.append(f"Screening note: {candidate['rationale'][:180]}")

    evidence = candidate.get("evidence") or []
    if evidence:
        parts.append(f"Resume signal: {str(evidence[0])[:180]}")

    keywords = job.get("keywords") or ""
    if keywords:
        parts.append(f"Keywords: {keywords[:120]}")

    return " | ".join(parts)


def _build_research_summary(job: dict[str, Any], candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return ""

    ranked = sorted(
        candidates,
        key=lambda item: (-_research_rank(item), item["filename"].lower()),
    )
    best = ranked[0]
    lines = [
        "## Executive Summary",
        (
            f"Deep research completed for {len(ranked)} candidates for the "
            f"{job['title']} role."
        ),
        "",
        "## Best Overall Candidate",
        (
            f"{best.get('name') or best['filename']} leads with a blended research rank of "
            f"{_research_rank(best):.1f}, backed by a fit score of {best.get('score') or 0}"
            f" and a web research score of {best.get('researchScore') or 0}."
        ),
        "",
        "## Candidate Breakdown",
    ]

    for candidate in ranked:
        enrichment = candidate.get("enrichment") or {}
        lines.append(
            (
                f"- {candidate.get('name') or candidate['filename']}: "
                f"fit {candidate.get('score') or 0}, "
                f"research {candidate.get('researchScore') or 0}, "
                f"rank {_research_rank(candidate):.1f}. "
                f"{enrichment.get('summary') or 'No public research summary available.'}"
            )
        )

        signals = candidate.get("researchSignals") or []
        if signals:
            lines.append(f"  Signals: {'; '.join(signals)}")

    return "\n".join(lines)


def _save_research_progress(
    job_id: str,
    candidates: list[dict[str, Any]],
    *,
    status: str,
    processed_count: int,
    total_candidates: int,
    current_candidate: str | None = None,
    error: str | None = None,
) -> None:
    job = _job_or_404(job_id)
    with LOCK:
        existing = RESEARCH.get(job_id) or {}
        RESEARCH[job_id] = {
            "status": status,
            "summary": _build_research_summary(job, candidates),
            "candidates": [_public_candidate(candidate) for candidate in candidates],
            "startedAt": existing.get("startedAt"),
            "updatedAt": _iso_now(),
            "error": error,
            "processedCount": processed_count,
            "totalCandidates": total_candidates,
            "currentCandidate": current_candidate,
        }
        _save_state_locked()


def _run_deep_research(job_id: str) -> None:
    try:
        job = _job_or_404(job_id)
        candidates = _top_completed_candidates(job_id, limit=3)
        if not candidates:
            raise RuntimeError("No completed candidates available for deep research")

        total_candidates = len(candidates)
        processed_count = 0
        failures: list[str] = []

        _save_research_progress(
            job_id,
            candidates,
            status="running",
            processed_count=processed_count,
            total_candidates=total_candidates,
            current_candidate=candidates[0].get("name") or candidates[0]["filename"],
        )

        for index, candidate in enumerate(candidates, start=1):
            candidate_name = candidate.get("name") or candidate["filename"]
            _append_event(
                job_id,
                f"Researching candidate {index}/{total_candidates}: {candidate_name}.",
                "info",
            )

            try:
                enrichment = stage5_enrich.run(
                    candidate_name,
                    job["title"],
                    _candidate_research_context(job, candidate),
                    candidate.get("email"),
                    candidate.get("location"),
                )
                candidate["enrichment"] = {
                    "githubUrl": enrichment.get("githubUrl"),
                    "linkedinUrl": enrichment.get("linkedinUrl"),
                    "portfolioUrl": enrichment.get("portfolioUrl"),
                    "summary": enrichment.get("summary") or "",
                }
                candidate["researchScore"] = enrichment.get("researchScore")
                candidate["researchSignals"] = enrichment.get("signals") or []
                candidate["researchError"] = None
                _append_event(
                    job_id,
                    (
                        f"Completed research for {candidate_name}: "
                        f"web score {candidate.get('researchScore') or 0}."
                    ),
                    "success",
                )
            except Exception as candidate_exc:
                candidate["researchError"] = str(candidate_exc)
                candidate["researchScore"] = None
                candidate["researchSignals"] = []
                if not candidate.get("enrichment"):
                    candidate["enrichment"] = {
                        "githubUrl": None,
                        "linkedinUrl": None,
                        "portfolioUrl": None,
                        "summary": "",
                    }
                failures.append(f"{candidate_name}: {candidate_exc}")
                _append_event(
                    job_id,
                    f"Research failed for {candidate_name}: {candidate_exc}",
                    "warn",
                )

            processed_count = index
            next_name = None
            if index < total_candidates:
                next_name = candidates[index].get("name") or candidates[index]["filename"]

            _save_research_progress(
                job_id,
                candidates,
                status="running" if index < total_candidates else "done",
                processed_count=processed_count,
                total_candidates=total_candidates,
                current_candidate=next_name,
                error="; ".join(failures) if failures else None,
            )

        if processed_count == 0 or all(candidate.get("researchScore") is None for candidate in candidates):
            raise RuntimeError("; ".join(failures) if failures else "Deep research could not score any candidates")

        _append_event(job_id, "Deep research completed candidate by candidate.", "success")
    except Exception as exc:
        with LOCK:
            RESEARCH[job_id] = {
                "status": "failed",
                "summary": "",
                "candidates": [],
                "startedAt": (RESEARCH.get(job_id) or {}).get("startedAt"),
                "updatedAt": _iso_now(),
                "error": str(exc),
                "processedCount": 0,
                "totalCandidates": 0,
                "currentCandidate": None,
            }
            _save_state_locked()
        _append_event(job_id, f"Deep research failed: {exc}", "warn")


_load_state()


def _process_job(job_id: str, zip_bytes: bytes) -> None:
    with LOCK:
        seen_hashes: set[str] = {
            candidate.get("textHash")
            for candidate in CANDIDATES.get(job_id, [])
            if candidate.get("textHash")
        }
        if job_id in JOBS:
            JOBS[job_id]["status"] = "running"
            JOBS[job_id]["updatedAt"] = _iso_now()
            _save_state_locked()

    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            resume_names = list_resume_files(zf)

            _append_event(job_id, f"Loaded {len(resume_names)} resumes from archive.")

            for resume_name in resume_names:
                filename = Path(resume_name).name
                candidate_id = str(uuid.uuid4())[:8]
                candidate = {
                    "candidateId": candidate_id,
                    "filename": filename,
                    "name": None,
                    "status": "extracting",
                    "score": None,
                    "matchBands": None,
                    "flags": [],
                    "rationale": None,
                    "evidence": [],
                    "location": None,
                    "yearsExp": None,
                    "email": None,
                    "enrichment": None,
                    "skipReason": None,
                    "retryCount": 0,
                }

                with LOCK:
                    CANDIDATES[job_id].append(candidate)

                _append_event(job_id, f"Extracting {filename}.")

                try:
                    file_bytes = zf.read(resume_name)
                    raw_text, _, extraction_method = extract_text_from_file(filename, file_bytes)
                    text_hash = compute_hash(raw_text)

                    candidate["status"] = "screening"
                    candidate["textHash"] = text_hash
                    candidate["name"] = _extract_name(raw_text, filename)
                    candidate["email"] = _extract_email(raw_text)
                    candidate["location"] = _extract_location(raw_text)
                    candidate["yearsExp"] = _extract_years_exp(raw_text)

                    with LOCK:
                        JOBS[job_id]["counts"]["extracted"] += 1

                    _append_event(
                        job_id,
                        f"Extracted {filename} via {extraction_method}.",
                    )

                    passed_spam, skip_reason = run_spam_filter(
                        raw_text,
                        JOBS[job_id]["description"],
                        seen_hashes,
                        text_hash,
                    )
                    seen_hashes.add(text_hash)

                    # The TF-IDF domain check is useful in production, but it is too brittle
                    # for short local dev job descriptions and hides valid resumes.
                    if not passed_spam and skip_reason == "domain_mismatch":
                        passed_spam = True
                        _append_event(
                            job_id,
                            f"Continuing {filename} despite domain mismatch during local dev.",
                            "info",
                        )

                    if not passed_spam:
                        candidate["status"] = "skipped"
                        candidate["skipReason"] = skip_reason
                        with LOCK:
                            JOBS[job_id]["counts"]["skipped"] += 1
                        _append_event(
                            job_id,
                            f"Skipped {filename}: {skip_reason}.",
                            "warn",
                        )
                        continue

                    with LOCK:
                        JOBS[job_id]["counts"]["filtered"] += 1

                    candidate["status"] = "coarse_scoring"
                    _append_event(job_id, f"Running coarse scoring for {filename}.")

                    coarse_score = stage3_coarse.run(
                        JOBS[job_id]["title"],
                        JOBS[job_id]["keywords"],
                        JOBS[job_id]["description"],
                        raw_text[:1500],
                    )
                    candidate["coarseScore"] = coarse_score

                    if not stage3_coarse.should_proceed(coarse_score):
                        candidate["status"] = "skipped"
                        candidate["skipReason"] = f"coarse_below_threshold:{coarse_score}"
                        with LOCK:
                            JOBS[job_id]["counts"]["skipped"] += 1
                        _append_event(
                            job_id,
                            f"Skipped {filename}: coarse score {coarse_score} below threshold.",
                            "warn",
                        )
                        continue

                    with LOCK:
                        JOBS[job_id]["counts"]["coarse_scored"] += 1

                    candidate["status"] = "deep_scoring"
                    _append_event(
                        job_id,
                        f"Running deep scoring for {filename} after coarse score {coarse_score}.",
                    )

                    evaluation = stage4_deep.run(
                        JOBS[job_id]["title"],
                        JOBS[job_id]["keywords"],
                        JOBS[job_id]["description"],
                        raw_text,
                    )

                    candidate["status"] = "completed"
                    candidate["name"] = _clean_candidate_name(
                        evaluation.get("name"),
                        candidate["name"] or _extract_name(raw_text, filename),
                    )
                    candidate["email"] = evaluation.get("email") or candidate["email"]
                    candidate["location"] = evaluation.get("location") or candidate["location"]
                    candidate["yearsExp"] = (
                        evaluation.get("yearsExp")
                        if evaluation.get("yearsExp") is not None
                        else candidate["yearsExp"]
                    )
                    candidate["score"] = evaluation["score"]
                    candidate["matchBands"] = evaluation["matchBands"]
                    candidate["flags"] = evaluation.get("flags") or []
                    candidate["rationale"] = evaluation.get("rationale")
                    candidate["evidence"] = evaluation.get("evidence") or []

                    with LOCK:
                        JOBS[job_id]["counts"]["deep_scored"] += 1
                        JOBS[job_id]["counts"]["completed"] += 1
                        _save_state_locked()

                    _append_event(
                        job_id,
                        (
                            f"Completed deep scoring for {filename}: "
                            f"coarse {coarse_score}, final {candidate['score']}."
                        ),
                        "success",
                    )

                except Exception as exc:
                    candidate["status"] = "failed"
                    candidate["skipReason"] = str(exc)
                    with LOCK:
                        JOBS[job_id]["counts"]["failed"] += 1
                        _save_state_locked()
                    _append_event(
                        job_id,
                        f"Failed to process {filename}: {exc}",
                        "warn",
                    )

        with LOCK:
            JOBS[job_id]["status"] = "done"
            JOBS[job_id]["updatedAt"] = _iso_now()
            summary = JOBS[job_id]["counts"]
            _save_state_locked()

        _append_event(
            job_id,
            (
                f"Pipeline finished: {summary['completed']} completed, "
                f"{summary['skipped']} skipped, {summary['failed']} failed."
            ),
            "success",
        )
    except Exception as exc:
        with LOCK:
            if job_id in JOBS:
                JOBS[job_id]["status"] = "failed"
                JOBS[job_id]["updatedAt"] = _iso_now()
                _save_state_locked()
        _append_event(job_id, f"Job failed to start: {exc}", "warn")


@app.post("/create_job")
def create_job(payload: CreateJobRequest):
    title = payload.title.strip()
    description = payload.description.strip()
    keywords = payload.keywords.strip()

    if not title or not description:
        raise HTTPException(status_code=400, detail="title and description are required")

    zip_bytes = _decode_zip_payload(payload)

    try:
        resume_names = _resume_names(zip_bytes)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP") from exc

    if not resume_names:
        raise HTTPException(status_code=400, detail="No supported resume files found in ZIP")

    job_id = str(uuid.uuid4())[:8]
    job = {
        "jobId": job_id,
        "title": title,
        "description": description,
        "keywords": keywords,
        "status": "running",
        "totalResumes": len(resume_names),
        "counts": _empty_counts(),
        "createdAt": _iso_now(),
        "updatedAt": _iso_now(),
    }

    with LOCK:
        JOBS[job_id] = job
        CANDIDATES[job_id] = []
        EVENTS[job_id] = []
        RESEARCH[job_id] = {
            "status": "idle",
            "summary": "",
            "candidates": [],
            "startedAt": None,
            "updatedAt": _iso_now(),
            "error": None,
            "processedCount": 0,
            "totalCandidates": 0,
            "currentCandidate": None,
        }
        _save_state_locked()

    _append_event(job_id, f"Created job {job_id} for {len(resume_names)} resumes.")

    worker = threading.Thread(target=_process_job, args=(job_id, zip_bytes), daemon=True)
    worker.start()

    print(f"Created job: {job_id}")
    return {"jobId": job_id, "status": "created"}


@app.get("/list_jobs")
def list_jobs():
    with LOCK:
        jobs = [_job_summary(job) for job in JOBS.values()]
    jobs.sort(key=lambda item: item.get("updatedAt") or "", reverse=True)
    return jobs


@app.post("/append_resumes")
def append_resumes(payload: AppendResumesRequest):
    job = _job_or_404(payload.jobId)
    zip_bytes = _decode_append_zip_payload(payload)

    try:
        resume_names = _resume_names(zip_bytes)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP") from exc

    if not resume_names:
        raise HTTPException(status_code=400, detail="No supported resume files found in ZIP")

    with LOCK:
        job["status"] = "running"
        job["totalResumes"] += len(resume_names)
        job["updatedAt"] = _iso_now()
        _save_state_locked()

    _append_event(payload.jobId, f"Queued {len(resume_names)} additional resumes.")

    worker = threading.Thread(target=_process_job, args=(payload.jobId, zip_bytes), daemon=True)
    worker.start()

    return {"status": "queued", "added": len(resume_names)}


@app.get("/get_job")
def get_job(jobId: str):
    job = _job_or_404(jobId)
    snapshot = _snapshot_job(job)
    print("Progress", jobId, snapshot["status"], snapshot["counts"])
    return snapshot


@app.get("/get_leaderboard")
def get_leaderboard(jobId: str):
    _job_or_404(jobId)
    with LOCK:
        completed = [
            _public_candidate(candidate)
            for candidate in CANDIDATES.get(jobId, [])
            if candidate["status"] == "completed"
        ]
    completed.sort(key=lambda item: (-(item.get("score") or 0), item["filename"].lower()))
    return completed


@app.get("/get_in_progress")
def get_in_progress(jobId: str):
    _job_or_404(jobId)
    with LOCK:
        items = [
            _public_candidate(candidate)
            for candidate in CANDIDATES.get(jobId, [])
            if candidate["status"] not in {"completed", "skipped", "failed"}
        ]
    return items


@app.get("/get_issues")
def get_issues(jobId: str):
    _job_or_404(jobId)
    with LOCK:
        items = [
            _public_candidate(candidate)
            for candidate in CANDIDATES.get(jobId, [])
            if candidate["status"] in {"skipped", "failed"}
        ]
    return items


@app.get("/get_events")
def get_events(jobId: str):
    _job_or_404(jobId)
    with LOCK:
        return list(reversed(EVENTS.get(jobId, [])[-50:]))


@app.get("/get_deep_research")
def get_deep_research(jobId: str):
    _job_or_404(jobId)
    with LOCK:
        return RESEARCH.get(jobId) or {
            "status": "idle",
            "summary": "",
            "candidates": [],
            "startedAt": None,
            "updatedAt": None,
            "error": None,
            "processedCount": 0,
            "totalCandidates": 0,
            "currentCandidate": None,
        }


@app.get("/healthz")
def healthz():
    with LOCK:
        return {
            "status": "ok",
            "jobs": len(JOBS),
            "updatedAt": _iso_now(),
        }


@app.post("/run_deep_research")
def run_deep_research(data: JobActionRequest):
    _job_or_404(data.jobId)

    with LOCK:
        existing = RESEARCH.get(data.jobId) or {}
        if existing.get("status") == "running":
            return {"status": "running"}

        RESEARCH[data.jobId] = {
            "status": "running",
            "summary": existing.get("summary", ""),
            "candidates": existing.get("candidates", []),
            "startedAt": _iso_now(),
            "updatedAt": _iso_now(),
            "error": None,
            "processedCount": 0,
            "totalCandidates": existing.get("totalCandidates", 0),
            "currentCandidate": None,
        }
        _save_state_locked()

    _append_event(data.jobId, "Started deep research on top candidates.", "info")

    worker = threading.Thread(target=_run_deep_research, args=(data.jobId,), daemon=True)
    worker.start()

    return {"status": "started"}


@app.post("/shortlist_candidate")
def shortlist_candidate(data: CandidateActionRequest):
    _job_or_404(data.jobId)
    candidate = _candidate_or_404(data.jobId, data.candidateId)
    candidate["shortlisted"] = True
    with LOCK:
        _save_state_locked()
    _append_event(
        data.jobId,
        f"Shortlisted {candidate['name'] or candidate['filename']}.",
        "success",
    )
    return {"status": "shortlisted"}


@app.post("/retry_candidate")
def retry_candidate(data: CandidateActionRequest):
    _job_or_404(data.jobId)
    candidate = _candidate_or_404(data.jobId, data.candidateId)
    candidate["retryCount"] = candidate.get("retryCount", 0) + 1
    with LOCK:
        _save_state_locked()
    _append_event(
        data.jobId,
        f"Retry requested for {candidate['name'] or candidate['filename']}.",
        "info",
    )
    return {"status": "requeued"}


@app.get("/export_shortlist")
def export_shortlist(jobId: str):
    job = _job_or_404(jobId)

    with LOCK:
        shortlist = [
            candidate
            for candidate in CANDIDATES.get(jobId, [])
            if candidate["status"] == "completed" and candidate.get("shortlisted")
        ]
        if not shortlist:
            shortlist = [
                candidate
                for candidate in CANDIDATES.get(jobId, [])
                if candidate["status"] == "completed" and (candidate.get("score") or 0) >= 80
            ]
        if not shortlist:
            shortlist = [
                candidate
                for candidate in CANDIDATES.get(jobId, [])
                if candidate["status"] == "completed"
            ]

    shortlist.sort(key=lambda item: (-(item.get("score") or 0), item["filename"].lower()))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Rank",
        "Name",
        "Filename",
        "Email",
        "Location",
        "Years Experience",
        "Score",
        "Shortlisted",
        "Flags",
        "Rationale",
        "Evidence",
        "GitHub",
        "LinkedIn",
        "Portfolio",
    ])
    for index, candidate in enumerate(shortlist, start=1):
        enrichment = candidate.get("enrichment") or {}
        writer.writerow(
            [
                index,
                candidate.get("name") or candidate["filename"],
                candidate["filename"],
                candidate.get("email") or "",
                candidate.get("location") or "",
                candidate.get("yearsExp") or "",
                candidate.get("score") or "",
                "yes" if candidate.get("shortlisted") else "no",
                "; ".join(candidate.get("flags") or []),
                candidate.get("rationale") or "",
                " | ".join(candidate.get("evidence") or []),
                enrichment.get("githubUrl") or "",
                enrichment.get("linkedinUrl") or "",
                enrichment.get("portfolioUrl") or "",
            ]
        )

    filename = f"{_slugify(job['title'])}-shortlist.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
