"""
Appwrite Database helper utilities.
Replaces Firebase Firestore with Appwrite.
"""

import datetime
from typing import Any
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage

client = Client()
client.set_endpoint("https://cloud.appwrite.io/v1")
client.set_project("hireadev")
client.set_key("test")  # Will be set via environment variable

databases = Databases(client)
storage = Storage(client)

DATABASE_ID = "main"
JOBS_COLLECTION = "jobs"
CANDIDATES_COLLECTION = "candidates"
EVENTS_COLLECTION = "events"


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def create_job(job_id: str, title: str, description: str, keywords: str) -> None:
    databases.create_document(
        database_id=DATABASE_ID,
        collection_id=JOBS_COLLECTION,
        document_id=job_id,
        data={
            "title": title,
            "description": description,
            "keywords": keywords,
            "status": "created",
            "createdAt": _now(),
            "completedAt": None,
            "total": 0,
            "uploaded": 0,
            "extracting": 0,
            "extracted": 0,
            "filtered": 0,
            "coarse_scored": 0,
            "deep_scored": 0,
            "completed": 0,
            "skipped": 0,
            "failed": 0,
        },
    )


def set_job_total(job_id: str, total: int) -> None:
    databases.update_document(
        database_id=DATABASE_ID,
        collection_id=JOBS_COLLECTION,
        document_id=job_id,
        data={"total": total, "status": "extracting"},
    )


def set_job_done(job_id: str) -> None:
    databases.update_document(
        database_id=DATABASE_ID,
        collection_id=JOBS_COLLECTION,
        document_id=job_id,
        data={"status": "done", "completedAt": _now()},
    )


def increment_count(job_id: str, field: str, delta: int = 1) -> None:
    doc = databases.get_document(DATABASE_ID, JOBS_COLLECTION, job_id)
    current = doc.get(field, 0)
    databases.update_document(
        database_id=DATABASE_ID,
        collection_id=JOBS_COLLECTION,
        document_id=job_id,
        data={field: current + delta},
    )


def get_job(job_id: str) -> dict | None:
    try:
        return databases.get_document(DATABASE_ID, JOBS_COLLECTION, job_id)
    except Exception:
        return None


def update_candidate(job_id: str, candidate_id: str, data: dict) -> None:
    databases.update_document(
        database_id=DATABASE_ID,
        collection_id=CANDIDATES_COLLECTION,
        document_id=candidate_id,
        data=data,
    )


def create_candidate(job_id: str, candidate_id: str, filename: str) -> None:
    databases.create_document(
        database_id=DATABASE_ID,
        collection_id=CANDIDATES_COLLECTION,
        document_id=candidate_id,
        data={
            "jobId": job_id,
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
            "rationale": None,
            "flags": None,
            "evidence": None,
            "enrichment": None,
            "shortlisted": False,
        },
    )


def get_candidate(job_id: str, candidate_id: str) -> dict | None:
    try:
        return databases.get_document(DATABASE_ID, CANDIDATES_COLLECTION, candidate_id)
    except Exception:
        return None


def get_top_candidates(job_id: str, n: int = 3) -> list[dict]:
    result = databases.list_documents(
        database_id=DATABASE_ID,
        collection_id=CANDIDATES_COLLECTION,
        queries=[f"jobId={job_id}", "status=completed"],
        limit=n,
        order_field="score",
        order_desc=True,
    )
    return [{"id": d["$id"], **d} for d in result.get("documents", [])]


def get_candidates_paginated(
    job_id: str, status: str | None, limit: int, cursor: str | None
) -> tuple[list[dict], str | None]:
    queries = [f"jobId={job_id}"]
    if status:
        queries.append(f"status={status}")

    result = databases.list_documents(
        database_id=DATABASE_ID,
        collection_id=CANDIDATES_COLLECTION,
        queries=queries,
        limit=limit,
        cursor=cursor,
        order_field="score",
        order_desc=True,
    )
    docs = result.get("documents", [])
    candidates = [{"candidateId": d["$id"], **d} for d in docs]
    next_cursor = result.get("nextCursor")
    return candidates, next_cursor


def log_event(job_id: str, message: str, event_type: str = "info") -> None:
    from appwrite.id import ID

    databases.create_document(
        database_id=DATABASE_ID,
        collection_id=EVENTS_COLLECTION,
        document_id=ID.unique(),
        data={
            "jobId": job_id,
            "message": message,
            "type": event_type,
            "timestamp": _now(),
        },
    )
