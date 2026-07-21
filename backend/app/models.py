from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    interviews: Mapped[list["Interview"]] = relationship(cascade="all, delete-orphan", back_populates="project")
    codebooks: Mapped[list["Codebook"]] = relationship(cascade="all, delete-orphan", back_populates="project")


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    interview_date: Mapped[date | None] = mapped_column(Date)
    interviewers: Mapped[str] = mapped_column(Text, default="")
    interviewees: Mapped[str] = mapped_column(Text, default="")
    audio_file_id: Mapped[str | None] = mapped_column(ForeignKey("audio_files.id", ondelete="SET NULL"))
    transcript_status: Mapped[str] = mapped_column(String(30), default="empty")
    project: Mapped[Project] = relationship(back_populates="interviews")
    audio_file: Mapped["AudioFile | None"] = relationship()
    segments: Mapped[list["TranscriptSegment"]] = relationship(cascade="all, delete-orphan", back_populates="interview")


class AudioFile(Base, TimestampMixin):
    __tablename__ = "audio_files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    extension: Mapped[str] = mapped_column(String(20), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer)


class Speaker(Base, TimestampMixin):
    __tablename__ = "speakers"
    __table_args__ = (UniqueConstraint("interview_id", "source_speaker_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    source_speaker_id: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="unknown")
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")


class TranscriptSource(Base):
    __tablename__ = "transcript_sources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    external_job_id: Mapped[str | None] = mapped_column(String(100), index=True)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    raw_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TranscriptSegment(Base, TimestampMixin):
    __tablename__ = "transcript_segments"
    __table_args__ = (
        CheckConstraint("start_ms >= 0"), CheckConstraint("end_ms >= start_ms"),
        UniqueConstraint("interview_id", "transcript_source_id", "position"), Index("ix_segments_interview_position", "interview_id", "position"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    transcript_source_id: Mapped[str | None] = mapped_column(ForeignKey("transcript_sources.id", ondelete="SET NULL"))
    source_segment_id: Mapped[str | None] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    end_ms: Mapped[int] = mapped_column(Integer, default=0)
    speaker_id: Mapped[str | None] = mapped_column(ForeignKey("speakers.id", ondelete="SET NULL"), index=True)
    text: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    interview: Mapped[Interview] = relationship(back_populates="segments")
    speaker: Mapped[Speaker | None] = relationship()
    codings: Mapped[list["Coding"]] = relationship(cascade="all, delete-orphan", back_populates="segment")


class TranscriptRevision(Base):
    __tablename__ = "transcript_revisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    segment_id: Mapped[str] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True)
    previous_text: Mapped[str] = mapped_column(Text, default="")
    new_text: Mapped[str] = mapped_column(Text, default="")
    previous_speaker_id: Mapped[str | None] = mapped_column(String(36))
    new_speaker_id: Mapped[str | None] = mapped_column(String(36))
    previous_start_ms: Mapped[int] = mapped_column(Integer)
    new_start_ms: Mapped[int] = mapped_column(Integer)
    previous_end_ms: Mapped[int] = mapped_column(Integer)
    new_end_ms: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Codebook(Base, TimestampMixin):
    __tablename__ = "codebooks"
    __table_args__ = (UniqueConstraint("project_id", "name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    project: Mapped[Project] = relationship(back_populates="codebooks")
    codes: Mapped[list["Code"]] = relationship(cascade="all, delete-orphan", back_populates="codebook")


class Code(Base, TimestampMixin):
    __tablename__ = "codes"
    __table_args__ = (UniqueConstraint("codebook_id", "name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    codebook_id: Mapped[str] = mapped_column(ForeignKey("codebooks.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("codes.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    definition: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="#8b5cf6")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    codebook: Mapped[Codebook] = relationship(back_populates="codes")


class Coding(Base, TimestampMixin):
    __tablename__ = "codings"
    __table_args__ = (CheckConstraint("start_offset >= 0"), CheckConstraint("end_offset >= start_offset"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    segment_id: Mapped[str] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True)
    code_id: Mapped[str] = mapped_column(ForeignKey("codes.id", ondelete="CASCADE"), index=True)
    start_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    end_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    quoted_text: Mapped[str] = mapped_column(Text, nullable=False)
    memo: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="valid")
    segment: Mapped[TranscriptSegment] = relationship(back_populates="codings")
    code: Mapped[Code] = relationship()


class Memo(Base, TimestampMixin):
    __tablename__ = "memos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    interview_id: Mapped[str | None] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    segment_id: Mapped[str | None] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True)
    coding_id: Mapped[str | None] = mapped_column(ForeignKey("codings.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300), default="")
    content: Mapped[str] = mapped_column(Text, default="")


class AsrJob(Base, TimestampMixin):
    __tablename__ = "asr_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    remote_job_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(30), default="queued")
    stage: Mapped[str] = mapped_column(String(50), default="queued")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    message: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    parameters_json: Mapped[str] = mapped_column(Text, default="{}")
