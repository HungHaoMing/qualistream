# QualiStream Repository Knowledge Base

最後驗證日期：2026-07-13（Asia/Taipei）

本文件記錄目前觀察到的 Repository 真實狀態，以及 Repository 擁有者提供的部署事實。本文件不描述目標 Architecture 或未來規劃。

## 1. Repository 身分資訊

- Repository 名稱：`qualistream`
- Git remote：`https://github.com/HungHaoMing/qualistream.git`
- 檢查時目前所在的 local branch：`main`
- Application 名稱：QualiStream
- UI 使用的 Application 說明：多語者質性研究訪談視覺化管理系統
- Repository 擁有者表示，此專案為私人興趣專案。
- Repository 包含 Application source code、Google Apps Script backend source file、文件，以及 GitHub Pages deployment workflow。

## 2. 目前用途

QualiStream 是一套在 browser 中執行、用於整理質性研究訪談的 single-page application。目前實作支援：

- 建立及刪除研究專案。
- 建立、編輯、選取及刪除訪談。
- 訪談者與受訪者姓名清單。
- 產生供使用者手動使用外部 AI service 的 prompt。
- 手動匯入 AI 產生的 JSON transcript segments。
- 以多語者 chat 樣式顯示逐字稿。
- 在 browser 內編輯語者姓名、逐字稿文字及既有備註。
- 匯出 JSON 逐字稿。
- 播放 local audio file。
- 播放 local audio 時標記逐字稿 timestamp 並修正文字。
- 透過 Google Apps Script Web App，將專案、訪談及逐字稿 segments 同步至 Google Sheets。
- 未設定 Google Apps Script URL 時，以記憶體內的 demo 模式運作。

Application 不會直接呼叫 AI model API。AI prompt 與 AI output 由使用者手動轉移。

## 3. Technology stack

### Frontend

- Vue 3，使用 Single File Components 與 Composition API。
- 使用 Pinia 管理共用 application state。
- JavaScript，使用 ECMAScript modules。
- Vue templates 使用一份 global stylesheet 及 inline styles。
- 使用 Vite 作為 development server 與 production build tool。
- 使用 Browser Fetch API 發送 backend requests。
- 使用 Browser `Audio` API 與 object URLs 播放 local audio。

### Backend 與 storage

- Google Apps Script Web App。
- 以 Google Sheets 作為 persistent storage。
- Repository 內提供的 Apps Script source 為 `gas-backend.js`。
- Frontend 透過 GET 與 POST requests，搭配 `action` 值與單一 Apps Script endpoint 溝通。

### Build 與 deployment

- 使用 npm 與 `package-lock.json` 管理 dependencies。
- Push 至 `main` 時，GitHub Actions 會 build frontend。
- GitHub Pages 託管 production frontend。
- GitHub Actions workflow 使用 Node.js 22。
- Vite 使用 `base: './'`。
- Build output directory 為 `dist/`。
- Git 會忽略 `dist/` 與 `node_modules/`。

### 檢查時已安裝環境解析出的 direct package versions

- Vue：3.5.39
- Pinia：3.0.4
- Vite：8.1.3
- `@vitejs/plugin-vue`：6.0.7

### Repository 中不存在的項目

- Dockerfile。
- Docker Compose configuration。
- TypeScript configuration。
- Vue Router configuration。
- ESLint configuration。
- Prettier configuration。
- Unit-test configuration。
- End-to-end-test configuration。
- Python requirements files。
- Environment-variable template。

## 4. Repository 結構

```text
qualistream/
├── .ai/
│   └── KNOWLEDGE_BASE.md
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
├── README.md
├── gas-backend.js
├── index.html
├── index.legacy.html
├── package.json
├── package-lock.json
├── public/
│   └── favicon.svg
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── api/
│   │   └── gas.js
│   ├── assets/
│   │   └── main.css
│   ├── components/
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   ├── BaseModal.vue
│   │   ├── ConfirmModal.vue
│   │   ├── GlobalLoading.vue
│   │   └── ToastContainer.vue
│   ├── composables/
│   │   ├── useAudioPlayer.js
│   │   └── useToast.js
│   ├── stores/
│   │   └── appStore.js
│   └── views/
│       ├── AudioTab.vue
│       ├── ChatTab.vue
│       ├── ImportTab.vue
│       ├── MetaTab.vue
│       ├── PromptTab.vue
│       └── SettingsTab.vue
└── vite.config.js
```

`index.legacy.html` 是先前以 Vanilla JavaScript 實作的 single-file 版本。Repository 擁有者表示，此檔案為暫時保留，目前 deployment 及使用者皆不會使用。

## 5. Frontend 組成

### Entry point

`src/main.js`：

- Import global stylesheet。
- 建立 Vue application。
- 安裝 Pinia。
- 將 `App.vue` mount 至 `#app`。

### Root application

`src/App.vue`：

- Render header、sidebar、tab bar、tab views、modals、toast container、confirmation modal 及 global loading overlay。
- 使用 `store.activeTab` 與 `v-show` 選擇 tab。
- 不使用 URL-based routing。
- Mounted 時呼叫 `store.seedDemoData()`。
- 包含建立 project 與建立 interview 的 modal forms。

### Shared state

`src/stores/appStore.js` 包含：

- GAS URL 與 connection status。
- Projects、interviews 與 segments arrays。
- 目前的 interview ID。
- Speaker color map。
- Active tab。
- Global loading state。
- Confirmation modal state 與 callback。
- API connection 與 data-loading actions。
- Project、interview 與 segment actions。
- Speaker color assignment。
- Demo-data creation。

Components 與 views 直接存取 Pinia store。View components 會直接編輯 interview 與 segment objects，之後才呼叫明確的 save actions。

### API client

`src/api/gas.js` 對外提供：

- `gasGet(gasUrl, params)`。
- `gasPost(gasUrl, body)`。

兩個 functions 都使用 `fetch`、解析 JSON responses、拒絕非成功的 HTTP status codes，並在回傳 JSON 包含 `error` property 時 throw error。

### UI components

- `AppHeader.vue`：Application identity 與 connection status。
- `AppSidebar.vue`：Project/interview tree，以及 create/delete entry points。
- `BaseModal.vue`：通用 teleported modal。
- `ConfirmModal.vue`：由 store 控制的 confirmation modal。
- `GlobalLoading.vue`：由 store 控制的 full-page loading overlay。
- `ToastContainer.vue`：Render shared toast composable 的 messages。

### Views

- `SettingsTab.vue`：輸入 GAS URL、connection test，以及 sheet-column 文件。
- `MetaTab.vue`：Interview date、project、title/note、interviewer list 與 interviewee list。
- `PromptTab.vue`：根據 interview metadata、interview guide 與 raw transcript 建立 plain-text AI prompt。
- `ImportTab.vue`：解析 JSON array、preview 最多五筆資料，並將 array 匯入目前 interview。
- `ChatTab.vue`：以 speaker-colored chat bubbles 顯示目前 segments、允許 contenteditable 修改、儲存 segments，並匯出 JSON。
- `AudioTab.vue`：載入 local audio file、控制 playback、標記 timestamps、編輯 segment text，並儲存 segments。

### Composables

- `useToast.js` 維護 module-level reactive toast list。
- `useAudioPlayer.js` 建立並管理 browser `Audio` object，且在更換檔案及 component unmount 時 revoke local object URLs。

## 6. Runtime state 與 persistence

- GAS URL 的初始值為空字串。
- GAS URL 由使用者在 Settings tab 中輸入。
- 目前 source code 不會將 GAS URL 儲存在 localStorage 或其他 persistent frontend setting。
- 每次 application mount 時，都會將 demo data 放入 Pinia store。
- GAS connection 成功時會呼叫 `loadAll()`，並以 backend response 取代記憶體中的 projects、interviews 與 segments。
- 沒有 GAS URL 時，create 與 save actions 只會更新記憶體中的 Pinia state。
- 未重新連接 GAS 就 reload page 時，會還原 seeded demo data。
- Audio files 透過 object URL 在 local 端處理。
- 目前 source code 不會上傳 audio files。
- Reload page 後不會保留 audio selection。

## 7. Data model

### Projects sheet

Source code 中觀察到的使用欄位：

- `id`
- `name`
- `description`
- `created_at`

### Interviews sheet

Source code 中觀察到的使用欄位：

- `id`
- `project_id`
- `date`
- `note`
- `interviewers`
- `interviewees`
- `created_at`

Interviewer 與 interviewee lists 以 newline-delimited strings 儲存。

### Segments sheet

Source code 中觀察到的使用欄位：

- `id`
- `interview_id`
- `speaker`
- `speaker_name`
- `text`
- `note`
- `timestamp`

以 IDs 表示的預期 relations 為：

```text
Projects.id      <- Interviews.project_id
Interviews.id    <- Segments.interview_id
```

Google Sheets 不會以 database foreign keys 強制執行這些 relations。

## 8. Backend 行為

Repository 版本的 `gas-backend.js` 定義以下 actions。

### GET `getAll`

- 讀取 Projects、Interviews 與 Segments sheets。
- 在單一 response 中回傳三個 sheets 的所有 rows。
- 讀取時若 sheet 不存在，會建立該 sheet。
- Sheet 少於兩列時回傳 empty array。

### POST `saveProject`

- 呼叫 `upsertRow`，並使用 `id` 作為 key。

### POST `saveInterview`

- 呼叫 `upsertRow`，並使用 `id` 作為 key。

### POST `saveSegments`

- 刪除 `interview_id` 與 request 相符的既有 Segment rows。
- 逐一處理 submitted segments。
- 將 submitted `interview_id` 加入每一個 segment。
- 對每一個 segment 呼叫 `upsertRow`，且只使用 `id` 作為 key。

### POST `deleteInterview`

- 刪除 `id` 相符的 Interview row。
- 刪除 Interview ID 相符的 Segment rows。

### POST `deleteProject`

- 刪除 `id` 相符的 Project row。
- Repository 版本的 backend 不會刪除相關的 Interview 或 Segment rows。

### Sheet schema 行為

- Sheet 沒有資料時，`upsertRow` 會使用第一個 object 的 keys 建立 headers。
- Object 出現不存在的新 keys 時，會將其附加為新的 header columns。
- Update 與 insertion rows 會依目前 header order 產生。
- 不存在獨立的 schema 或 migration file。

## 9. 目前的 save 與 delete 行為

- GAS URL 存在時，建立 project 或 interview 會先呼叫 backend，再將 object 加入 local state。
- Import 或 save segments 時，會在 backend request 完成前，先取代 local state 中目前 interview 的 segments。
- Segment persistence 會送出所選 interview 目前完整的 segment list。
- `deleteProject` 會先從 local state 移除 project 及其 interviews，再發送 backend request。
- Local `deleteProject` action 不會從 store 中移除相符的 segments。
- `deleteInterview` 會先從 local state 移除 interview 及相符的 segments，再發送 backend request。
- 目前 project/interview delete actions 會 catch backend errors，且不會將錯誤顯示給 caller。
- 即使已 catch 的 backend request 失敗，delete action 之後仍會顯示 success toast。

## 10. JSON 行為

### Import

- Input 必須能以 `JSON.parse` 解析。
- 解析後的 top-level value 必須是 array。
- `ImportTab.vue` 不存在 per-field schema validation。
- 缺少 segment IDs 時，會以從一開始計算的 array position 取代。
- Store import action 會將 IDs 轉換為 strings。
- 缺少 `speaker` 值時會變成 `unknown`。
- 缺少 `speaker_name` 值時會變成產生的 `說話者 N` 值。
- 缺少 text 與 note 值時會變成 empty strings。
- Import expression `seg.timestamp || null` 會將 falsy timestamp values（包含 numeric zero）轉換為 `null`。

### Export

`ChatTab.vue` 匯出：

- `id`
- `speaker`
- `speaker_name`
- `text`
- `note`

Chat-tab JSON export 不包含 `interview_id` 或 `timestamp`。

## 11. Speaker rendering

- `interviewer` segments render 在左側。
- `interviewee` segments render 在右側。
- Store 定義五種 interviewer colors 與八種 interviewee colors。
- Unique names 數量超過 available colors 時，colors 會重複使用。
- `buildSpeakerColorMap` 會將 `interviewer` 以外的所有 speaker 值分配至 interviewee branch。

## 12. Audio 行為

- File input 使用 `accept="audio/*"`。
- Selected file 的 MIME type 必須以 `audio/` 開頭，才能通過 application check。
- Playback 使用 browser 原生的 audio decoding support。
- Playback controls 包含 play/pause、±10 秒 seeking、progress seeking，以及 0.5x 至 2x 的 rates。
- Timestamps 以 milliseconds 儲存在 Segment objects 上。
- 選取或標記 timestamp 會改變 local Segment state。
- 儲存 corrections 時會送出該 interview 目前的所有 segments。
- 尚未驗證 browser-specific codec compatibility。

## 13. Styling

- Global styles 儲存在 `src/assets/main.css`。
- CSS custom properties 定義 colors、typography、radii、shadows 與 transitions。
- Component templates 也包含 inline style attributes。
- `max-width: 768px` 的 media query 會改變 main layout、form columns、sidebar height 及 chat width。
- `index.html` 會從公開的 Google Fonts service 載入 Google Fonts。

## 14. Build 與 run commands

`package.json` 定義的 commands：

```text
npm run dev      -> vite
npm run build    -> vite build
npm run preview  -> vite preview
```

- Vite 8.1.3 宣告的 Node.js requirement 為 `^20.19.0 || >=22.12.0`。
- 檢查時觀察到的 local Node.js version 為 17.4.0。
- GitHub Actions build 使用 Node.js 22。
- 檢查期間未執行全新的 local production build。

## 15. GitHub Actions deployment

`.github/workflows/deploy.yml` 目前：

- 在 push 至 `main` 時執行。
- 使用 `actions/checkout@v4`。
- 使用 `actions/setup-node@v4`，搭配 Node.js 22 與 npm caching。
- 執行 `npm ci`。
- 執行 `npm run build`。
- 設定 GitHub Pages。
- 將 `./dist` 上傳為 Pages artifact。
- 使用 `actions/deploy-pages@v4` deployment。
- 授予 `contents: read`、`pages: write` 及 `id-token: write`。
- 使用 `pages` concurrency group；較新的 deployment 開始時，會取消進行中的 deployment。

Repository 擁有者表示，GitHub Pages 已啟用，且 deployed source branch 為 `main`。

## 16. 目前的 external deployment 事實

以下數值由 Repository 擁有者提供：

- Production frontend：`https://hunghaoming.github.io/qualistream/`
- Google Sheet：`https://docs.google.com/spreadsheets/d/1nOlEklVfqsTuWCE0r79xq8oy60Ry-dm8Ruxzb1DK3Rg/edit?gid=0#gid=0`
- Apps Script project editor：`https://script.google.com/u/0/home/projects/1YPOMFPTcDpDYZNb8xLD6GBRhkIv_VcSNviRoIvwjIyJyc4bB-LqggeJY/edit`
- Apps Script Web App endpoint：`https://script.google.com/macros/s/AKfycbzwvNjMQq4qxXhfcj-Y9BmwEDCzYsrcB8OjVZZIqsoS_GJmYVVO1A-oqy0BHd13Iw/exec`
- Apps Script Web App access setting：所有人皆可存取。
- Additional authentication 或 proxy protection：無。
- Repository 擁有者預期約有 10 名使用者，但目前 active user count 為 Unknown。
- Repository 擁有者表示可能發生多人同時編輯相同 interview 的情況，但實際 production concurrency 為 Unknown。
- Repository 擁有者將目前 sheet data 描述為 test data。
- Repository 擁有者有尚未上傳至 application 的真實研究資料。所述 data types 包含姓名、人際關係及 audio。

2026-07-13，以未登入狀態向 Web App endpoint 發出帶有 `action=getAll` 的 read-only request，回傳的 JSON 包含：

- 一個 project。
- 一個 interview。
- Transcript segments。
- Interview metadata 與 segment speaker fields 中可識別個人身分的姓名。
- 完整 transcript text。

本次驗證未發送 POST request。

## 17. 目前的 access-control 行為

- Frontend 沒有 login view 或 account session implementation。
- Frontend 不會在 `gasGet` 或 `gasPost` 中傳送 authentication token。
- Repository 版本的 `gas-backend.js` 不會執行 identity 或 authorization checks。
- Deployed `getAll` endpoint 於 2026-07-13 回應了 unauthenticated request。
- Application 沒有 user、membership 或 role data model。
- Application 沒有 audit-log model。
- Application 沒有 record-locking implementation。
- Application 沒有 data-version conflict check。

## 18. Concurrent editing 行為

- Data 會以完整 arrays 載入每個 browser 的 Pinia store。
- Frontend 不會 subscribe remote changes。
- Segment edits 會修改目前 browser 中的 local objects。
- Save 時會送出該 interview 目前完整的 segment list。
- Source 不包含 concurrent changes 的 merge procedure。
- Source 不包含 concurrent changes 的 conflict notification。
- Source 不包含 realtime collaboration implementation。

## 19. 目前 local `dist/` 狀態

檢查當時：

- Local `dist/index.html` 及其 generated assets 的 timestamps 為 2026-07-08 16:58:53 +0800。
- 檢查到的最新 Git commit 為 `8dffad94c4528f3db9492231736d6e2f72fcb609`，時間為 2026-07-08 17:00:42 +0800。
- Commit message 為 `feat: add favicon and upgrade CI node version`。
- Source `index.html` reference `./favicon.svg`。
- Local `dist/index.html` 不包含 favicon reference。
- 檢查到的 local `dist/` file list 不包含 `favicon.svg`。
- 檢查期間未能獨立取得目前 GitHub Pages hosted artifact 的確切 identity。

## 20. README 狀態

README 的 architecture、setup 及 project-structure sections 包含目前的 Vue/Vite/Pinia 說明。

README 的 technology-stack table 另行將專案描述為：

- Vanilla JavaScript。
- 無 framework。
- Zero dependency。
- 無 build tool。

這些敘述與目前的 `package.json` 及 `src/` implementation 不符。

README 表示專案使用 MIT license。Repository 中不存在獨立的 `LICENSE` file。Repository 擁有者尚未確認最終 license choice。

## 21. Unknown

以下事項目前為 Unknown：

- Deployed Apps Script source 是否與 Repository 目前的 `gas-backend.js` 完全一致。
- 目前 GitHub Pages 提供的 artifact 是由哪一個確切的 Git commit SHA 產生。
- 除回傳或文件記載的欄位外，是否還存在未觀察到的 Google Sheet columns。
- Segment IDs 是否已在歷史資料中造成跨 interview overwrite。
- 完整的 Apps Script execution history、error history 與 quota usage。
- 目前使用者使用的 browser 與 operating-system 組合。
- 各 target browser 經過驗證的 audio codec compatibility。
- 目前搭配 generated prompts 使用的 external AI services 與 account plans。
- 目前套用於使用者的 external AI data-retention 與 processing settings。
- 目前的 research consent documents 是否允許 external AI services processing。
- Repository 擁有者最終選擇的 software license。
- 任何 institution、employer、funder 或 third party 是否擁有 Repository code 的權利。
- Test transcript data 是否有 participant consent 或其他 lawful basis 涵蓋。
- GitHub Pages 目前是否提供與最新 `main` source 相符的 favicon 與 generated asset set。
