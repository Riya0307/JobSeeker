import hashlib
import re
from dataclasses import dataclass
from datetime import datetime

from django.db import transaction
from django.utils import timezone
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from apps.jobs.normalization import normalize_job_skills

from .models import Resume, ResumeParsedData


PARSER_VERSION = "1.0"


class ResumeParsingError(Exception):
    pass


@dataclass(frozen=True)
class ParsedResume:
    text: str
    skills: list[str]
    job_titles: list[str]
    companies: list[str]
    employment_history: list[dict]
    education: list[dict]
    projects: list[dict]
    certifications: list[dict]
    estimated_experience_months: int | None


def compute_file_hash(resume: Resume) -> str:
    digest = hashlib.sha256()
    try:
        with resume.file.storage.open(resume.file.name, "rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
    except (OSError, ValueError) as exc:
        raise ResumeParsingError("The resume file could not be read.") from exc
    return digest.hexdigest()


def extract_pdf_text(resume: Resume) -> str:
    try:
        with resume.file.storage.open(resume.file.name, "rb") as source:
            pages = [(page.extract_text() or "") for page in PdfReader(source).pages]
    except (PdfReadError, OSError, ValueError, TypeError) as exc:
        raise ResumeParsingError("The uploaded PDF could not be parsed.") from exc
    text = "\n\n".join(pages).replace("\x00", " ")
    lines = [re.sub(r"[\t\v\f\r ]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


SECTION_NAMES = {
    "skills": {"skills", "technical skills", "core skills", "technologies"},
    "experience": {"experience", "work experience", "professional experience", "employment", "employment history"},
    "education": {"education", "academic background", "qualifications"},
    "projects": {"projects", "selected projects", "personal projects", "academic projects"},
    "certifications": {"certifications", "certificates", "licenses and certifications"},
}
HEADING_LOOKUP = {name.casefold(): key for key, names in SECTION_NAMES.items() for name in names}
DATE_PART = r"(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{4}|(?:0?[1-9]|1[0-2])/\d{4}|\d{4})"
DATE_RANGE = re.compile(
    rf"(?P<start>{DATE_PART})\s*(?:-|–|—|to)\s*(?P<end>present|current|now|{DATE_PART})",
    re.I,
)


def _sections(text: str) -> dict[str, list[str]]:
    result = {key: [] for key in SECTION_NAMES}
    current = None
    for raw in text.splitlines():
        line = " ".join(raw.split())
        heading = re.sub(r"[:\-]+$", "", line).strip().casefold()
        if heading in HEADING_LOOKUP:
            current = HEADING_LOOKUP[heading]
        elif current and line:
            result[current].append(line)
    return result


def _month(value: str, now: datetime) -> int:
    cleaned = " ".join(value.casefold().split())
    if cleaned in {"present", "current", "now"}:
        return now.year * 12 + now.month - 1
    match = re.search(r"(\d{4})$", cleaned)
    if not match:
        raise ValueError
    year = int(match.group(1))
    names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    numeric = re.match(r"(0?[1-9]|1[0-2])/(\d{4})", cleaned)
    if numeric:
        return int(numeric.group(2)) * 12 + int(numeric.group(1)) - 1
    month = next((index for index, name in enumerate(names) if cleaned.startswith(name)), 0)
    return year * 12 + month


def _experience(lines: list[str]) -> tuple[list[dict], int | None]:
    entries, intervals = [], []
    now = timezone.now()
    for index, line in enumerate(lines):
        match = DATE_RANGE.search(line)
        if not match:
            continue
        try:
            start, end = _month(match.group("start"), now), _month(match.group("end"), now)
        except ValueError:
            continue
        if end < start:
            continue
        prefix = line[: match.start()].strip(" |-–—,")
        parts = [part.strip() for part in re.split(r"\s+(?:at|@|\||,)\s*", prefix) if part.strip()]
        title = parts[0] if parts else (lines[index - 1] if index else "")
        company = parts[1] if len(parts) > 1 else ""
        current = match.group("end").casefold() in {"present", "current", "now"}
        entries.append({"title": title, "company": company, "date_range": match.group(0), "is_current": current})
        intervals.append((start, end + 1))
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return entries, (sum(end - start for start, end in merged) if merged else None)


def parse_structured_text(text: str) -> ParsedResume:
    sections = _sections(text)
    skill_values = []
    for line in sections["skills"]:
        skill_values.extend(re.split(r"[,;|•·]", line))
    skills = normalize_job_skills(skill_values)
    history, months = _experience(sections["experience"])
    education = [{"summary": line} for line in sections["education"]]
    projects = [{"summary": line} for line in sections["projects"]]
    certifications = [{"name": line} for line in sections["certifications"]]
    return ParsedResume(
        text=text,
        skills=skills,
        job_titles=list(dict.fromkeys(item["title"] for item in history if item["title"])),
        companies=list(dict.fromkeys(item["company"] for item in history if item["company"])),
        employment_history=history,
        education=education,
        projects=projects,
        certifications=certifications,
        estimated_experience_months=months,
    )


def parse_resume(resume_id: int) -> dict:
    resume = Resume.objects.get(pk=resume_id)
    file_hash = compute_file_hash(resume)
    with transaction.atomic():
        state, _ = ResumeParsedData.objects.select_for_update().get_or_create(
            resume=resume, defaults={"parser_version": PARSER_VERSION}
        )
        if state.status == state.Status.COMPLETED and state.file_hash == file_hash and state.parser_version == PARSER_VERSION:
            return {"resume_id": resume_id, "status": state.status, "cached": True}
        if state.status == state.Status.PROCESSING and state.file_hash == file_hash and state.parser_version == PARSER_VERSION:
            return {"resume_id": resume_id, "status": state.status, "cached": True}
        state.status = state.Status.PROCESSING
        state.file_hash = file_hash
        state.parser_version = PARSER_VERSION
        state.parsing_error = ""
        state.save()
    try:
        parsed = parse_structured_text(extract_pdf_text(resume))
        if not parsed.text:
            raise ResumeParsingError("No extractable text was found. Scanned PDFs require OCR, which is not supported.")
        current_hash = compute_file_hash(Resume.objects.get(pk=resume_id))
        if current_hash != file_hash:
            raise ResumeParsingError("The resume file changed during parsing. Please try again.")
        with transaction.atomic():
            state = ResumeParsedData.objects.select_for_update().get(resume_id=resume_id)
            for field in ("skills", "job_titles", "companies", "employment_history", "education", "projects", "certifications", "estimated_experience_months"):
                setattr(state, field, getattr(parsed, field))
            state.extracted_text = parsed.text
            state.status = state.Status.COMPLETED
            state.extracted_at = timezone.now()
            state.parsing_error = ""
            state.save()
    except Exception as exc:
        message = str(exc) if isinstance(exc, ResumeParsingError) else "The resume could not be parsed."
        ResumeParsedData.objects.filter(resume_id=resume_id).update(
            status=ResumeParsedData.Status.FAILED, parsing_error=message[:1000], extracted_at=None
        )
        if not isinstance(exc, ResumeParsingError):
            raise
    state.refresh_from_db()
    return {"resume_id": resume_id, "status": state.status, "cached": False}
