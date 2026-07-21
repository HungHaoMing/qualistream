from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def default_data_dir() -> Path:
    root = os.getenv("LOCALAPPDATA")
    return Path(root) / "QualiStream" if root else Path.home() / ".qualistream"


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("QUALISTREAM_DATA_DIR", default_data_dir())))
    database_url: str | None = field(default_factory=lambda: os.getenv("QUALISTREAM_DATABASE_URL"))
    interview_asr_url: str = field(default_factory=lambda: os.getenv("INTERVIEW_ASR_URL", "http://127.0.0.1:8765/api/v1").rstrip("/"))
    interview_asr_api_token: str = field(default_factory=lambda: os.getenv("INTERVIEW_ASR_API_TOKEN", ""))
    max_upload_mb: int = field(default_factory=lambda: int(os.getenv("QUALISTREAM_MAX_UPLOAD_MB", "4096")))

    @property
    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{(self.data_dir / 'database' / 'qualistream.db').as_posix()}"

    def ensure_directories(self) -> None:
        for name in ("database", "audio", "imports", "exports", "backups", "logs"):
            (self.data_dir / name).mkdir(parents=True, exist_ok=True)


settings = Settings()
