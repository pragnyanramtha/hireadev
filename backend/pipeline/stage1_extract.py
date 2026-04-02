"""
Stage 1 — Text Extraction
Handles: PDF (PyMuPDF + pytesseract fallback), DOCX, DOC, PNG, JPG, JPEG
"""
import io
import os
import hashlib
import zipfile

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from docx import Document


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
MIN_PDF_TEXT_LEN = 100  # If less than this chars, fall back to OCR


def extract_text_from_file(filename: str, file_bytes: bytes) -> tuple[str, str | None, str]:
    """
    Returns:
        (raw_text, image_bytes_or_none, extraction_method)
    
    image_bytes: raw bytes of the image used for OCR (if applicable), else None.
    extraction_method: "pymupdf" | "ocr_pdf" | "docx" | "ocr_image"
    """
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        return _extract_pdf(file_bytes)

    elif ext in (".docx", ".doc"):
        return _extract_docx(file_bytes), None, "docx"

    elif ext in IMAGE_EXTENSIONS:
        text, img_bytes = _ocr_image_bytes(file_bytes)
        return text, img_bytes, "ocr_image"

    raise ValueError(f"Unsupported extension: {ext}")


def _extract_pdf(file_bytes: bytes) -> tuple[str, bytes | None, str]:
    doc = fitz.open(stream=file_bytes, filetype="pdf")

    # Try text extraction first
    full_text = ""
    for page in doc:
        full_text += page.get_text()

    if len(full_text.strip()) >= MIN_PDF_TEXT_LEN:
        doc.close()
        return full_text.strip(), None, "pymupdf"

    # Fallback: render first page to image and OCR
    page = doc[0]
    mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR quality
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    doc.close()

    ocr_text, _ = _ocr_image_bytes(img_bytes)
    return ocr_text, img_bytes, "ocr_pdf"


def _extract_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _ocr_image_bytes(img_bytes: bytes) -> tuple[str, bytes]:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    text = pytesseract.image_to_string(img)
    return text.strip(), img_bytes


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
