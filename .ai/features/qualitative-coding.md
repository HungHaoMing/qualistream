# Qualitative Coding

## Goal

在 QualiStream 中建立可供正式質性研究使用的可視化編碼功能，讓研究者能在逐字稿的部分文字上套用階層式代碼、記錄 memo、管理研究參與者屬性、取回與比較編碼資料，並以匿名化方式匯出研究成果。

同時將正式資料儲存從 Google Apps Script／Google Sheets 改為由 Synology NAS 自建的 API 與 PostgreSQL，並以 Firebase Authentication 的 Google 登入驗證使用者身分。

## Scope

- Project 層級的共用 Codebook。
- 階層式 Code 管理。
- Code 定義、納入準則、排除準則、顏色、排序、狀態及 code memo。
- 選取單一 Segment 內的部分文字建立 Coding。
- 同一文字範圍可套用多個 Code。
- 同一 Code 可套用至同一 Segment 的不同文字範圍。
- 每筆 Coding 可記錄獨立 memo。
- 在逐字稿上可視化顯示 Coding，包括重疊或巢狀 Coding。
- 依 Project、Interview、Code、Speaker、Case 與 Case attributes 篩選及取回 coded excerpts。
- Code × Interview／Case 的基本分析矩陣。
- Case／participant 管理與有型別的 Case attributes。
- Interview speaker 與 Case 的關聯。
- JSON、XLSX 及 CSV 匯出。
- 匿名化匯出預覽、已知姓名／alias 偵測與人工確認。
- Firebase Authentication Google 登入。
- 自建 backend API 驗證 Firebase ID token 並執行授權。
- PostgreSQL 正式資料庫、schema migrations、constraints、transactions 與備份。
- Synology DS920+ Container Manager 部署 backend API 與 PostgreSQL。
- 已編碼逐字稿修改後的 Coding 失效偵測與重新確認流程。
- 移除正式流程對 Google Apps Script／Google Sheets 的依賴。

## Non-Scope

- 多人同時編碼。
- Intercoder agreement。
- Realtime collaboration。
- AI 自動編碼或 AI 建議編碼。
- 未經研究者確認即自動變更 Coding 範圍。
- REFI-QDA `.qdc`／`.qdpx` 匯入或匯出。
- 列印式研究報告。
- Google Sheets 現有資料遷移。
- 音檔上傳、NAS 音檔儲存或串流。
- 使用 Google Sheets 作為正式或備援資料庫。
- 自動保證移除所有間接識別資訊。
- 將系統限定為 Grounded Theory 專用工具。
- AI 功能的提示詞、模型或資料處理流程。

## Requirements

### Authentication and authorization

- 登入介面只提供 Google 登入。
- Frontend 透過 Firebase Authentication 取得 ID token。
- Frontend 呼叫 backend API 時，以 HTTPS Bearer token 傳送 Firebase ID token。
- Backend 必須使用 Firebase Admin SDK 驗證 token，不得信任 request body 或 URL 中的 user ID。
- Backend 必須將 Firebase UID 對應至 PostgreSQL 中的 local user UUID。
- Firebase 驗證只確認使用者身分；資料授權由 backend 與 PostgreSQL 中的 local user／Project ownership 資料決定。
- 未登入、token 無效或 token 過期的請求必須被拒絕。
- Firebase 登入成功但未被系統核准的帳號不得存取研究資料。
- 所有 Project child entities 與 export operations 都必須驗證 Project ownership。

### Project and Codebook

- 每個 Project 擁有獨立 Codebook。
- 同一 Project 下的所有 Interviews 共用該 Project 的 Codebook。
- 不同 Projects 的 Codes 與 Codings 必須隔離。
- Code 必須使用穩定 UUID，不得以名稱作為 identity。
- Code 必須支援 parent-child hierarchy。
- Code 必須包含名稱、定義、納入準則、排除準則、顏色、排序、狀態及 memo。
- 已有 Coding 使用紀錄的 Code 應可封存並保留研究歷程。
- Code hierarchy 不得形成循環。

### Transcript and Coding

- Segment 必須使用全域唯一 UUID；來源中的序號只作為 display order 或 source reference。
- 使用者可選取單一 Segment 內任意非空文字範圍建立 Coding。
- Coding 必須記錄 Segment、Code、開始位置、結束位置、選取文字、前後文、Segment 文字版本及 memo。
- Offset 規則必須在 frontend 與 backend 間明確且一致；文字選取與高亮以 JavaScript UTF-16 index 為準。
- 同一 Code 不得重複套用到完全相同的 Segment 與文字範圍。
- Coding、Segment 與 Code 必須屬於同一 Project。
- 使用者可移除 Coding，而不刪除原文或 Code。
- UI 必須能辨識同一文字上的多重、重疊或巢狀 Coding。
- Coding 儲存失敗時，不得將未保存狀態顯示為成功。

### Transcript changes

- Segment text 每次正式修改都必須增加文字版本。
- 逐字稿修改後，未受影響的 Coding 應保持有效。
- 受修改影響或無法再驗證文字錨點的 Coding 必須標示為「需重新確認」。
- 系統可依 selected text 與前後文提出重新定位候選。
- 系統不得在沒有使用者確認的情況下變更正式 Coding 範圍。
- 使用者可接受建議位置、手動重選或移除失效 Coding。

### Cases and attributes

- Case 可在系統內使用本名。
- Case 必須使用穩定 UUID。
- Speaker 可關聯至 Case。
- Case attributes 必須有 Project 層級定義及資料型別。
- Case attribute values 必須依定義驗證。
- 使用者可依 Case attributes、Interview、Speaker 與 Code 交叉篩選。

### Analysis

- 使用者可由 Code 取回所有相關 coded excerpts。
- 每筆 coded excerpt 必須保留 Project、Interview、Segment、Speaker／Case 與原文脈絡。
- 系統必須提供 Code × Interview／Case 的基本矩陣。
- 矩陣結果必須由實際 Codings 計算。
- 頻次與矩陣只能作為研究探索資訊，不應在 UI 中宣稱代表主題重要性或研究結論。

### Anonymized export

- 系統內與一般使用流程顯示 Case 本名。
- 每個 Project 對 Case 使用穩定、無語意的匿名代號。
- Participant 預設代號格式為 `P001`、`P002`、`P003`。
- 同一 Case 在同一 Project 的不同 Interviews 與不同次匯出中必須使用相同代號。
- 不同 Projects 各自從 `P001` 開始，且不得共用匿名化 mapping。
- Researcher 可使用 `R001` 類型代號；是否匿名化 Researcher 由匯出操作選擇。
- 匿名化 mapping 必須保存在受保護的 database，不得包含在一般匯出。
- 系統必須自動替換結構化的 Case name 與 speaker label。
- 系統必須使用已登記 aliases 掃描 transcript、Interview note、Code memo、Coding memo 與 Case memo。
- 匯出前必須提供匿名化預覽，讓使用者接受、忽略或手動補充遮蔽。
- 系統必須提示仍需人工檢查地點、職稱、事件等間接識別資訊。
- 匿名化匯出不得修改 database 中的原始資料。
- 首版必須支援完整 JSON，以及分析用 XLSX 和 CSV 匯出。

### Backend and database

- Backend API 與 PostgreSQL 必須部署於 Synology DS920+ 的 Container Manager。
- PostgreSQL 不得直接暴露至 public Internet。
- Public traffic 只經 HTTPS reverse proxy 進入 backend API。
- Backend 必須使用非 PostgreSQL superuser 的 application role。
- Firebase service-account credentials、database password 與其他 server secrets 不得出現在 frontend bundle 或 Git Repository。
- Database schema 必須透過版本化 migrations 建立。
- Database 必須使用 foreign keys、unique constraints、check constraints 與 transactions 保護資料一致性。
- Backend 不得在 production response 或一般 log 中輸出逐字稿、本名、memo、database stack trace 或 secrets。
- API 必須限制允許的 CORS origins、request size 與請求速率。
- Frontend 不再一次載入所有 Projects、Interviews、Segments 與 Codings；資料依目前 Project、Interview 和分析條件載入。

### Backup

- PostgreSQL 必須每日自動產生完整或邏輯備份。
- 備份必須加密。
- 至少一份備份必須存放於原 PostgreSQL data volume 之外。
- 備份成功與失敗必須可被觀察。
- 備份必須定期在獨立 PostgreSQL instance 執行還原驗證。

## Decisions

- 採用正式 PostgreSQL，不使用 Google Sheets 作為新功能的 storage。
- Database 與 backend API 自建於 Synology DS920+。
- NAS 支援 Container Manager，並有固定 public IP 與可使用的 domain name。
- Authentication 使用 Firebase Authentication。
- 登入方式只允許 Google 登入。
- Backend 自行驗證 Firebase ID token 並執行 application authorization。
- PostgreSQL 不直接提供給 browser 存取。
- Codebook 以 Project 為單位。
- 首版支援 Segment 內部分文字編碼。
- 首版只支援單人編碼。
- 首版包含 Code memo 與每筆 Coding memo。
- 首版包含 Case／participant attributes。
- 系統內使用 Case 本名；匿名化只發生於匯出流程。
- 全站匿名代號使用相同規則，Participant 採 Project-scoped `Pnnn`。
- 已編碼逐字稿被修改時，受影響 Coding 標示為需重新確認；系統只提出候選，不自動接受。
- 首版以一般 thematic analysis 工作流為主，並同時容納歸納式、演繹式與混合式編碼。
- 首版匯出 JSON、XLSX、CSV。
- AI 建議編碼延後至後續功能。
- REFI-QDA 互通延後至後續功能。
- Google Sheets 目前沒有需要保留的資料，因此不進行資料遷移或雙寫。
- PostgreSQL 執行每日完整或邏輯備份。

## Assumptions

- Frontend 暫時繼續由 GitHub Pages 部署，並使用 custom app domain；NAS 只承載 backend API 與 PostgreSQL。
- Public domain 分為 `app.<domain>` 與 `api.<domain>`，實際 hostname 在部署時決定。
- Backend 採 Node.js 22 + TypeScript；具體 web framework 在實作前確認，不影響 API 與資料模型需求。
- Google 登入採 server-side allowlist／邀請制，不提供公開註冊；管理者手動核准可登入的 Google 帳號。
- Project ownership 透過 local `users` 與 `project_members` 管理，即使首版只有單人仍保留 membership schema。
- Participant 匿名代號為 `P001` 起算；Researcher 匿名化時使用 `R001` 起算。
- 每日 PostgreSQL 備份的暫定保存策略為最近 14 天每日、最近 8 週每週、最近 12 個月每月各一份。
- 首版先使用每日邏輯備份；WAL archive 與 point-in-time recovery 不在本 Feature 範圍。
- NAS 已具備或將配置有效 HTTPS certificate、reverse proxy、固定 IP 對應 DNS，以及可用的異地加密備份目的地。
- NAS 對外網路允許 HTTPS inbound connection，且沒有尚未確認的 CGNAT 或 ISP 阻擋問題。
- 首版不將音檔儲存至 NAS，沿用 browser local audio 行為。
- 現有 Google Sheets 無需保存或遷移資料。

## Acceptance Criteria

### Authentication and security

- [ ] 畫面只提供 Google 登入。
- [ ] 未登入、無效 token、過期 token 與錯誤 Firebase project token 都無法存取 API。
- [ ] Firebase 驗證成功但未被系統核准的帳號收到 `403` 且無法存取研究資料。
- [ ] 使用者無法透過猜測或修改 UUID 存取不屬於自己的 Project 或 child entities。
- [ ] Frontend bundle 與 Repository 不包含 Firebase service-account credentials、database password 或其他 server secrets。
- [ ] PostgreSQL public port 不可由 Internet 連線。
- [ ] API 強制 HTTPS，且 CORS 只允許核准 origins。

### Codebook and Coding

- [ ] 使用者可在 Project 建立、修改、移動及封存階層式 Code。
- [ ] 同一 Project 下所有 Interviews 使用同一 Codebook，不同 Projects 的 Codebook 完全隔離。
- [ ] 使用者可選取 Segment 中任意非空部分文字建立 Coding。
- [ ] 同一範圍可套用多個 Code，同一 Code 可套用到不同範圍。
- [ ] 重複的 Segment display number 不會造成 Coding 指向錯誤 Segment。
- [ ] 重整並重新登入後，Coding 範圍、Code 與 memo 保持一致。
- [ ] 多重、重疊及巢狀 Coding 在 UI 上可辨識。
- [ ] 儲存失敗時 UI 不顯示成功，且不遺留部分 database write。

### Transcript changes

- [ ] Segment text 修改會增加文字版本。
- [ ] 修改後未受影響的 Coding 保持有效。
- [ ] 受影響的 Coding 顯示「需重新確認」。
- [ ] 系統可提出重新定位候選，但不會自行更新正式範圍。
- [ ] 使用者可接受候選、手動重選或移除 Coding。

### Cases and analysis

- [ ] Speaker 可連結至 Case，Case 可保存經型別驗證的 attributes。
- [ ] 使用者可依 Code、Interview、Speaker、Case 與 attributes 篩選 coded excerpts。
- [ ] 每筆 coded excerpt 顯示來源與原文脈絡。
- [ ] Code × Interview／Case 矩陣與 database 中的 Codings 數量一致。

### Export and anonymization

- [ ] 系統一般畫面顯示 Case 本名。
- [ ] 每個 Project 為 Cases 產生穩定且隔離的 `Pnnn` 匿名代號。
- [ ] 匿名化預覽會替換結構化姓名並列出自由文字中的已知名稱／aliases。
- [ ] 使用者可在匯出前接受、忽略或補充遮蔽項目。
- [ ] 匿名化匯出不包含本名 mapping、Firebase UID 或不必要的內部識別資訊。
- [ ] 重複匯出時，同一 Case 使用相同匿名代號。
- [ ] JSON、XLSX 與 CSV 匯出保留必要的 Codebook、Coding、Case attribute 與來源關聯。
- [ ] 匿名化匯出不修改原始 database 資料。
- [ ] UI 明確提示使用者人工檢查間接識別資訊。

### Operations

- [ ] Versioned migrations 可在全新 PostgreSQL database 建立完整 schema。
- [ ] Backend API、PostgreSQL 與 backup job 可在 DS920+ Container Manager 運行並於 NAS 重啟後恢復。
- [ ] PostgreSQL 每日自動產生加密備份，且至少一份離開原 data volume。
- [ ] 備份失敗可被發現。
- [ ] 備份可在獨立 PostgreSQL instance 完整還原，且核心資料筆數與關聯一致。
- [ ] 既有逐字稿、JSON 匯入、Chat 與 local audio 功能沒有非預期退化。

## Open Questions

目前沒有阻擋 Feature 定義的 Open Questions。開發前應驗證 `Assumptions`；若其中任一項不成立，需先更新本文件再調整實作計畫。
