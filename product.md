# hireadev — Product Overview

## The Problem
Recruiting teams spend countless hours manually sifting through hundreds of raw resumes (PDFs, DOCX files) just to find a handful of qualified candidates. Existing ATS (Applicant Tracking Systems) either rely on exact keyword matching (which misses semantic context) or use excessively slow and expensive third-party AI for every candidate, ballooning costs.

## The Solution
**hireadev** is an AI-powered resume intelligence platform built for lean hiring teams. It turns a 6-hour manual review pipeline into a quick, second decision by leveraging a **tiered multi-agent AI pipeline**.

HR professionals simply upload a job description and a batch of resumes (via a drag-and-drop folder or ZIP). Our system processes them automatically.



## How It Works (The 5-Stage Pipeline)
1. **Local Extraction**: Uses `PyMuPDF` and `pytesseract` to extract raw text seamlessly without expensive API hits.
2. **Spam Filter**: Rule-based dropping of junk resumes (e.g., word count < 80, mismatched languages). Drops ~20-30% of noise for free.
3. **Coarse Filter**: Utilizes the ultra-fast Llama 3.1 8B model to score candidates 1-10 on basic JD relevance. Keeps the top 40%.
4. **Deep Evaluation**: Uses the powerful Llama 3.3 70B model to generate structured JSON outputs (Skill matches, Red Flags, Strengths, Gaps, Overall scores). Only applied to the top 40% to save costs.
5. **Enrichment**: The top 3 finalists undergo a web search agent to pull GitHub activity, LinkedIn presence, and portfolio data.

## Value Proposition
- **Extreme Speed**: Multi-tiered funnel filters garbage in seconds.
- **Cost Effective**: Using cheap 8B models for the bulk queue prevents massive API limits, saving the expensive 70B analysis only for qualified candidates.
- **Deep Insights**: HR sees a ranked leaderboard with instant gap analysis and red flags flagged immediately.

#### frontend : react + vite + tailwind css / vannila css
#### backend : python + uv pip + fastapi + llama 3.1 8b- llama 3.3 70b (groq) + pytesseract + pymupdf

Phase 1: Frontend Development (Completed with UI UX Pro Max updates)
We have built a robust, premium Application utilizing the new hierarchical design system:

Master Style (Saas): 
1. Landing Page

Hero Section: High-conversion CTA.

Pricing Section: Free 0 , Pro 2000 rs , Enterprise custom .

FAQ & Contact: for common questions and a clear contact form.

2. Job Creation Dashboard (/create)

Upload Area: Fully interactive Folder (webkitdirectory) + .zip parsing dropzone.

3. Job Details & Leaderboard Dashboard (/dashboard)

Agent Progress Analytics: Sleek progression tracker showing how many resumes have passed each stage.
while analysing , they should be able to see a the agent progress , as how much of resumes is actually completed. 
Leaderboard Table: All scored candidates ranked logically. Expanded view for Top 3 profiles.


Raw Resumes (ZIP/Folder)
        │
        ▼
[STAGE 1 — Extraction] (No AI, Free)
  PyMuPDF / pdfplumber for PDFs
  python-docx for DOCX
  pytesseract OCR for scanned/image PDFs
  → Output: raw_text per resume
        │
        ▼
[STAGE 2 — Spam Filter] (No AI, Free)
  Rule-based: min word count > 80
  Language detection (langdetect)
  Domain mismatch check (keywords vs JD nouns)
  Duplicate detection (hash)
  → Drops ~20-30% of junk
        │
        ▼
[STAGE 3 — Coarse Filter] (llama-3.1-8b-instant, Fast+Cheap)
  Prompt: "Score 1-100, is this resume relevant to [JD summary]?"
  Batch all remaining resumes
  Keep top ~40% by score
  → Groq: ~0.05s/resume, very cheap
        │
        ▼
[STAGE 4 — Deep Scoring] (llama-3.3-70b, Powerful)
  Structured JSON output: skills match, experience score,
  red flags, strengths, gaps, overall score
  Only runs on top 40% → effectively top candidates
  → Groq: richer, slower, costlier — but minimal volume
        │
        ▼
[STAGE 5 — Enrichment] (Groq Compound)
  Web search on top 3 candidates:
  GitHub activity, LinkedIn presence, published work,
  open source contributions, portfolio sites
  → Groq Compound: uses search internally
        │
        ▼
[OUTPUT — Dashboard]
  Ranked leaderboard (all scored candidates, mostly top 10)
  Top 3 detailed profiles with AI summary
  Web-enriched insights for finalists
  Analytics: skill gap heatmap, experience distribution,
  red flag frequency, time-to-screen saved