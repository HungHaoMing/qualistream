from __future__ import annotations


def project_and_interview(client):
    project = client.post("/api/v1/projects", json={"name": "測試研究", "description": ""}).json()
    interview = client.post(f"/api/v1/projects/{project['id']}/interviews", json={"title": "訪談一"}).json()
    return project, interview


def test_health_and_crud(client):
    assert client.get("/api/v1/system/health").json()["database"] == "sqlite"
    project, interview = project_and_interview(client)
    assert client.get("/api/v1/projects").json()[0]["id"] == project["id"]
    assert client.get(f"/api/v1/projects/{project['id']}/interviews").json()[0]["id"] == interview["id"]
    assert client.delete(f"/api/v1/projects/{project['id']}").status_code == 400


def test_transcript_revision_and_conflict(client):
    _, interview = project_and_interview(client)
    created = client.post(f"/api/v1/interviews/{interview['id']}/segments", json={
        "position": 0, "start_ms": 0, "end_ms": 1000, "text": "你好世界"
    }).json()
    patch = {"version": 1, "start_ms": 0, "end_ms": 1100, "text": "你好，世界", "note": ""}
    updated = client.patch(f"/api/v1/segments/{created['id']}", json=patch)
    assert updated.status_code == 200 and updated.json()["version"] == 2
    assert client.patch(f"/api/v1/segments/{created['id']}", json=patch).status_code == 409
    assert len(client.get(f"/api/v1/segments/{created['id']}/revisions").json()) == 1


def test_code_and_partial_text_coding(client):
    project, interview = project_and_interview(client)
    segment = client.post(f"/api/v1/interviews/{interview['id']}/segments", json={
        "position": 0, "start_ms": 0, "end_ms": 1000, "text": "行政負擔很重"
    }).json()
    codebook = client.post(f"/api/v1/projects/{project['id']}/codebooks", json={"name": "主題編碼"}).json()
    code = client.post(f"/api/v1/codebooks/{codebook['id']}/codes", json={"name": "行政負擔", "color": "#f97316"}).json()
    coding = client.post(f"/api/v1/segments/{segment['id']}/codings", json={
        "code_id": code["id"], "start_offset": 0, "end_offset": 4, "quoted_text": "行政負擔"
    })
    assert coding.status_code == 201
    assert client.post(f"/api/v1/segments/{segment['id']}/codings", json={
        "code_id": code["id"], "start_offset": 0, "end_offset": 3, "quoted_text": "不相符"
    }).status_code == 422


def test_import_requires_explicit_replace(client):
    _, interview = project_and_interview(client)
    payload = {"schema_version": 1, "segments": [{"id": "seg_1", "start_ms": 0, "end_ms": 1000, "speaker_id": "SPEAKER_00", "speaker_name": "受訪者", "text": "內容"}]}
    assert client.post(f"/api/v1/interviews/{interview['id']}/transcript/import-json", json=payload).status_code == 200
    assert client.post(f"/api/v1/interviews/{interview['id']}/transcript/import-json", json=payload).status_code == 409


def test_split_merge_and_coding_review(client):
    project, interview = project_and_interview(client)
    segment = client.post(f"/api/v1/interviews/{interview['id']}/segments", json={
        "position": 0, "start_ms": 0, "end_ms": 2000, "text": "行政負擔很重"
    }).json()
    codebook = client.post(f"/api/v1/projects/{project['id']}/codebooks", json={"name": "分析"}).json()
    code = client.post(f"/api/v1/codebooks/{codebook['id']}/codes", json={"name": "負擔"}).json()
    client.post(f"/api/v1/segments/{segment['id']}/codings", json={
        "code_id": code["id"], "start_offset": 0, "end_offset": 4, "quoted_text": "行政負擔"
    })
    split = client.post(f"/api/v1/segments/{segment['id']}/split", json={"split_offset": 4})
    assert split.status_code == 200 and len(split.json()) == 2
    merged = client.post(f"/api/v1/segments/{segment['id']}/merge", json={})
    assert merged.status_code == 200
    patch = {"version": merged.json()["version"], "start_ms": 0, "end_ms": 2000, "text": "完全不同", "note": ""}
    assert client.patch(f"/api/v1/segments/{segment['id']}", json=patch).status_code == 200
    codings = client.get(f"/api/v1/segments/{segment['id']}/codings").json()
    assert codings[0]["status"] == "needs_review"


def test_audio_range_and_backup(client):
    _, interview = project_and_interview(client)
    upload = client.post(f"/api/v1/interviews/{interview['id']}/audio", files={"file": ("sample.wav", b"0123456789", "audio/wav")})
    assert upload.status_code == 201
    audio_id = upload.json()["id"]
    partial = client.get(f"/api/v1/audio/{audio_id}/stream", headers={"Range": "bytes=2-5"})
    assert partial.status_code == 206 and partial.content == b"2345"
    backup = client.post("/api/v1/system/backup")
    assert backup.status_code == 200 and backup.json()["backup"].endswith(".zip")


def test_code_cycle_is_rejected(client):
    project, _ = project_and_interview(client)
    book = client.post(f"/api/v1/projects/{project['id']}/codebooks", json={"name": "階層"}).json()
    parent = client.post(f"/api/v1/codebooks/{book['id']}/codes", json={"name": "父"}).json()
    child = client.post(f"/api/v1/codebooks/{book['id']}/codes", json={"name": "子", "parent_id": parent["id"]}).json()
    response = client.patch(f"/api/v1/codes/{parent['id']}", json={"name": "父", "parent_id": child["id"]})
    assert response.status_code == 422


def test_mock_asr_end_to_end(client, monkeypatch):
    from app import asr_client

    _, interview = project_and_interview(client)
    client.post(f"/api/v1/interviews/{interview['id']}/audio", files={"file": ("sample.wav", b"RIFF-test", "audio/wav")})
    monkeypatch.setattr(asr_client, "create_job", lambda *args, **kwargs: {"job_id": "job-test", "status": "queued", "stage": "queued"})
    monkeypatch.setattr(asr_client, "get_job", lambda job_id: {
        "job_id": job_id, "status": "completed", "stage": "done", "progress": 1.0,
        "message": "完成", "transcript_available": True,
    })
    monkeypatch.setattr(asr_client, "get_transcript", lambda job_id: {
        "schema_version": 1, "job_id": job_id, "language": "zh-TW",
        "segments": [{"id": "seg_000001", "start_ms": 0, "end_ms": 1200,
                      "speaker_id": "SPEAKER_00", "speaker_name": "語者 1", "speaker_role": "unknown", "text": "測試內容", "note": ""}],
    })
    created = client.post(f"/api/v1/interviews/{interview['id']}/asr/jobs", json={}).json()
    status = client.get(f"/api/v1/asr/jobs/{created['id']}")
    assert status.status_code == 200 and status.json()["status"] == "completed"
    preview = client.get(f"/api/v1/asr/jobs/{created['id']}/preview")
    assert preview.status_code == 200 and preview.json()["segments"][0]["start_ms"] == 0
    imported = client.post(f"/api/v1/asr/jobs/{created['id']}/import")
    assert imported.status_code == 200 and imported.json()["segments_imported"] == 1
