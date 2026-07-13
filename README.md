# 🎙️ QualiStream

QualiStream 是以 Vue 3、Fastify、Firebase Authentication 與 PostgreSQL 建立的質性研究編碼工具，支援逐字稿、階層式 Codebook、部分文字 Coding、Cases、分析矩陣與匿名化匯出。正式資料流程不使用 Google Apps Script／Google Sheets。

## 開發環境

需求：Node.js 22+、Docker 與 Docker Compose。

1. 複製 `.env.example` 為 `.env`，填入 Firebase Web App 公開設定與 API URL。
2. 複製 `server/.env.example` 為 `server/.env`。
3. 在 `secrets/` 建立 `postgres_admin_password`、`postgres_app_password`、`backup_passphrase`，並放入 `firebase-service-account.json`。`server/.env` 的 `DATABASE_URL` 使用 app role 密碼。
4. 執行 `docker compose up --build`。Migration container 會先建立／更新 schema，再啟動 API。
5. 在 `users` table 建立首位使用者並將 `approved` 設為 `true`；`firebase_uid` 必須來自 Google 登入帳號。

Frontend：`npm ci && npm run dev`。Backend：`npm ci --prefix server && npm run dev --prefix server`。

## 驗證

```sh
npm test
npm run build
npm run typecheck:server
npm run test:server
```

## 環境變數與秘密

- `.env.example` 僅包含可公開到 frontend bundle 的 Firebase Web 設定。
- Firebase Admin service account、database password 與 backup passphrase 必須以 Container Manager secret 或唯讀檔案掛載，絕不可提交或放入 frontend。
- `ALLOWED_ORIGINS` 只列出正式 app origins；production 必須設定 `TRUST_PROXY=true` 並由 Synology reverse proxy 強制 HTTPS。

## Synology DS920+

- 只將 API container 經 HTTPS reverse proxy 對外公開，禁止轉發 PostgreSQL port。
- PostgreSQL 與 backup service 只加入 internal `private` network。
- 將 `docker-compose.yml` 的 `/volume1/qualistream-offsite` 改成獨立於 PostgreSQL volume、且會同步到異地目的地的位置。
- Backup service 每日產生 AES-256 加密的 logical dump，並更新 `last-backup-status`；外部監控需檢查結果和更新時間。
- 定期以獨立 PostgreSQL instance 執行 `ops/verify-restore.sh`，不可使用 production database 作為 restore target。

## 帳號與授權

Firebase 只驗證身分。API 只允許 `users.approved=true` 的帳號；Project 與所有 child entities、分析及匯出另由 `project_members` 驗證。新登入帳號不會自動取得資料權限。

## 逐字稿 JSON

匯入格式維持既有 contract：

```json
[
  {
    "id": 1,
    "speaker": "interviewer",
    "speaker_name": "研究員A",
    "text": "訪談內容",
    "note": ""
  }
]
```

音檔仍只在 browser 本機使用，不會上傳至 NAS。
