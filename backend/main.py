"""
Hire A Dev Backend — Appwrite Cloud Functions
"""

import os
import uuid
import json
import datetime


DATABASE_ID = "main"
JOBS_COLLECTION = "jobs"
CANDIDATES_COLLECTION = "candidates"
EVENTS_COLLECTION = "events"

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
]


def main(context):
    req = context.req
    res = context.res
    method = req.method
    path = req.path
    query = dict(req.query) if hasattr(req, "query") and req.query else {}

    origin = req.headers.get("origin", ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*")
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    if method == "OPTIONS":
        return res.send("", 204, {**headers, "Access-Control-Max-Age": "3600"})

    try:
        context.log(f"Method: {method}, Path: {path}, Query: {query}")

        body = {}
        body_text = req.body_text
        context.log(f"Body text: '{body_text[:100] if body_text else ''}'")

        if body_text:
            try:
                body = json.loads(body_text)
                context.log(f"Body parsed: {body}")
            except Exception as e:
                context.log(f"Body parse error: {e}")

        # Also check body for query params (Appwrite SDK sends them in body)
        if body.get("query"):
            query = body["query"]
            context.log(f"Query from body: {query}")

        if method == "POST" and "/create_job" in path:
            return handle_create_job(context, body, headers)
        elif method == "GET" and "/get_job" in path:
            return handle_get_job(context, query, headers)
        elif method == "POST" and "/shortlist_candidate" in path:
            return handle_shortlist(context, body, query, headers)
        elif method == "POST" and "/retry_candidate" in path:
            return handle_retry(context, body, query, headers)
        elif method == "GET" and "/export_shortlist" in path:
            return handle_export(context, query, headers)
        else:
            context.log(f"Route not matched: {method} {path}")
            return res.json({"error": "Not found"}, 404)
    except Exception as e:
        context.log(f"Error: {e}")
        return res.json({"error": str(e)}, 500)


def handle_create_job(context, body, headers):
    res = context.res
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    keywords = body.get("keywords", "").strip()

    if not title or not description:
        return res.json({"error": "title and description are required"}, 400)

    job_id = str(uuid.uuid4())[:8]
    context.log(f"Created job: {job_id}")

    return res.json({"jobId": job_id, "status": "created"}, 201)


def handle_get_job(context, query, headers):
    res = context.res

    body_text = context.req.body_text or ""
    body = {}
    if body_text:
        try:
            body = json.loads(body_text)
        except:
            pass

    # Get jobId from query param or body.query
    job_id = query.get("jobId") or (body.get("query") or {}).get("jobId")

    if not job_id:
        return res.json({"error": "Missing jobId"}, 400)

    context.log(f"Getting job: {job_id}")
    return res.json(
        {
            "jobId": job_id,
            "status": "created",
            "total": 0,
            "completed": 0,
            "skipped": 0,
            "failed": 0,
        }
    )


def handle_shortlist(context, body, query, headers):
    res = context.res
    job_id = body.get("jobId") or query.get("jobId")
    candidate_id = body.get("candidateId") or query.get("candidateId")

    if not job_id or not candidate_id:
        return res.json({"error": "jobId and candidateId required"}, 400)

    context.log(f"Shortlisting: {candidate_id}")
    return res.json({"status": "shortlisted"})


def handle_retry(context, body, query, headers):
    res = context.res
    job_id = body.get("jobId") or query.get("jobId")
    candidate_id = body.get("candidateId") or query.get("candidateId")

    if not job_id or not candidate_id:
        return res.json({"error": "jobId and candidateId required"}, 400)

    context.log(f"Retrying: {candidate_id}")
    return res.json({"status": "requeued"})


def handle_export(context, query, headers):
    res = context.res
    job_id = query.get("jobId")

    if not job_id:
        return res.json({"error": "Missing jobId"}, 400)

    csv_content = "Rank,Name,Email,Score\n"
    return res.text(
        csv_content,
        200,
        {
            "Content-Type": "text/csv",
            "Content-Disposition": f"attachment; filename=shortlist-{job_id}.csv",
        },
    )
