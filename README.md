# QualiStream

QualiStream 是一套完全本機優先的質性訪談工作台，整合研究專案管理、音檔、InterviewASR、逐字稿人工校正、修訂歷程、階層式編碼本、部分文字編碼與研究備忘錄。

Google Apps Script 與 Google Sheets 已全面移除。正式資料只存放於本機 SQLite 與本機音檔目錄。

## 系統架構

```text
Vue 3 frontend
    │ same-origin /api/v1
FastAPI local backend (127.0.0.1:8080)
    ├── SQLite：研究資料、逐字稿、修訂、編碼、memo
    ├── audio/：訪談音檔
    └── InterviewASR API (127.0.0.1:8765)
```

QualiStream 是人工校正後逐字稿與質性編碼的主資料來源。InterviewASR 的回傳會先以不可變更的 `transcript_sources.raw_json` 保存，再建立可人工編輯的 working copy。重新匯入不會刪除舊版本的修訂與編碼，而是將舊片段封存。

## 需求

- Windows 10/11
- Python 3.10–3.12（建議 3.12）
- Node.js 20 以上
- 選用：[InterviewASR](F:/InterviewASR) 本機服務

## 安裝

在 PowerShell 執行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install.ps1
```

安裝腳本會建立專案自己的 `.venv`、安裝 FastAPI／SQLAlchemy／Alembic，並安裝前端套件。

## 正式啟動

```powershell
.\start.ps1
```

也可以雙擊 `start.cmd`。啟動流程會：

1. 執行尚未套用的 Alembic migration。
2. 必要時建立 Vue production build。
3. 由 FastAPI 在 <http://127.0.0.1:8080> 提供網站與 API。

程式預設只監聽 loopback，不會向區域網路公開。

## 開發模式

先啟動後端：

```powershell
$env:PYTHONPATH = "$PWD\backend"
.\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

另一個終端啟動 Vite：

```powershell
npm.cmd run dev
```

Vite 會把 `/api` 代理到本機 8080。

## 資料位置

預設資料目錄：

```text
%LOCALAPPDATA%\QualiStream\
├── database\qualistream.db
├── audio\
├── imports\
├── exports\
├── backups\
└── logs\
```

可在 `.env` 或啟動環境中設定：

```dotenv
QUALISTREAM_DATA_DIR=D:\QualiStreamData
QUALISTREAM_MAX_UPLOAD_MB=4096
INTERVIEW_ASR_URL=http://127.0.0.1:8765/api/v1
INTERVIEW_ASR_API_TOKEN=
```

不要將執行中的 SQLite database 放在 Synology mapped drive 或其他網路共享路徑。SQLite 的檔案鎖定不適合讓多台電腦透過網路檔案系統同時開啟。

## InterviewASR 工作流程

1. 在 `F:\InterviewASR` 啟動 API（預設 127.0.0.1:8765）。
2. 在 QualiStream 建立專案與訪談。
3. 進入「語音辨識」，上傳音檔並設定引擎、模式、語者數與術語。
4. 建立非同步工作並更新進度。
5. 工作完成後由研究者明確確認匯入。
6. 為語者設定顯示名稱與訪談者／受訪者角色。
7. 在「逐字稿校正」修正文字、時間與語者。
8. 在「編碼本」建立代碼，再回逐字稿選取部分文字進行編碼。

InterviewASR 未啟動時，專案管理、既有逐字稿校正與編碼仍可正常使用。

## 資料模型

主要資料表：

- `projects`、`interviews`：研究與訪談。
- `audio_files`：音檔 metadata；實際路徑不透過 API 公開。
- `speakers`：穩定語者 ID、顯示名稱與角色。
- `transcript_sources`：原始 ASR／JSON snapshot。
- `transcript_segments`：目前及封存的 working copy。
- `transcript_revisions`：文字、時間與語者修改歷程。
- `codebooks`、`codes`：階層式編碼本。
- `codings`：文字範圍、引用文字、memo 與確認狀態。
- `memos`：專案、訪談、片段或編碼備忘錄。
- `asr_jobs`：本機 ASR 工作狀態。

文字 offset 使用 Unicode code point，而不是 UTF-16 code unit。前端在送出選取範圍前會進行轉換，因此包含 emoji 或罕見字元時仍能與 Python 後端一致。

若人工修改使原編碼範圍失效，系統只會在引用文字能唯一找到時自動重定位；否則標記為 `needs_review`，避免代碼靜默套到錯誤文字。

## 備份

API `POST /api/v1/system/backup` 使用 SQLite backup API 產生一致性 snapshot，再封裝成 ZIP。加上 `?include_audio=true` 可包含音檔。

備份會存到：

```text
%LOCALAPPDATA%\QualiStream\backups
```

完成的 ZIP 可以人工複製到 Synology NAS。請備份整個 ZIP，不要直接同步正在使用的 `qualistream.db`、`-wal` 或 `-shm`。

還原必須先停止 QualiStream，再執行：

```powershell
.\scripts\restore.ps1 -BackupZip "D:\Backup\qualistream-20260721-120000.zip" -Confirm RESTORE
```

還原工具會驗證 ZIP 路徑、manifest 與 SQLite `integrity_check`，並在替換前建立 `pre-restore-*.db` 安全副本。刻意不提供線上還原 API，避免在資料庫仍有連線時替換正式檔案。

## 匯出

- 訪談：JSON、Markdown、TXT、SRT、VTT。
- 專案：完整 JSON。
- 質性編碼：含 UTF-8 BOM 的 CSV，可直接用常見試算表開啟繁體中文。
- 音檔：透過支援 HTTP Range 的串流 endpoint 播放。

## 測試

```powershell
$env:PYTHONPATH = "$PWD\backend"
.\.venv\Scripts\python.exe -m pytest backend\tests -q
npm.cmd test
npm.cmd run build
```

後端測試使用獨立暫存 SQLite，不會接觸正式研究資料，也不會下載 ASR 模型。

## 隱私與安全

- Backend 與 InterviewASR 預設只監聽 127.0.0.1。
- 前端不取得 ASR token 或本機檔案路徑。
- 上傳檔案使用 UUID 保存並限制副檔名與大小。
- 研究資料、音檔、database、備份、`.env` 與 logs 都被 Git 排除。
- Log 不應寫入完整逐字稿、memo、編碼內容或原始 ASR JSON。
- 所有覆蓋匯入與刪除 API 都要求明確確認。

## 未來多人協作

目前 SQLite 適合單機研究者。如果未來需要多台電腦或多人同時編輯，建議在 Synology Container Manager 部署 PostgreSQL，並將 FastAPI 部署為唯一資料存取入口。專案已使用 SQLAlchemy 與 Alembic，能保留大部分 model、service 與 migration 架構；屆時仍需增加登入、權限、TLS、衝突處理與正式備份策略，不應只把 SQLite 檔案搬到 NAS。
