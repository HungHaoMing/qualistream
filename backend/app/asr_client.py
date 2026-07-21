from __future__ import annotations

from pathlib import Path

import httpx

from .config import settings


class AsrServiceError(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    return {"X-Local-Token": settings.interview_asr_api_token} if settings.interview_asr_api_token else {}


def request(method: str, path: str, **kwargs):
    try:
        with httpx.Client(base_url=settings.interview_asr_url, headers=_headers(), timeout=30.0) as client:
            response = client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as error:
        raise AsrServiceError("無法連線至 InterviewASR，請先啟動本機 ASR API。") from error
    except httpx.HTTPStatusError as error:
        detail = ""
        try:
            detail = error.response.json().get("detail", "")
        except Exception:
            pass
        raise AsrServiceError(f"InterviewASR 回應錯誤（HTTP {error.response.status_code}）{': ' + detail if detail else ''}") from error
    except httpx.HTTPError as error:
        raise AsrServiceError("InterviewASR 通訊失敗。") from error


def health() -> dict:
    return request("GET", "/health")


def create_job(path: Path, original_name: str, mime_type: str, parameters: dict) -> dict:
    with path.open("rb") as stream:
        return request(
            "POST", "/jobs", data={k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in parameters.items()},
            files={"file": (original_name, stream, mime_type)}, timeout=60.0,
        )


def get_job(remote_job_id: str) -> dict:
    return request("GET", f"/jobs/{remote_job_id}")


def get_transcript(remote_job_id: str) -> dict:
    return request("GET", f"/jobs/{remote_job_id}/transcript")


def cancel_job(remote_job_id: str) -> dict:
    return request("POST", f"/jobs/{remote_job_id}/cancel")

