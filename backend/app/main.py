from __future__ import annotations

import csv
import hashlib
import io
import json
import mimetypes
import re
import shutil
import sqlite3
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from . import asr_client, models, schemas, services
from .config import settings
from .database import engine, get_db

API = "/api/v1"
app = FastAPI(title="QualiStream Local API", version="2.0.0")


@app.exception_handler(asr_client.AsrServiceError)
def asr_error(_request, error: asr_client.AsrServiceError):
    return JSONResponse(status_code=502, content={"detail": str(error)})


@app.exception_handler(IntegrityError)
def integrity_error(_request, _error: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "資料重複或仍被其他資料使用"})


def remove_audio_file(row: models.AudioFile | None, db: Session) -> None:
    if row is None: return
    path = settings.data_dir / "audio" / row.stored_name
    if path.is_file(): path.unlink()
    db.delete(row)


@app.get(f"{API}/system/health")
def system_health():
    return {"service": "qualistream", "version": "2.0.0", "status": "ok", "database": engine.dialect.name}


@app.get(f"{API}/projects", response_model=list[schemas.ProjectOut])
def projects(db: Session = Depends(get_db)):
    return db.scalars(select(models.Project).order_by(models.Project.updated_at.desc())).all()


@app.post(f"{API}/projects", response_model=schemas.ProjectOut, status_code=201)
def create_project(payload: schemas.ProjectIn, db: Session = Depends(get_db)):
    row = models.Project(**payload.model_dump())
    db.add(row); db.commit(); return row


@app.get(f"{API}/projects/{{project_id}}", response_model=schemas.ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    return services.require(db, models.Project, project_id)


@app.patch(f"{API}/projects/{{project_id}}", response_model=schemas.ProjectOut)
def update_project(project_id: str, payload: schemas.ProjectIn, db: Session = Depends(get_db)):
    row = services.require(db, models.Project, project_id)
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    db.commit(); return row


@app.delete(f"{API}/projects/{{project_id}}")
def delete_project(project_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = db.scalar(select(models.Project).where(models.Project.id == project_id)
        .options(selectinload(models.Project.interviews).selectinload(models.Interview.audio_file)))
    if row is None: raise HTTPException(404, "找不到指定資料")
    audio_rows = [interview.audio_file for interview in row.interviews if interview.audio_file]
    for interview in row.interviews: interview.audio_file_id = None
    db.flush()
    for audio in audio_rows: remove_audio_file(audio, db)
    db.delete(row); db.commit()
    return {"deleted": True}


@app.get(f"{API}/projects/{{project_id}}/interviews", response_model=list[schemas.InterviewOut])
def interviews(project_id: str, db: Session = Depends(get_db)):
    services.require(db, models.Project, project_id)
    return db.scalars(select(models.Interview).where(models.Interview.project_id == project_id).order_by(models.Interview.created_at.desc())).all()


@app.post(f"{API}/projects/{{project_id}}/interviews", response_model=schemas.InterviewOut, status_code=201)
def create_interview(project_id: str, payload: schemas.InterviewIn, db: Session = Depends(get_db)):
    services.require(db, models.Project, project_id)
    row = models.Interview(project_id=project_id, **payload.model_dump()); db.add(row); db.commit(); return row


@app.get(f"{API}/interviews/{{interview_id}}", response_model=schemas.InterviewOut)
def get_interview(interview_id: str, db: Session = Depends(get_db)):
    return services.require(db, models.Interview, interview_id)


@app.patch(f"{API}/interviews/{{interview_id}}", response_model=schemas.InterviewOut)
def update_interview(interview_id: str, payload: schemas.InterviewIn, db: Session = Depends(get_db)):
    row = services.require(db, models.Interview, interview_id)
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    db.commit(); return row


@app.delete(f"{API}/interviews/{{interview_id}}")
def delete_interview(interview_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = services.require(db, models.Interview, interview_id)
    audio = row.audio_file; row.audio_file_id = None; db.flush(); remove_audio_file(audio, db)
    db.delete(row); db.commit(); return {"deleted": True}


ALLOWED_AUDIO = {".wav", ".mp3", ".m4a", ".mp4", ".mov", ".aac", ".flac", ".ogg"}


@app.post(f"{API}/interviews/{{interview_id}}/audio", status_code=201)
async def upload_audio(interview_id: str, file: UploadFile = File(), db: Session = Depends(get_db)):
    interview = services.require(db, models.Interview, interview_id)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO: raise HTTPException(422, "不支援的音訊或影片格式")
    stored_name = f"{uuid.uuid4()}{suffix}"
    destination = settings.data_dir / "audio" / stored_name
    digest = hashlib.sha256(); size = 0; limit = settings.max_upload_mb * 1024 * 1024
    try:
        with destination.open("xb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > limit: raise HTTPException(413, "檔案超過上傳限制")
                digest.update(chunk); output.write(chunk)
        previous = interview.audio_file
        row = models.AudioFile(original_name=Path(file.filename or "audio").name, stored_name=stored_name,
            mime_type=file.content_type or mimetypes.guess_type(stored_name)[0] or "application/octet-stream",
            extension=suffix, size=size, sha256=digest.hexdigest())
        db.add(row); db.flush(); interview.audio_file_id = row.id; db.flush()
        remove_audio_file(previous, db)
        db.commit()
        return {"id": row.id, "original_name": row.original_name, "size": row.size, "mime_type": row.mime_type}
    except Exception:
        if destination.exists(): destination.unlink()
        raise
    finally:
        await file.close()


@app.get(f"{API}/audio/{{audio_id}}/metadata")
def audio_metadata(audio_id: str, db: Session = Depends(get_db)):
    row = services.require(db, models.AudioFile, audio_id)
    return {"id": row.id, "original_name": row.original_name, "mime_type": row.mime_type, "size": row.size, "duration_ms": row.duration_ms}


@app.delete(f"{API}/audio/{{audio_id}}")
def delete_audio(audio_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = services.require(db, models.AudioFile, audio_id)
    interviews = db.scalars(select(models.Interview).where(models.Interview.audio_file_id == audio_id)).all()
    for interview in interviews: interview.audio_file_id = None
    db.flush(); remove_audio_file(row, db); db.commit(); return {"deleted": True}


@app.get(f"{API}/audio/{{audio_id}}/stream")
def audio_stream(audio_id: str, request: Request, db: Session = Depends(get_db)):
    row = services.require(db, models.AudioFile, audio_id)
    path = (settings.data_dir / "audio" / row.stored_name).resolve()
    if path.parent != (settings.data_dir / "audio").resolve() or not path.is_file(): raise HTTPException(404, "找不到音檔")
    range_header = request.headers.get("range")
    if not range_header: return FileResponse(path, media_type=row.mime_type, filename=row.original_name)
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
    if not match: raise HTTPException(416, "Range 格式無效")
    start = int(match.group(1) or 0); end = int(match.group(2) or row.size - 1)
    if start >= row.size or end < start: raise HTTPException(416, "Range 超出檔案")
    end = min(end, row.size - 1)
    def body():
        with path.open("rb") as stream:
            stream.seek(start); remaining = end - start + 1
            while remaining:
                chunk = stream.read(min(1024 * 1024, remaining))
                if not chunk: break
                remaining -= len(chunk); yield chunk
    return StreamingResponse(body(), status_code=206, media_type=row.mime_type, headers={
        "Content-Range": f"bytes {start}-{end}/{row.size}", "Accept-Ranges": "bytes", "Content-Length": str(end - start + 1)})


@app.get(f"{API}/interviews/{{interview_id}}/speakers", response_model=list[schemas.SpeakerOut])
def speakers(interview_id: str, db: Session = Depends(get_db)):
    return db.scalars(select(models.Speaker).where(models.Speaker.interview_id == interview_id)).all()


@app.patch(f"{API}/speakers/{{speaker_id}}", response_model=schemas.SpeakerOut)
def update_speaker(speaker_id: str, payload: dict = Body(), db: Session = Depends(get_db)):
    row = services.require(db, models.Speaker, speaker_id)
    if "display_name" in payload: row.display_name = str(payload["display_name"]).strip() or row.display_name
    if payload.get("role") in {"unknown", "interviewer", "interviewee"}: row.role = payload["role"]
    if re.fullmatch(r"#[0-9a-fA-F]{6}", str(payload.get("color", ""))): row.color = payload["color"]
    db.commit(); return row


@app.get(f"{API}/interviews/{{interview_id}}/segments", response_model=list[schemas.SegmentOut])
def segments(interview_id: str, db: Session = Depends(get_db)):
    return db.scalars(select(models.TranscriptSegment).where(models.TranscriptSegment.interview_id == interview_id, models.TranscriptSegment.is_active.is_(True))
        .options(selectinload(models.TranscriptSegment.speaker)).order_by(models.TranscriptSegment.position)).all()


@app.post(f"{API}/interviews/{{interview_id}}/segments", response_model=schemas.SegmentOut, status_code=201)
def create_segment(interview_id: str, payload: schemas.SegmentIn, db: Session = Depends(get_db)):
    interview = services.require(db, models.Interview, interview_id)
    row = models.TranscriptSegment(interview_id=interview_id, **payload.model_dump()); db.add(row)
    interview.transcript_status = "ready"; db.commit(); db.refresh(row); return row


@app.patch(f"{API}/segments/{{segment_id}}", response_model=schemas.SegmentOut)
def update_segment(segment_id: str, payload: schemas.SegmentPatch, db: Session = Depends(get_db)):
    row = db.scalar(select(models.TranscriptSegment).where(models.TranscriptSegment.id == segment_id)
        .options(selectinload(models.TranscriptSegment.codings), selectinload(models.TranscriptSegment.speaker)))
    if row is None: raise HTTPException(404, "找不到逐字稿片段")
    if row.version != payload.version: raise HTTPException(409, "逐字稿已在其他地方更新，請重新載入")
    previous = {"text": row.text, "speaker_id": row.speaker_id, "start_ms": row.start_ms, "end_ms": row.end_ms}
    changed = any([row.text != payload.text, row.speaker_id != payload.speaker_id, row.start_ms != payload.start_ms, row.end_ms != payload.end_ms])
    if changed:
        db.add(models.TranscriptRevision(segment_id=row.id, previous_text=row.text, new_text=payload.text,
            previous_speaker_id=row.speaker_id, new_speaker_id=payload.speaker_id,
            previous_start_ms=row.start_ms, new_start_ms=payload.start_ms,
            previous_end_ms=row.end_ms, new_end_ms=payload.end_ms, reason=payload.reason))
    row.text, row.speaker_id, row.start_ms, row.end_ms, row.note = payload.text, payload.speaker_id, payload.start_ms, payload.end_ms, payload.note
    row.version += 1
    if previous["text"] != row.text: services.reconcile_codings(row, previous["text"])
    db.commit(); db.refresh(row); return row


@app.get(f"{API}/segments/{{segment_id}}/revisions")
def revisions(segment_id: str, db: Session = Depends(get_db)):
    services.require(db, models.TranscriptSegment, segment_id)
    rows = db.scalars(select(models.TranscriptRevision).where(models.TranscriptRevision.segment_id == segment_id).order_by(models.TranscriptRevision.created_at.desc())).all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


@app.post(f"{API}/segments/{{segment_id}}/split", response_model=list[schemas.SegmentOut])
def split_segment(segment_id: str, split_offset: int = Body(embed=True), db: Session = Depends(get_db)):
    row = db.scalar(select(models.TranscriptSegment).where(models.TranscriptSegment.id == segment_id, models.TranscriptSegment.is_active.is_(True))
        .options(selectinload(models.TranscriptSegment.codings), selectinload(models.TranscriptSegment.speaker)))
    if row is None: raise HTTPException(404, "找不到逐字稿片段")
    if split_offset <= 0 or split_offset >= len(row.text): raise HTTPException(422, "拆分位置必須位於文字中間")
    following = db.scalars(select(models.TranscriptSegment).where(
        models.TranscriptSegment.interview_id == row.interview_id, models.TranscriptSegment.transcript_source_id == row.transcript_source_id,
        models.TranscriptSegment.is_active.is_(True), models.TranscriptSegment.position > row.position,
    ).order_by(models.TranscriptSegment.position.desc())).all()
    for segment in following: segment.position += 1
    ratio = split_offset / max(len(row.text), 1)
    split_ms = row.start_ms + round((row.end_ms - row.start_ms) * ratio)
    previous_text, previous_end = row.text, row.end_ms
    second = models.TranscriptSegment(interview_id=row.interview_id, transcript_source_id=row.transcript_source_id,
        source_segment_id=f"{row.source_segment_id or row.id}-split", position=row.position + 1,
        start_ms=split_ms, end_ms=row.end_ms, speaker_id=row.speaker_id, text=row.text[split_offset:], note="")
    db.add(second); db.flush()
    for coding in list(row.codings):
        if coding.start_offset >= split_offset:
            db.add(models.Coding(segment_id=second.id, code_id=coding.code_id,
                start_offset=coding.start_offset - split_offset, end_offset=coding.end_offset - split_offset,
                quoted_text=coding.quoted_text, memo=coding.memo, status=coding.status))
            db.delete(coding)
        elif coding.end_offset > split_offset:
            coding.status = "needs_review"
    row.text = row.text[:split_offset]; row.end_ms = split_ms; row.version += 1
    db.add(models.TranscriptRevision(segment_id=row.id, previous_text=previous_text, new_text=row.text,
        previous_speaker_id=row.speaker_id, new_speaker_id=row.speaker_id,
        previous_start_ms=row.start_ms, new_start_ms=row.start_ms, previous_end_ms=previous_end, new_end_ms=split_ms, reason="拆分片段"))
    db.commit(); db.refresh(row); db.refresh(second); return [row, second]


@app.post(f"{API}/segments/{{segment_id}}/merge", response_model=schemas.SegmentOut)
def merge_segment(segment_id: str, next_segment_id: str | None = Body(default=None, embed=True), db: Session = Depends(get_db)):
    row = db.scalar(select(models.TranscriptSegment).where(models.TranscriptSegment.id == segment_id, models.TranscriptSegment.is_active.is_(True))
        .options(selectinload(models.TranscriptSegment.codings), selectinload(models.TranscriptSegment.speaker)))
    if row is None: raise HTTPException(404, "找不到逐字稿片段")
    query = select(models.TranscriptSegment).where(models.TranscriptSegment.interview_id == row.interview_id, models.TranscriptSegment.is_active.is_(True))
    query = query.where(models.TranscriptSegment.id == next_segment_id) if next_segment_id else query.where(models.TranscriptSegment.position == row.position + 1)
    second = db.scalar(query.options(selectinload(models.TranscriptSegment.codings)))
    if second is None or second.position <= row.position: raise HTTPException(422, "找不到下一個可合併片段")
    previous_text, previous_end = row.text, row.end_ms
    separator = "\n" if row.text and second.text else ""
    offset = len(row.text) + len(separator)
    row.text += separator + second.text; row.end_ms = max(row.end_ms, second.end_ms); row.version += 1
    for coding in second.codings:
        db.add(models.Coding(segment_id=row.id, code_id=coding.code_id, start_offset=coding.start_offset + offset,
            end_offset=coding.end_offset + offset, quoted_text=coding.quoted_text, memo=coding.memo, status=coding.status))
    second.is_active = False; second.position = -second.position - 1
    db.add(models.TranscriptRevision(segment_id=row.id, previous_text=previous_text, new_text=row.text,
        previous_speaker_id=row.speaker_id, new_speaker_id=row.speaker_id,
        previous_start_ms=row.start_ms, new_start_ms=row.start_ms, previous_end_ms=previous_end, new_end_ms=row.end_ms, reason="合併片段"))
    db.commit(); db.refresh(row); return row


@app.post(f"{API}/interviews/{{interview_id}}/transcript/import-json")
def import_json(interview_id: str, payload: dict = Body(), replace_confirmed: bool = Query(False), db: Session = Depends(get_db)):
    interview = db.scalar(select(models.Interview).where(models.Interview.id == interview_id).options(selectinload(models.Interview.segments)))
    if interview is None: raise HTTPException(404, "找不到訪談")
    if any(s.is_active for s in interview.segments) and not replace_confirmed: raise HTTPException(409, "訪談已有逐字稿，匯入需要 replace_confirmed=true")
    result = services.import_transcript(db, interview, payload, "json_import")
    db.commit(); return result


@app.get(f"{API}/projects/{{project_id}}/codebooks", response_model=list[schemas.CodebookOut])
def codebooks(project_id: str, db: Session = Depends(get_db)):
    return db.scalars(select(models.Codebook).where(models.Codebook.project_id == project_id)).all()


@app.post(f"{API}/projects/{{project_id}}/codebooks", response_model=schemas.CodebookOut, status_code=201)
def create_codebook(project_id: str, payload: schemas.CodebookIn, db: Session = Depends(get_db)):
    services.require(db, models.Project, project_id)
    row = models.Codebook(project_id=project_id, **payload.model_dump()); db.add(row); db.commit(); return row


@app.patch(f"{API}/codebooks/{{codebook_id}}", response_model=schemas.CodebookOut)
def update_codebook(codebook_id: str, payload: schemas.CodebookIn, db: Session = Depends(get_db)):
    row = services.require(db, models.Codebook, codebook_id)
    row.name, row.description = payload.name, payload.description; db.commit(); return row


@app.delete(f"{API}/codebooks/{{codebook_id}}")
def delete_codebook(codebook_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = services.require(db, models.Codebook, codebook_id); db.delete(row); db.commit(); return {"deleted": True}


@app.get(f"{API}/codebooks/{{codebook_id}}/codes", response_model=list[schemas.CodeOut])
def codes(codebook_id: str, db: Session = Depends(get_db)):
    return db.scalars(select(models.Code).where(models.Code.codebook_id == codebook_id).order_by(models.Code.sort_order, models.Code.name)).all()


@app.post(f"{API}/codebooks/{{codebook_id}}/codes", response_model=schemas.CodeOut, status_code=201)
def create_code(codebook_id: str, payload: schemas.CodeIn, db: Session = Depends(get_db)):
    services.require(db, models.Codebook, codebook_id); services.ensure_no_code_cycle(db, None, payload.parent_id)
    row = models.Code(codebook_id=codebook_id, **payload.model_dump()); db.add(row); db.commit(); return row


@app.patch(f"{API}/codes/{{code_id}}", response_model=schemas.CodeOut)
def update_code(code_id: str, payload: schemas.CodeIn, db: Session = Depends(get_db)):
    row = services.require(db, models.Code, code_id); services.ensure_no_code_cycle(db, row, payload.parent_id)
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    db.commit(); return row


@app.delete(f"{API}/codes/{{code_id}}")
def delete_code(code_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = services.require(db, models.Code, code_id); db.delete(row); db.commit(); return {"deleted": True}


@app.get(f"{API}/segments/{{segment_id}}/codings", response_model=list[schemas.CodingOut])
def codings(segment_id: str, db: Session = Depends(get_db)):
    return db.scalars(select(models.Coding).where(models.Coding.segment_id == segment_id).options(selectinload(models.Coding.code))).all()


@app.post(f"{API}/segments/{{segment_id}}/codings", response_model=schemas.CodingOut, status_code=201)
def create_coding(segment_id: str, payload: schemas.CodingIn, db: Session = Depends(get_db)):
    segment = services.require(db, models.TranscriptSegment, segment_id); services.require(db, models.Code, payload.code_id)
    if payload.end_offset > len(segment.text) or segment.text[payload.start_offset:payload.end_offset] != payload.quoted_text:
        raise HTTPException(422, "選取範圍與逐字稿文字不一致")
    row = models.Coding(segment_id=segment_id, **payload.model_dump()); db.add(row); db.commit(); db.refresh(row); return row


@app.patch(f"{API}/codings/{{coding_id}}", response_model=schemas.CodingOut)
def update_coding(coding_id: str, payload: schemas.CodingIn, db: Session = Depends(get_db)):
    row = services.require(db, models.Coding, coding_id); segment = services.require(db, models.TranscriptSegment, row.segment_id)
    if payload.end_offset > len(segment.text) or segment.text[payload.start_offset:payload.end_offset] != payload.quoted_text:
        raise HTTPException(422, "選取範圍與逐字稿文字不一致")
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    row.status = "valid"; db.commit(); db.refresh(row); return row


@app.delete(f"{API}/codings/{{coding_id}}")
def delete_coding(coding_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = services.require(db, models.Coding, coding_id); db.delete(row); db.commit(); return {"deleted": True}


@app.post(f"{API}/codings/{{coding_id}}/review", response_model=schemas.CodingOut)
def review_coding(coding_id: str, payload: schemas.CodingIn, db: Session = Depends(get_db)):
    return update_coding(coding_id, payload, db)


@app.get(f"{API}/memos", response_model=list[schemas.MemoOut])
def memos(project_id: str | None = None, interview_id: str | None = None, segment_id: str | None = None,
          coding_id: str | None = None, db: Session = Depends(get_db)):
    query = select(models.Memo).order_by(models.Memo.updated_at.desc())
    for field, value in (("project_id", project_id), ("interview_id", interview_id), ("segment_id", segment_id), ("coding_id", coding_id)):
        if value: query = query.where(getattr(models.Memo, field) == value)
    return db.scalars(query).all()


@app.post(f"{API}/memos", response_model=schemas.MemoOut, status_code=201)
def create_memo(payload: schemas.MemoIn, db: Session = Depends(get_db)):
    if not any((payload.project_id, payload.interview_id, payload.segment_id, payload.coding_id)):
        raise HTTPException(422, "Memo 必須連結至少一個研究資料")
    row = models.Memo(**payload.model_dump()); db.add(row); db.commit(); return row


@app.patch(f"{API}/memos/{{memo_id}}", response_model=schemas.MemoOut)
def update_memo(memo_id: str, payload: schemas.MemoIn, db: Session = Depends(get_db)):
    row = services.require(db, models.Memo, memo_id)
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    db.commit(); return row


@app.delete(f"{API}/memos/{{memo_id}}")
def delete_memo(memo_id: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm: raise HTTPException(400, "刪除需要 confirm=true")
    row = services.require(db, models.Memo, memo_id); db.delete(row); db.commit(); return {"deleted": True}


@app.get(f"{API}/asr/health")
def asr_health(): return asr_client.health()


@app.post(f"{API}/interviews/{{interview_id}}/asr/jobs", status_code=202)
def start_asr(interview_id: str, options: schemas.AsrOptions, db: Session = Depends(get_db)):
    interview = db.scalar(select(models.Interview).where(models.Interview.id == interview_id).options(selectinload(models.Interview.audio_file)))
    if not interview or not interview.audio_file: raise HTTPException(422, "請先上傳訪談音檔")
    path = settings.data_dir / "audio" / interview.audio_file.stored_name
    result = asr_client.create_job(path, interview.audio_file.original_name, interview.audio_file.mime_type, options.model_dump())
    row = models.AsrJob(interview_id=interview_id, remote_job_id=result["job_id"], status=result["status"], stage=result.get("stage", "queued"), parameters_json=options.model_dump_json())
    db.add(row); db.commit(); return {"id": row.id, **result}


@app.get(f"{API}/interviews/{{interview_id}}/asr/jobs")
def asr_jobs(interview_id: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(models.AsrJob).where(models.AsrJob.interview_id == interview_id).order_by(models.AsrJob.created_at.desc())).all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


def sync_asr(row: models.AsrJob, db: Session) -> dict:
    remote = asr_client.get_job(row.remote_job_id)
    for key in ("status", "stage", "progress", "message", "error"):
        if key in remote and remote[key] is not None: setattr(row, key, remote[key])
    db.commit(); return {"id": row.id, **remote}


@app.get(f"{API}/asr/jobs/{{job_id}}")
def get_asr_job(job_id: str, db: Session = Depends(get_db)):
    return sync_asr(services.require(db, models.AsrJob, job_id), db)


@app.post(f"{API}/asr/jobs/{{job_id}}/cancel")
def cancel_asr_job(job_id: str, db: Session = Depends(get_db)):
    row = services.require(db, models.AsrJob, job_id); remote = asr_client.cancel_job(row.remote_job_id)
    row.status = remote["status"]; row.stage = remote.get("stage", row.stage); db.commit(); return {"id": row.id, **remote}


@app.get(f"{API}/asr/jobs/{{job_id}}/preview")
def preview_asr(job_id: str, db: Session = Depends(get_db)):
    row = services.require(db, models.AsrJob, job_id); sync_asr(row, db)
    if row.status != "completed": raise HTTPException(409, "ASR 尚未完成")
    return asr_client.get_transcript(row.remote_job_id)


@app.post(f"{API}/asr/jobs/{{job_id}}/import")
def import_asr(job_id: str, replace_confirmed: bool = Query(False), db: Session = Depends(get_db)):
    row = services.require(db, models.AsrJob, job_id); interview = db.scalar(select(models.Interview).where(models.Interview.id == row.interview_id).options(selectinload(models.Interview.segments)))
    sync_asr(row, db)
    if row.status != "completed": raise HTTPException(409, "ASR 尚未完成")
    if any(s.is_active for s in interview.segments) and not replace_confirmed: raise HTTPException(409, "訪談已有逐字稿，匯入需要 replace_confirmed=true")
    result = services.import_transcript(db, interview, asr_client.get_transcript(row.remote_job_id), "interview_asr", row.remote_job_id)
    db.commit(); return result


@app.get(f"{API}/interviews/{{interview_id}}/export")
def export_interview(interview_id: str, format: str = Query("json"), db: Session = Depends(get_db)):
    interview = services.require(db, models.Interview, interview_id)
    rows = db.scalars(select(models.TranscriptSegment).where(models.TranscriptSegment.interview_id == interview_id, models.TranscriptSegment.is_active.is_(True)).options(selectinload(models.TranscriptSegment.speaker)).order_by(models.TranscriptSegment.position)).all()
    payload = {"schema_version": 1, "interview": {"id": interview.id, "title": interview.title}, "segments": [
        {"id": r.id, "start_ms": r.start_ms, "end_ms": r.end_ms, "speaker_name": r.speaker.display_name if r.speaker else "", "text": r.text, "note": r.note} for r in rows]}
    if format == "json": return payload
    def stamp(ms):
        seconds, milli = divmod(ms, 1000); minute, second = divmod(seconds, 60); hour, minute = divmod(minute, 60)
        return f"{hour:02}:{minute:02}:{second:02}.{milli:03}"
    if format == "md":
        return PlainTextResponse("\n\n".join(f"**{r.speaker.display_name if r.speaker else '未知語者'}** `{stamp(r.start_ms)}`\n\n{r.text}" for r in rows), media_type="text/markdown; charset=utf-8")
    if format == "txt":
        return PlainTextResponse("\n".join(f"[{stamp(r.start_ms)}] {r.speaker.display_name if r.speaker else '未知語者'}：{r.text}" for r in rows))
    if format == "srt":
        def srt_stamp(ms): return stamp(ms).replace(".", ",")
        return PlainTextResponse("\n\n".join(f"{index}\n{srt_stamp(r.start_ms)} --> {srt_stamp(r.end_ms)}\n{r.speaker.display_name if r.speaker else '未知語者'}：{r.text}" for index, r in enumerate(rows, 1)))
    if format == "vtt":
        return PlainTextResponse("WEBVTT\n\n" + "\n\n".join(f"{stamp(r.start_ms)} --> {stamp(r.end_ms)}\n{r.speaker.display_name if r.speaker else '未知語者'}：{r.text}" for r in rows))
    raise HTTPException(422, "format 僅支援 json、md、txt、srt、vtt")


@app.get(f"{API}/projects/{{project_id}}/coding-report")
def coding_report(project_id: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Coding).join(models.TranscriptSegment).join(models.Interview)
        .where(models.Interview.project_id == project_id).options(selectinload(models.Coding.code), selectinload(models.Coding.segment).selectinload(models.TranscriptSegment.speaker))).all()
    output = io.StringIO(); output.write("\ufeff"); writer = csv.writer(output)
    writer.writerow(["interview", "code", "speaker", "start_ms", "end_ms", "quoted_text", "memo", "status"])
    for row in rows:
        writer.writerow([row.segment.interview_id, row.code.name, row.segment.speaker.display_name if row.segment.speaker else "", row.segment.start_ms, row.segment.end_ms, row.quoted_text, row.memo, row.status])
    return Response(output.getvalue().encode("utf-8-sig"), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=coding-report.csv"})


@app.get(f"{API}/projects/{{project_id}}/export")
def export_project(project_id: str, db: Session = Depends(get_db)):
    project = services.require(db, models.Project, project_id)
    interviews = db.scalars(select(models.Interview).where(models.Interview.project_id == project_id)).all()
    payload = {"schema_version": 1, "project": {"id": project.id, "name": project.name, "description": project.description}, "interviews": []}
    for interview in interviews:
        rows = db.scalars(select(models.TranscriptSegment).where(models.TranscriptSegment.interview_id == interview.id, models.TranscriptSegment.is_active.is_(True)).order_by(models.TranscriptSegment.position)).all()
        payload["interviews"].append({"id": interview.id, "title": interview.title, "interview_date": str(interview.interview_date or ""),
            "segments": [{"id": r.id, "start_ms": r.start_ms, "end_ms": r.end_ms, "speaker_id": r.speaker_id, "text": r.text, "note": r.note} for r in rows]})
    return payload


@app.post(f"{API}/system/backup")
def backup(include_audio: bool = Query(False)):
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = settings.data_dir / "backups" / f"qualistream-{timestamp}.zip"
    if engine.dialect.name != "sqlite" or not engine.url.database:
        raise HTTPException(501, "目前只支援 SQLite backup")
    db_path = Path(engine.url.database)
    if not db_path.is_file(): raise HTTPException(500, "找不到 SQLite database")
    snapshot = settings.data_dir / "backups" / f"qualistream-{timestamp}.db"
    source = sqlite3.connect(db_path); destination = sqlite3.connect(snapshot)
    try: source.backup(destination)
    finally: destination.close(); source.close()
    manifest = {"created_at": datetime.now(timezone.utc).isoformat(), "database": snapshot.name, "includes_audio": include_audio}
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(snapshot, snapshot.name); archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        if include_audio:
            for file in (settings.data_dir / "audio").glob("*"): archive.write(file, f"audio/{file.name}")
    snapshot.unlink()
    return {"backup": target.name, **manifest}


dist = Path(__file__).resolve().parents[2] / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
