"""
Firestore helper utilities.
All writes go through these helpers to maintain a consistent schema.
"""
import datetime
from typing import Any
import firebase_admin
from firebase_admin import firestore

db = firestore.client()


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


# ─── Job helpers ────────────────────────────────────────────────────────────

def create_job(job_id: str, title: str, description: str, keywords: str) -> None:
    db.collection("jobs").document(job_id).set({
        "title": title,
        "description": description,
        "keywords": keywords,
        "status": "created",
        "createdAt": _now(),
        "completedAt": None,
        "totalResumes": 0,
        "counts": {
            "uploaded": 0,
            "extracting": 0,
            "extracted": 0,
            "filtered": 0,
            "coarse_scored": 0,
            "deep_scored": 0,
            "completed": 0,
            "skipped": 0,
            "failed": 0,
            "retrying": 0,
        },
    })


def set_job_total(job_id: str, total: int) -> None:
    db.collection("jobs").document(job_id).update({
        "totalResumes": total,
        "status": "extracting",
    })


def set_job_done(job_id: str) -> None:
    db.collection("jobs").document(job_id).update({
        "status": "done",
        "completedAt": _now(),
    })


def increment_count(job_id: str, field: str, delta: int = 1) -> None:
    db.collection("jobs").document(job_id).update({
        f"counts.{field}": firestore.Increment(delta),
    })


def get_job(job_id: str) -> dict | None:
    doc = db.collection("jobs").document(job_id).get()
    return doc.to_dict() if doc.exists else None


# ─── Candidate helpers ───────────────────────────────────────────────────────

def create_candidate(job_id: str, candidate_id: str, filename: str) -> None:
    db.collection("jobs").document(job_id)\
      .collection("candidates").document(candidate_id).set({
        "filename": filename,
        "status": "uploaded",
        "skipReason": None,
        "retryCount": 0,
        "name": None,
        "email": None,
        "location": None,
        "yearsExp": None,
        "coarseScore": None,
        "score": None,
        "matchBands": None,
        "excerpt": None,
        "rawText": None,
        "rationale": None,
        "flags": [],
        "evidence": [],
        "enrichment": None,
        "processedAt": None,
    })


def update_candidate(job_id: str, candidate_id: str, data: dict) -> None:
    db.collection("jobs").document(job_id)\
      .collection("candidates").document(candidate_id).update(data)


def get_candidate(job_id: str, candidate_id: str) -> dict | None:
    doc = db.collection("jobs").document(job_id)\
            .collection("candidates").document(candidate_id).get()
    return doc.to_dict() if doc.exists else None


def get_top_candidates(job_id: str, n: int = 3) -> list[dict]:
    docs = db.collection("jobs").document(job_id)\
             .collection("candidates")\
             .where("status", "in", ["deep_scored", "completed"])\
             .order_by("score", direction=firestore.Query.DESCENDING)\
             .limit(n).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def get_candidates_paginated(job_id: str, status: str | None, limit: int, cursor: str | None) -> tuple[list[dict], str | None]:
    ref = db.collection("jobs").document(job_id).collection("candidates")

    query = ref.order_by("score", direction=firestore.Query.DESCENDING).limit(limit)
    if status:
        query = ref.where("status", "==", status)\
                   .order_by("score", direction=firestore.Query.DESCENDING).limit(limit)

    if cursor:
        last_doc = ref.document(cursor).get()
        if last_doc.exists:
            query = query.start_after(last_doc)

    docs = list(query.stream())
    candidates = [{"candidateId": d.id, **d.to_dict()} for d in docs]
    next_cursor = docs[-1].id if len(docs) == limit else None
    return candidates, next_cursor


def count_terminal(job_id: str) -> tuple[int, int]:
    """Returns (terminal_count, total_resumes)."""
    job = get_job(job_id)
    if not job:
        return 0, 0
    counts = job.get("counts", {})
    terminal = counts.get("completed", 0) + counts.get("skipped", 0) + counts.get("failed", 0)
    return terminal, job.get("totalResumes", 0)


# ─── Event log helpers ───────────────────────────────────────────────────────

def log_event(job_id: str, message: str, event_type: str = "info") -> None:
    """event_type: 'info' | 'success' | 'warn'"""
    db.collection("jobs").document(job_id)\
      .collection("events").add({
        "message": message,
        "type": event_type,
        "timestamp": _now(),
    })
