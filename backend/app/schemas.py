from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class ProjectOut(ORMModel):
    id: str
    name: str
    description: str
    created_at: datetime
    updated_at: datetime


class InterviewIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    interview_date: date | None = None
    interviewers: str = ""
    interviewees: str = ""


class InterviewOut(ORMModel):
    id: str
    project_id: str
    title: str
    interview_date: date | None
    interviewers: str
    interviewees: str
    audio_file_id: str | None
    transcript_status: str
    created_at: datetime
    updated_at: datetime


class SpeakerOut(ORMModel):
    id: str
    source_speaker_id: str
    display_name: str
    role: str
    color: str


class SegmentIn(BaseModel):
    source_segment_id: str | None = None
    position: int = Field(ge=0)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    speaker_id: str | None = None
    text: str = ""
    note: str = ""

    @model_validator(mode="after")
    def valid_timeline(self):
        if self.end_ms < self.start_ms:
            raise ValueError("end_ms must be greater than or equal to start_ms")
        return self


class SegmentPatch(BaseModel):
    version: int = Field(ge=1)
    text: str
    speaker_id: str | None = None
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    note: str = ""
    reason: str = ""

    @model_validator(mode="after")
    def valid_timeline(self):
        if self.end_ms < self.start_ms:
            raise ValueError("end_ms must be greater than or equal to start_ms")
        return self


class SegmentOut(ORMModel):
    id: str
    interview_id: str
    source_segment_id: str | None
    position: int
    start_ms: int
    end_ms: int
    speaker_id: str | None
    text: str
    note: str
    version: int
    is_active: bool
    speaker: SpeakerOut | None = None


class CodebookIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class CodebookOut(ORMModel):
    id: str
    project_id: str
    name: str
    description: str


class CodeIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    definition: str = ""
    color: str = "#8b5cf6"
    parent_id: str | None = None
    sort_order: int = 0


class CodeOut(ORMModel):
    id: str
    codebook_id: str
    parent_id: str | None
    name: str
    definition: str
    color: str
    sort_order: int


class CodingIn(BaseModel):
    code_id: str
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=0)
    quoted_text: str
    memo: str = ""


class CodingOut(ORMModel):
    id: str
    segment_id: str
    code_id: str
    start_offset: int
    end_offset: int
    quoted_text: str
    memo: str
    status: str
    code: CodeOut


class MemoIn(BaseModel):
    project_id: str | None = None
    interview_id: str | None = None
    segment_id: str | None = None
    coding_id: str | None = None
    title: str = Field(default="", max_length=300)
    content: str = ""


class MemoOut(ORMModel):
    id: str
    project_id: str | None
    interview_id: str | None
    segment_id: str | None
    coding_id: str | None
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class AsrOptions(BaseModel):
    engine: Literal["breeze", "qwen", "whisper"] = "breeze"
    mode: Literal["quality", "fast"] = "quality"
    diarization: bool = True
    speaker_mode: Literal["auto", "fixed", "range"] = "fixed"
    num_speakers: int = Field(default=2, ge=1)
    min_speakers: int = Field(default=2, ge=1)
    max_speakers: int = Field(default=2, ge=1)
    terms: str = ""
    traditional: bool = True
    make_readable: bool = False
    offline: bool = False
