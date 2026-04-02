"""
ZIP file helper — no Storage. Only used to list and read files from an in-memory ZipFile.
"""
import os
import zipfile

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"}


def list_resume_files(zf: zipfile.ZipFile) -> list[str]:
    """Return all filenames from ZIP matching allowed extensions."""
    return [
        name for name in zf.namelist()
        if not name.startswith("__MACOSX")
        and not os.path.basename(name).startswith(".")
        and os.path.splitext(name)[1].lower() in ALLOWED_EXTENSIONS
        and not name.endswith("/")
    ]
