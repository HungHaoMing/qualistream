# QualiStream Backlog

Last updated: 2026-07-13

Priority 定義：

- `P0`：涉及目前資料安全或資料毀損風險。
- `P1`：影響核心正確性、正式使用或重要決策。
- `P2`：影響文件準確性、可靠性或維護性。
- `P3`：非必要的體驗、架構或工程改善。

Current Status 定義：

- `Open`：已建立項目，尚未處理。
- `Confirmed`：已由程式碼或實際行為確認。
- `Needs Decision`：需要 Repository 擁有者提供資訊或做出決策。
- `Needs Verification`：需要 Repository 以外的資訊或外部狀態驗證。

## Documentation

- [ ] **DOC-001 — README 技術棧過期**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 否
  - 是否需要我決策: 否

- [ ] **DOC-002 — README 對 `deleteProject` 的前端清理描述不完整**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 否（若只校正文件）
  - 是否需要我決策: 否

- [ ] **DOC-003 — README 未說明 JSON 匯出會省略 `timestamp`**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否（若只校正文件）
  - 是否需要我決策: 是

- [ ] **DOC-004 — README 對空白備註可直接編輯的描述不正確**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否（若只校正文件）
  - 是否需要我決策: 是

- [ ] **DOC-005 — README 的 MIT 宣告與目前授權狀態不一致**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **DOC-006 — README 未完整記錄正式部署的匿名 API 狀態**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 否
  - 是否需要我決策: 否

- [ ] **DOC-007 — 本地 `dist/` 不是目前 source 的完整 build artifact**
  - Priority: `P2`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 否
  - 是否需要我決策: 否

- [ ] **DOC-008 — `index.legacy.html` 缺少明確的 legacy/deprecated 狀態標示**
  - Priority: `P3`
  - Current Status: `Open`
  - 是否需要修改程式: 否
  - 是否需要我決策: 否

## Unknown

- [ ] **UNK-001 — 線上 GAS source 是否與 Repository backend 完全一致**
  - Priority: `P1`
  - Current Status: `Needs Verification`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是（或提供線上 GAS source）

- [ ] **UNK-002 — GitHub Pages artifact 對應的確切 commit SHA**
  - Priority: `P2`
  - Current Status: `Needs Verification`
  - 是否需要修改程式: 否
  - 是否需要我決策: 否

- [ ] **UNK-003 — Google Sheets 是否存在未觀察到的欄位**
  - Priority: `P2`
  - Current Status: `Needs Verification`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是（或允許唯讀檢查）

- [ ] **UNK-004 — 歷史資料是否已發生跨訪談 Segment 覆寫**
  - Priority: `P0`
  - Current Status: `Needs Verification`
  - 是否需要修改程式: 否（確認歷史狀態）
  - 是否需要我決策: 是（或提供歷史／備份資料）

- [ ] **UNK-005 — Apps Script execution、error 與 quota 歷史**
  - Priority: `P2`
  - Current Status: `Needs Verification`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是（或提供 Apps Script Executions 資訊）

- [ ] **UNK-006 — 實際 active users 與 concurrency 規模**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-007 — 正式使用者的 browser 與 operating system 組合**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-008 — Audio codec 在 target browsers 的實際相容性**
  - Priority: `P2`
  - Current Status: `Needs Verification`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是（需先提供 target browsers）

- [ ] **UNK-009 — 目前使用的 external AI services 與 account plans**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-010 — External AI data-retention 與 processing settings**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-011 — Research consent 是否允許 external AI processing**
  - Priority: `P0`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-012 — 目前 test transcript 的 consent 或其他 lawful basis**
  - Priority: `P0`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-013 — Repository 最終 software license**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

- [ ] **UNK-014 — Institution、employer、funder 或 third party 是否擁有程式碼權利**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否
  - 是否需要我決策: 是

## Confirmed Defect

- [ ] **DEF-001 — GAS endpoint 可匿名讀取具識別性的完整資料**
  - Priority: `P0`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是（另涉及 deployment access setting）
  - 是否需要我決策: 是（需決定 authentication/authorization 方向）

- [ ] **DEF-002 — Segment upsert key 會跨 Interview 碰撞**
  - Priority: `P0`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 否

- [ ] **DEF-003 — `deleteProject` 不會完整刪除關聯資料**
  - Priority: `P0`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是（需確認刪除語意）

- [ ] **DEF-004 — Backend 刪除失敗仍顯示成功**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 否

- [ ] **DEF-005 — Segment 同步失敗時 local state 已先被取代**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 否

- [ ] **DEF-006 — `saveSegments` 非 atomic，可能留下空白或部分資料**
  - Priority: `P0`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 否

- [ ] **DEF-007 — 多人編輯採 last-write-wins 且無衝突偵測**
  - Priority: `P0`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是（需決定 concurrent editing 行為）

- [ ] **DEF-008 — Timestamp `0` 在 JSON import 時會轉為 `null`**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 否

- [ ] **DEF-009 — JSON import 缺少 per-field schema validation**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是（需確認 validation rules）

- [ ] **DEF-010 — JSON export 遺漏 `timestamp`**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（若 export 應完整保存 Segment）
  - 是否需要我決策: 是

- [ ] **DEF-011 — 空白備註無法透過 Chat UI 新增**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（若應允許新增）
  - 是否需要我決策: 是

- [ ] **DEF-012 — Chat 與 Audio 的空白文字修改會被還原**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（若允許清空文字）
  - 是否需要我決策: 是

- [ ] **DEF-013 — `unknown` speaker 會被當成 `interviewee` render**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（若 `unknown` 不應視為 `interviewee`）
  - 是否需要我決策: 是

- [ ] **DEF-014 — 檢查時 local Node.js 與目前 Vite 不相容**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 否（可調整 local runtime）
  - 是否需要我決策: 否

- [ ] **DEF-015 — 預設日期使用 UTC，可能與台灣 local date 不同**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（若應採 local date）
  - 是否需要我決策: 是

- [ ] **DEF-016 — GAS 對全新空白 Sheet 的 header 初始化條件不正確**
  - Priority: `P1`
  - Current Status: `Confirmed`
  - 是否需要修改程式: 是
  - 是否需要我決策: 否

## Improvement Proposal

- [ ] **IMP-001 — 將 Google Sheets storage 遷移至正式 database**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-002 — 導入完整 authentication 與 role-based authorization**
  - Priority: `P0`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-003 — 導入 Segment-level update 與 optimistic locking**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-004 — 導入 Realtime collaboration 或 editing lock**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-005 — 建立 audit log 與 revision history**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-006 — 加入 pagination、search 與 incremental loading**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-007 — 將逐筆 GAS 寫入改為 batch 或局部 Segment write**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-008 — 為 GAS URL 或 offline data 加入 local persistence**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-009 — 建立 automated test infrastructure**
  - Priority: `P2`
  - Current Status: `Open`
  - 是否需要修改程式: 是（測試與設定；產品邏輯不一定）
  - 是否需要我決策: 是（需決定測試範圍）

- [ ] **IMP-010 — 加入 lint、format 與 type checking**
  - Priority: `P2`
  - Current Status: `Open`
  - 是否需要修改程式: 是（主要為設定）
  - 是否需要我決策: 是

- [ ] **IMP-011 — 導入 URL routing**
  - Priority: `P3`
  - Current Status: `Open`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-012 — 將 global 與 inline styles componentize**
  - Priority: `P3`
  - Current Status: `Open`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是

- [ ] **IMP-013 — 在 Repository 中宣告標準 Node.js version**
  - Priority: `P2`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（設定檔）
  - 是否需要我決策: 是

- [ ] **IMP-014 — 封存或移除 `index.legacy.html`**
  - Priority: `P3`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 否（會移動或刪除 legacy file）
  - 是否需要我決策: 是

- [ ] **IMP-015 — 建立受控的 external AI processing 與去識別流程**
  - Priority: `P1`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是（若系統化實作）
  - 是否需要我決策: 是

- [ ] **IMP-016 — 提供 private cloud audio storage**
  - Priority: `P3`
  - Current Status: `Needs Decision`
  - 是否需要修改程式: 是
  - 是否需要我決策: 是
