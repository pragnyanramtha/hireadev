"""
Hire A Dev Backend — FastAPI Server
Run with: uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS = {}


@app.post("/create_job")
def create_job(data: dict):
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    keywords = data.get("keywords", "").strip()

    if not title or not description:
        raise HTTPException(
            status_code=400, detail="title and description are required"
        )

    job_id = str(uuid.uuid4())[:8]
    JOBS[job_id] = {
        "jobId": job_id,
        "title": title,
        "description": description,
        "keywords": keywords,
        "status": "created",
        "total": 0,
        "completed": 0,
        "skipped": 0,
        "failed": 0,
    }

    print(f"Created job: {job_id}")
    return {"jobId": job_id, "status": "created"}


@app.get("/get_job")
def get_job(jobId: str):
    if not jobId:
        raise HTTPException(status_code=400, detail="Missing jobId")

    job = JOBS.get(jobId)
    if not job:
        raise HTTPException(status_code=404, detail="Not found")

    return job


@app.post("/shortlist_candidate")
def shortlist_candidate(data: dict):
    job_id = data.get("jobId")
    candidate_id = data.get("candidateId")

    if not job_id or not candidate_id:
        raise HTTPException(status_code=400, detail="jobId and candidateId required")

    return {"status": "shortlisted"}


@app.post("/retry_candidate")
def retry_candidate(data: dict):
    job_id = data.get("jobId")
    candidate_id = data.get("candidateId")

    if not job_id or not candidate_id:
        raise HTTPException(status_code=400, detail="jobId and candidateId required")

    return {"status": "requeued"}


@app.get("/export_shortlist")
def export_shortlist(jobId: str):
    if not jobId:
        raise HTTPException(status_code=400, detail="Missing jobId")

    return "Rank,Name,Email,Score\n"


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
