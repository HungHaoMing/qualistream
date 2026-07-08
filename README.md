# 🎙️ QualiStream

**多語者質性研究訪談視覺化管理系統**

專為質性研究者設計的單頁應用程式（SPA），支援一對一、焦點小組（一對多）與多對多訪談情境。透過 AI 提示詞產生器高效整理逐字稿，並以多語者 Chat UI 呈現對話，資料透過 Google Apps Script 同步至 Google Sheets 雲端試算表。

---

## 目錄

- [系統架構](#系統架構)
- [功能總覽](#功能總覽)
- [快速開始](#快速開始)
  - [前端部署](#前端部署)
  - [Google Apps Script 後台設置](#google-apps-script-後台設置)
- [資料結構](#資料結構)
  - [試算表欄位](#試算表欄位)
  - [AI 輸出 JSON 格式](#ai-輸出-json-格式)
- [API 參考](#api-參考)
  - [GET — 讀取所有資料](#get--讀取所有資料)
  - [POST — 寫入動作](#post--寫入動作)
- [使用流程](#使用流程)
- [技術棧](#技術棧)
- [開發指引](#開發指引)
  - [專案結構](#專案結構)
  - [CSS 設計系統](#css-設計系統)
  - [JavaScript 模組說明](#javascript-模組說明)
  - [語者顏色系統](#語者顏色系統)
- [已知限制與待辦事項](#已知限制與待辦事項)
- [授權](#授權)

---

## 系統架構

```
┌───────────────────────────────────────────────────┐
│             index.html  (純前端 SPA)               │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ 專案管理  │  │ 提示詞   │  │ 對話視覺化    │   │
│  │ 訪談資訊  │  │ 產生器   │  │ 音檔比對修正  │   │
│  │ JSON 導入 │  │          │  │               │   │
│  └──────────┘  └──────────┘  └───────────────┘   │
│  ┌───────────────────────────────────────────┐    │
│  │ UI 回饋：Toast / Loading / Confirm Modal  │    │
│  └───────────────────────────────────────────┘    │
│                   fetch API                       │
└────────────────────────┬──────────────────────────┘
                         │ HTTP GET / POST
            ┌────────────▼──────────────┐
            │  Google Apps Script       │
            │  Web App (doGet / doPost) │
            └────────────┬──────────────┘
                         │ SpreadsheetApp
            ┌────────────▼──────────────┐
            │     Google Sheets         │
            │  Projects | Interviews    │
            │  Segments (含 timestamp)  │
            └───────────────────────────┘
```

- **前端**：基於 Vue 3 + Vite + Pinia 建立的單頁應用程式（SPA），開發原始碼結構化分置於 `src/` 中。
- **後端**：Google Apps Script Web App，免費、免伺服器，扮演 REST API 角色。
- **資料庫**：Google Sheets，三個工作表分別存放專案、訪談與對話片段。
- **離線模式**：未設定 GAS URL 時，資料僅存於 Pinia 狀態機中（頁面重整後會重新載入示範資料），但所有功能皆可正常預覽。

---

## 功能總覽

| 頁籤 | 功能 |
|------|------|
| ⚙️ **API 設定** | 輸入 GAS URL、測試連線、顯示試算表結構說明 |
| 📋 **訪談資訊** | 設定訪談日期、場次備註、訪談者與受訪者名單 |
| ✨ **提示詞產生器** | 填入訪綱與逐字稿，自動帶入語者名單，一鍵生成 AI Prompt 並複製 |
| 📥 **導入 JSON** | 貼入 AI 輸出的標準 JSON，預覽後同步至 Google Sheets |
| 💬 **對話視覺化** | 多語者 Chat UI：訪談者靠左、受訪者靠右，各語者自動配色；支援 contenteditable 直接編輯後雲端同步 |
| 🎧 **音檔比對** | 上傳音檔（本地處理），搭配逐字稿同步播放、標記時間戳、修正文字並同步至雲端 |

**UI 回饋機制：**
- 🔔 **Toast 通知**：所有操作（成功/失敗/資訊/警告）均有即時通知彈窗
- ⏳ **按鈕 Loading 狀態**：非同步操作時按鈕顯示 Spinner 並禁用，完成後閃光動畫回饋
- 🔲 **全域載入遮罩**：大型操作（導入同步/刪除）顯示半透明遮罩 + 進度文字
- ⚠️ **自製確認對話框**：刪除專案/訪談使用精美 Modal（圖示 + 說明 + 取消/確認），取代原生 `confirm()`

**其他功能：**
- 左側欄：多專案管理、各專案下多篇訪談，可展開/收合
- 語者圖例（Legend）：自動列出所有說話者與對應顏色
- 備註框（黃色）：`note` 欄位非空時自動顯示，可直接編輯
- 匯出 JSON：將當前訪談的完整對話匯出為 `.json` 檔案

---

## 快速開始

### 前端部署與運行

本專案為 **Vue 3 + Vite** 專案，需要先安裝依賴後再啟動開發伺服器或進行部署。

#### 1. 本地開發環境

```bash
# 安裝依賴項目
npm install

# 啟動本地開發伺服器（預設為 http://localhost:5173）
npm run dev

# 打包生產版本靜態檔案
npm run build

# 本地預覽打包後的產出結果
npm run preview
```

> **注意**：Vite 預設產出的 `dist/` 靜態檔案建議部署於 HTTP/HTTPS 環境。直接透過瀏覽器雙擊開啟 `dist/index.html`（使用 `file://` 協定）可能會因為瀏覽器的安全性政策限制，導致 `fetch` 跨域請求被阻擋或資源無法正確載入。

---

#### 2. 託管與部署方式

由於專案已配置 `vite.config.js` 中的 `base: './'`（相對路徑），您可以將專案部署到任何靜態網站託管平台，無需擔心子目錄路徑錯誤。

##### 🚀 方法 A：GitHub Pages 自動化部署 (推薦)
本專案已內建 GitHub Actions 自動化部署工作流（位於 `.github/workflows/deploy.yml`）。當您將專案推送到 GitHub 後，只需按照以下步驟設定即可實現**自動打包與部署**：

1. 將本專案推送至您的 GitHub 儲存庫（例如 `main` 分支）。
2. 在 GitHub 專案頁面中，點擊 **Settings** (設定) -> **Pages**。
3. 在 **Build and deployment** 下的 **Source** 選擇 **GitHub Actions**。
4. 之後每次您推送（Push）程式碼到 `main` 分支時，GitHub Actions 會自動執行編譯並發布至 `https://<您的帳號>.github.io/<專案名稱>/`。

##### 📦 方法 B：手動部署至 GitHub Pages
如果您不想使用 GitHub Actions，也可以使用 `gh-pages` 工具手動部署：
1. 安裝部署工具：
   ```bash
   npm install -D gh-pages
   ```
2. 在 `package.json` 中的 `scripts` 區塊加上：
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
3. 執行部署指令：
   ```bash
   npm run deploy
   ```
4. 在 GitHub 專案的 **Settings** -> **Pages** 中，將 **Source** 設為 `Deploy from a branch`，並將分支選擇為 `gh-pages`。

##### 🌐 方法 C：部署至 Vercel / Netlify / Cloudflare Pages
這些平台對於 Vite 專案提供極佳的一鍵部署支援：
1. 註冊並登入託管平台，並連結您的 GitHub 帳號。
2. 匯入此專案的 GitHub 儲存庫。
3. 平台會自動偵測為 Vite / Vue 專案，確認以下設定：
   - **Build Command (建置指令)**: `npm run build`
   - **Output Directory (輸出目錄)**: `dist`
4. 點擊 **Deploy**，平台即會自動編譯並為您提供一個免費的 HTTPS 網址。

### Google Apps Script 後台設置

1. **建立 GAS 專案**  
   前往 [script.google.com](https://script.google.com)，點選「新增專案」。

2. **綁定 Google 試算表**  
   在 GAS 編輯器，點選「資源 → 試算表服務」，或使用「擴充功能 → Apps Script」從試算表開啟。

3. **貼上後台程式碼**  
   複製本專案根目錄下的 `gas-backend.js` 程式碼，貼入 `Code.gs`。

4. **部署為 Web App**
   - 點選「部署 → 新增部署 → 選取類型：網頁應用程式」
   - **執行者**：「我（自己的帳戶）」
   - **誰可以存取**：「所有人」（Anyone, even anonymous）
   - 點選「部署」，取得 Web App URL

5. **設定 URL**  
   複製 URL（格式：`https://script.google.com/macros/s/…/exec`），貼入前端「API 設定」頁籤，點擊「測試連線」。

> ⚠️ **重新部署注意**：修改 GAS 程式碼後，必須重新部署（建立新版本）才能生效，舊版 URL 不會自動更新。

---

## 資料結構

### 試算表欄位

#### `Projects` 工作表

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一識別碼（`uid()`，`Date.now().toString(36) + random`） |
| `name` | string | 研究專案名稱 |
| `description` | string | 專案說明（選填） |
| `created_at` | string | ISO 8601 建立時間戳記 |

#### `Interviews` 工作表

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一識別碼 |
| `project_id` | string | 所屬 `Projects.id` |
| `date` | string | 訪談日期（`YYYY-MM-DD`） |
| `note` | string | 場次備註 / 標題 |
| `interviewers` | string | 訪談者名單，**換行符號**（`\n`）分隔 |
| `interviewees` | string | 受訪者名單，**換行符號**（`\n`）分隔 |
| `created_at` | string | ISO 8601 建立時間戳記 |

#### `Segments` 工作表

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 片段識別碼（通常為從 1 開始的序號） |
| `interview_id` | string | 所屬 `Interviews.id` |
| `speaker` | string | 說話者角色：`"interviewer"` 或 `"interviewee"` |
| `speaker_name` | string | 具體姓名或代號，如 `"研究員A"`、`"受訪者甲"` |
| `text` | string | 對話內容 |
| `note` | string | 備註（空字串表示無備註） |
| `timestamp` | number \| null | 音檔時間標記（毫秒），由「🎧 音檔比對」標記模式寫入；`null` 表示未標記 |

---

### AI 輸出 JSON 格式

AI（ChatGPT / Claude 等）須嚴格輸出以下格式，才能被系統正確解析：

```json
[
  {
    "id": 1,
    "speaker": "interviewer",
    "speaker_name": "研究員A",
    "text": "請問您對於這個政策的想法是？",
    "note": ""
  },
  {
    "id": 2,
    "speaker": "interviewee",
    "speaker_name": "受訪者甲",
    "text": "我覺得這個政策立意良善，但是執行面有許多問題。",
    "note": ""
  },
  {
    "id": 3,
    "speaker": "interviewee",
    "speaker_name": "受訪者乙",
    "text": "我認同甲的看法，不過補充一點…",
    "note": "此處兩人有搶話現象"
  }
]
```

**欄位規則：**
- `speaker` 只接受 `"interviewer"` 或 `"interviewee"` 兩個值
- `speaker_name` **必須**使用語者名單中的具體人名，不得使用「說話者A」等泛稱
- `note` 若無備註，填入空字串 `""`，不得省略欄位
- 整體必須是合法 JSON 陣列，可直接被 `JSON.parse()` 解析

---

## API 參考

所有 API 呼叫均指向同一個 GAS Web App URL。

### GET — 讀取所有資料

```
GET {GAS_URL}?action=getAll
```

**回傳：**
```json
{
  "projects":   [ { "id": "…", "name": "…", … } ],
  "interviews": [ { "id": "…", "project_id": "…", … } ],
  "segments":   [ { "id": "…", "interview_id": "…", … } ]
}
```

---

### POST — 寫入動作

所有 POST 請求的 `Content-Type` 為 `application/json`，Body 格式：

```json
{
  "action": "<動作名稱>",
  "payload": { … }
}
```

#### `saveProject` — 新增或更新專案

```json
{
  "action": "saveProject",
  "payload": {
    "id": "abc123",
    "name": "研究專案名稱",
    "description": "說明",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### `saveInterview` — 新增或更新訪談

```json
{
  "action": "saveInterview",
  "payload": {
    "id": "def456",
    "project_id": "abc123",
    "date": "2024-06-15",
    "note": "第一次焦點小組",
    "interviewers": "研究員A\n研究員B",
    "interviewees": "受訪者甲\n受訪者乙\n受訪者丙",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### `saveSegments` — 寫入對話片段（全量覆蓋）

```json
{
  "action": "saveSegments",
  "payload": {
    "interview_id": "def456",
    "segments": [
      {
        "id": "1",
        "interview_id": "def456",
        "speaker": "interviewer",
        "speaker_name": "研究員A",
        "text": "…",
        "note": ""
      }
    ]
  }
}
```

> ⚠️ `saveSegments` 會先刪除該 `interview_id` 下的所有舊片段，再逐筆寫入新片段（全量替換策略）。

#### `deleteInterview` — 刪除訪談及其所有片段

```json
{
  "action": "deleteInterview",
  "payload": { "id": "def456" }
}
```

#### `deleteProject` — 刪除專案

```json
{
  "action": "deleteProject",
  "payload": { "id": "abc123" }
}
```

> **注意**：`deleteProject` 目前**不會**自動刪除該專案下的訪談與片段，需由前端自行過濾。

**所有 POST 成功回傳：**
```json
{ "ok": true }
```

**所有 API 錯誤回傳：**
```json
{ "error": "錯誤訊息字串" }
```

---

## 使用流程

```
 1. 部署 GAS 後台
         ↓
 2. 在「API 設定」頁籤輸入 GAS URL 並測試連線
         ↓
 3. 在左側欄「新增專案」
         ↓
 4. 展開專案，點擊「＋」新增訪談
         ↓
 5. 切換至「訪談資訊」頁籤，填入日期、語者名單，儲存
         ↓
 6. 切換至「提示詞產生器」，填入訪綱與原始逐字稿
         → 點擊「生成 AI 提示詞」→「一鍵複製」
         → 貼入 ChatGPT / Claude，取得 JSON 輸出
         ↓
 7. 切換至「導入 JSON」，貼入 AI 輸出的 JSON
         → 點擊「導入並同步至雲端」
         ↓
 8. 切換至「對話視覺化」，檢視多語者 Chat UI
         → 直接點擊氣泡文字進行編輯修正
         → 點擊「儲存並同步至雲端」
         ↓
 9. 切換至「🎧 音檔比對」，上傳訪談錄音檔
         → 開啟「🔖 標記模式」，邊播音檔邊點擊片段標記時間戳
         → 開啟「✏️ 修正模式」，邊聽邊修正逐字稿文字
         → 點擊「☁️ 儲存修正」同步至雲端
         ↓
10. 如需輸出，點擊「匯出 JSON」下載完整逐字稿
```

---

## 技術棧

| 項目 | 技術 |
|------|------|
| 語言 | HTML5 / Vanilla JavaScript（ES2020+）/ CSS3 |
| 字型 | Google Fonts：Inter、Noto Sans TC、JetBrains Mono |
| 框架 | 無（Zero-dependency SPA） |
| 後端 | Google Apps Script（免費 / Serverless） |
| 資料庫 | Google Sheets |
| 部署 | 任何靜態托管（GitHub Pages、Netlify 等） |
| 建置工具 | 無 |

---

### 專案結構

```
qualistream/
├── index.html            # Vite 入口 HTML
├── vite.config.js        # Vite 配置
├── package.json          # 專案依賴與腳本
├── gas-backend.js        # GAS 後台部署用程式碼 (獨立檔案)
├── index.legacy.html     # 重構前的舊 Vanilla JS 單一檔案 (備份參考)
└── src/
    ├── main.js           # 應用程式入口，掛載 Vue / Pinia 並載入 CSS
    ├── App.vue           # 主佈局元件，包含 Header、Sidebar 與 Tab 切換路由器
    ├── assets/
    │   └── main.css      # 全局 CSS 設計系統與所有元件樣式
    ├── api/
    │   └── gas.js        # GAS API 封裝 (gasGet / gasPost)
    ├── stores/
    │   └── appStore.js   # Pinia 全局狀態管理 (取代舊有的全域 App 物件)
    ├── composables/
    │   ├── useToast.js   # 響應式 Toast 訊息通知邏輯
    │   └── useAudioPlayer.js # HTML5 Audio 播放器封裝及時間格式化
    ├── components/
    │   ├── AppHeader.vue # 頂部狀態列與連線狀態指示燈
    │   ├── AppSidebar.vue # 左側研究專案與訪談列表導覽樹
    │   ├── BaseModal.vue # 通用 Modal 彈窗元件
    │   ├── ConfirmModal.vue # 自製刪除確認 Modal 元件
    │   ├── GlobalLoading.vue # 全局載入中遮罩元件
    │   └── ToastContainer.vue # Toast 訊息浮動容器元件
    └── views/
        ├── SettingsTab.vue # [⚙️ API 設定] 頁籤內容
        ├── MetaTab.vue     # [📋 訪談資訊] 頁籤內容
        ├── PromptTab.vue   # [✨ 提示詞產生器] 頁籤內容
        ├── ImportTab.vue   # [📥 導入 JSON] 頁籤內容
        ├── ChatTab.vue     # [💬 對話視覺化] 頁籤內容
        └── AudioTab.vue    # [🎧 音檔比對] 頁籤內容
```

---

### CSS 設計系統

所有全局樣式、CSS 變數、按鈕反饋與動畫均集中在 `src/assets/main.css` 中。

---

### JavaScript 模組說明

應用程式已將原有的 JavaScript 邏輯拆分為獨立的 Vue 元件、Pinia Store、Composables 與 API 模組，詳細劃分如上方專案結構所示。各模組藉由 Pinia 全局 store (`stores/appStore.js`) 進行資料與狀態共用，藉此避免多層元件 props 傳遞，使程式碼更為直觀、好維護。

---

### 語者顏色系統

顏色分配邏輯位於 `buildSpeakerColorMap(segments)` 函數：

- 遍歷片段，遇到**新的** `speaker_name` 才分配顏色
- `interviewer` → 從 `IV_COLORS`（5 色）與 `IV_HEX` 陣列依序取用
- `interviewee` → 從 `IE_COLORS`（8 色）與 `IE_HEX` 陣列依序取用
- 超過上限後會從頭循環（`% length`）

```javascript
const IV_COLORS = ['iv-color-0','iv-color-1','iv-color-2','iv-color-3','iv-color-4'];
const IE_COLORS = ['ie-color-0','ie-color-1',/* …至 */ 'ie-color-7'];
```

若要新增更多語者顏色，在 `:root` 新增 `--iv-5` / `--ie-8` 等變數，並在 `IV_COLORS` / `IE_COLORS` 陣列追加對應 class 名稱，同時在 CSS 新增對應的 `.iv-color-5` / `.ie-color-8` 樣式規則。

---

## 已知限制與待辦事項

### 已知限制

- **無身份驗證**：GAS Web App 設為「所有人可存取」，任何知道 URL 者均可讀寫資料。如需保護，可在 GAS 加入 Token 驗證或改為「僅限登入使用者」。
- **`deleteProject` 不級聯刪除**：刪除專案時，後端 GAS 只刪除 `Projects` 表的該筆資料，不會自動刪除其下的 `Interviews` 與 `Segments`（前端已在記憶體中過濾，但 Sheets 中的孤兒資料仍存在）。
- **`saveSegments` 全量替換**：每次儲存片段時，會先刪除舊資料再全部寫入，若網路中斷可能造成資料部分遺失。
- **無分頁或搜尋**：所有資料一次載入，專案或訪談量極大時效能可能下降。
- **頁面重整消失**：未設定 GAS URL 時，所有操作僅在記憶體中，重整後消失。
- **CORS 限制**：以 `file://` 協定開啟時，部分瀏覽器會阻擋對外的 `fetch` 請求。
- **音檔不儲存於雲端**：音檔使用 `URL.createObjectURL()` 在本地記憶體中處理，頁面重整後需重新上傳。

### 待辦事項（建議開發方向）

- [ ] **GAS 端 `deleteProject` 級聯刪除**：在 `deleteProject` action 中補上刪除關聯的 Interviews 與 Segments
- [ ] **局部更新片段**：改為 `saveSegment`（單筆更新）以取代全量替換，提升可靠性
- [ ] **Token 驗證**：在 GAS `doGet` / `doPost` 加入 `?token=xxx` 驗證，並在前端 API 設定頁新增 Token 輸入欄
- [ ] **搜尋與篩選**：在側欄加入搜尋框，快速定位訪談
- [ ] **標籤 / 主題碼功能**：在 Segments 新增 `tags` 欄位，支援質性研究主題編碼
- [ ] **訪談者 / 受訪者角色切換**：在 Chat UI 支援對單一片段手動切換 `speaker` 類型
- [ ] **離線快取**：使用 `localStorage` 或 `IndexedDB` 在本地備份資料，避免重整遺失
- [ ] **匯出為 DOCX / XLSX**：整合 docx.js 或 SheetJS，支援學術格式匯出
- [ ] **暗色 / 明亮主題切換**：新增主題切換按鈕（目前已有完整的 CSS Custom Properties 設計，切換成本極低）
- [ ] **響應式優化**：目前 RWD 為基礎支援，可進一步優化行動裝置體驗
- [ ] **多人即時協作**：考慮改用 Firebase Realtime Database 或 Supabase 以支援多人同時編輯
- [ ] **自動語音辨識**：整合 Web Speech API 或 Whisper API，實現上傳音檔後自動產生逐字稿
- [ ] **波形顯示**：在音檔播放器中顯示音頻波形圖，方便定位特定片段

---

## 授權

MIT License — 自由使用、修改與分發，請保留原始版權聲明。
