from __future__ import annotations

import json
from collections import Counter

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models


SPEAKER_COLORS = ["#6366f1", "#f97316", "#14b8a6", "#ec4899", "#84cc16", "#a855f7"]


def require(db: Session, model, object_id: str):
    value = db.get(model, object_id)
    if value is None:
        raise HTTPException(404, "找不到指定資料")
    return value


def ensure_no_code_cycle(db: Session, code: models.Code | None, parent_id: str | None) -> None:
    if not parent_id:
        return
    if code and parent_id == code.id:
        raise HTTPException(422, "代碼不可成為自己的父代碼")
    seen = {code.id} if code else set()
    cursor = db.get(models.Code, parent_id)
    if cursor is None:
        raise HTTPException(422, "找不到父代碼")
    while cursor:
        if cursor.id in seen:
            raise HTTPException(422, "代碼階層不可形成循環")
        seen.add(cursor.id)
        cursor = db.get(models.Code, cursor.parent_id) if cursor.parent_id else None


def reconcile_codings(segment: models.TranscriptSegment, previous_text: str) -> None:
    for coding in segment.codings:
        if 0 <= coding.start_offset <= coding.end_offset <= len(segment.text):
            if segment.text[coding.start_offset:coding.end_offset] == coding.quoted_text:
                coding.status = "valid"
                continue
        occurrences = []
        start = 0
        while coding.quoted_text and (found := segment.text.find(coding.quoted_text, start)) >= 0:
            occurrences.append(found)
            start = found + 1
        if len(occurrences) == 1:
            coding.start_offset = occurrences[0]
            coding.end_offset = occurrences[0] + len(coding.quoted_text)
            coding.status = "valid"
        else:
            coding.status = "needs_review"


def import_transcript(db: Session, interview: models.Interview, payload: dict, source_type: str, external_job_id: str | None = None) -> dict:
    segments = payload.get("segments")
    if not isinstance(segments, list) or len(segments) > 100_000:
        raise HTTPException(422, "逐字稿 segments 格式無效")
    source = models.TranscriptSource(
        interview_id=interview.id, source_type=source_type, external_job_id=external_job_id,
        schema_version=int(payload.get("schema_version", 1)), raw_json=json.dumps(payload, ensure_ascii=False),
    )
    db.add(source)
    db.flush()

    # Archive the previous working copy instead of deleting its revisions or codings.
    for row in interview.segments:
        if row.is_active:
            row.is_active = False
    db.flush()

    speaker_by_source: dict[str, models.Speaker] = {}
    existing = db.scalars(select(models.Speaker).where(models.Speaker.interview_id == interview.id)).all()
    for speaker in existing:
        speaker_by_source[speaker.source_speaker_id] = speaker

    for idx, row in enumerate(segments):
        try:
            start_ms = int(row.get("start_ms", row.get("timestamp", 0) or 0))
            end_ms = int(row.get("end_ms", start_ms))
        except (TypeError, ValueError) as error:
            raise HTTPException(422, f"第 {idx + 1} 段時間格式無效") from error
        if start_ms < 0 or end_ms < start_ms or not isinstance(row.get("text", ""), str):
            raise HTTPException(422, f"第 {idx + 1} 段資料無效")
        source_speaker_id = str(row.get("speaker_id") or row.get("speaker") or "SPEAKER_00")
        speaker = speaker_by_source.get(source_speaker_id)
        if speaker is None:
            speaker = models.Speaker(
                interview_id=interview.id, source_speaker_id=source_speaker_id,
                display_name=str(row.get("speaker_name") or source_speaker_id),
                role=str(row.get("speaker_role") or "unknown"), color=SPEAKER_COLORS[len(speaker_by_source) % len(SPEAKER_COLORS)],
            )
            db.add(speaker)
            db.flush()
            speaker_by_source[source_speaker_id] = speaker
        db.add(models.TranscriptSegment(
            interview_id=interview.id, transcript_source_id=source.id,
            source_segment_id=str(row.get("id") or f"seg_{idx + 1:06d}"), position=idx,
            start_ms=start_ms, end_ms=end_ms, speaker_id=speaker.id,
            text=row.get("text", ""), note=str(row.get("note", "")),
        ))
    interview.transcript_status = "ready"
    db.flush()
    return {"source_id": source.id, "segments_imported": len(segments), "speakers": len(speaker_by_source)}
