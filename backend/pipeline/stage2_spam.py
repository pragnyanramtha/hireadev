"""
Stage 2 — Spam Filter (no AI, free)
Rules: word count, language, domain mismatch, duplicate detection.
"""
import re
from langdetect import detect, LangDetectException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


MIN_WORD_COUNT = 80
DOMAIN_SIMILARITY_THRESHOLD = 0.05


def run(raw_text: str, job_description: str, seen_hashes: set[str], text_hash: str) -> tuple[bool, str | None]:
    """
    Returns:
        (passed: bool, skip_reason: str | None)
    """
    # 1. Word count
    word_count = len(raw_text.split())
    if word_count < MIN_WORD_COUNT:
        return False, "word_count_too_low"

    # 2. Language detection
    try:
        lang = detect(raw_text[:500])
        if lang != "en":
            return False, "language_mismatch"
    except LangDetectException:
        pass  # Can't detect — give benefit of the doubt

    # 3. Duplicate detection
    if text_hash in seen_hashes:
        return False, "duplicate"

    # 4. Domain mismatch (TF-IDF cosine vs JD)
    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=500)
        tfidf = vectorizer.fit_transform([job_description, raw_text])
        sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        if sim < DOMAIN_SIMILARITY_THRESHOLD:
            return False, "domain_mismatch"
    except Exception:
        pass  # If vectorization fails, skip this check

    return True, None
