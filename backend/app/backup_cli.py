from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from .config import settings


def validate_archive(archive: zipfile.ZipFile, target: Path) -> tuple[dict, Path]:
    names = archive.namelist()
    if "manifest.json" not in names:
        raise ValueError("備份缺少 manifest.json")
    for name in names:
        resolved = (target / name).resolve()
        if target.resolve() not in resolved.parents and resolved != target.resolve():
            raise ValueError("備份包含不安全路徑")
    manifest = json.loads(archive.read("manifest.json"))
    database_name = Path(str(manifest.get("database", ""))).name
    if not database_name or database_name not in names:
        raise ValueError("備份資料庫資訊無效")
    archive.extractall(target)
    database = target / database_name
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    try:
        result = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if result != "ok": raise ValueError(f"SQLite integrity_check 失敗：{result}")
    finally: connection.close()
    return manifest, database


def restore(backup_zip: Path, confirmation: str) -> None:
    if confirmation != "RESTORE": raise ValueError("必須提供 --confirm RESTORE")
    if not backup_zip.is_file(): raise ValueError("找不到備份 ZIP")
    database = settings.data_dir / "database" / "qualistream.db"
    settings.ensure_directories()
    with tempfile.TemporaryDirectory(prefix="qualistream-restore-") as folder:
        target = Path(folder)
        with zipfile.ZipFile(backup_zip) as archive:
            manifest, restored_db = validate_archive(archive, target)
            if database.exists():
                safety = settings.data_dir / "backups" / f"pre-restore-{datetime.now():%Y%m%d-%H%M%S}.db"
                source = sqlite3.connect(database); destination = sqlite3.connect(safety)
                try: source.backup(destination)
                finally: destination.close(); source.close()
            replacement = database.with_suffix(".restore")
            shutil.copy2(restored_db, replacement)
            os.replace(replacement, database)
            if manifest.get("includes_audio"):
                audio_root = target / "audio"
                if audio_root.is_dir():
                    for file in audio_root.iterdir():
                        if file.is_file(): shutil.copy2(file, settings.data_dir / "audio" / file.name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore a QualiStream backup while the server is stopped")
    parser.add_argument("backup", type=Path)
    parser.add_argument("--confirm", required=True)
    args = parser.parse_args()
    restore(args.backup.resolve(), args.confirm)
    print("還原完成。請重新啟動 QualiStream。")


if __name__ == "__main__": main()

