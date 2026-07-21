from __future__ import annotations

import os
import tempfile
from pathlib import Path

ROOT = Path(tempfile.mkdtemp(prefix="qualistream-tests-"))
os.environ["QUALISTREAM_DATA_DIR"] = str(ROOT)
os.environ["QUALISTREAM_DATABASE_URL"] = f"sqlite:///{(ROOT / 'test.db').as_posix()}"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)

