<template>
  <div class="panel-section">
    <h1 class="section-heading">API 連線設定</h1>
    <p class="section-sub">輸入您的 Google Apps Script Web App URL 以連接雲端 Google Sheets 資料庫。</p>
    <div class="card">
      <div class="form-group">
        <label class="form-label">Google Apps Script Web App URL</label>
        <div class="conn-row">
          <div class="form-group" style="flex:1;margin-bottom:0">
            <input type="url" class="form-input" v-model="store.gasUrl"
              placeholder="https://script.google.com/macros/s/…/exec" />
          </div>
          <button class="btn btn-primary" @click="store.testConnection()" :disabled="testing">
            <span v-if="testing" class="btn-spinner"></span>
            {{ testing ? '測試中…' : '🔗 測試連線' }}
          </button>
        </div>
        <div class="form-hint">貼上 GAS 部署後的 Web App 執行網址。如尚未建置後台，請參考原始碼中的 GAS 程式碼範本。</div>
      </div>
      <div style="margin-top:10px">
        <span class="conn-badge" :class="badgeClass">⬤ &nbsp;{{ badgeText }}</span>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:10px;color:var(--text-primary)">📖 快速上手指引</div>
      <ol style="padding-left:18px;color:var(--text-secondary);font-size:13px;line-height:2.2">
        <li>前往 <a href="https://script.google.com" target="_blank">Google Apps Script</a>，建立新專案，並綁定 Google 試算表。</li>
        <li>將專案根目錄的 <code>gas-backend.js</code> 程式碼貼入 <code>Code.gs</code>。</li>
        <li>點選「部署 → 新增部署 → 網頁應用程式」；執行者：「我」；存取權：「所有人」。</li>
        <li>複製部署後的 URL，貼入上方欄位，按「測試連線」。</li>
        <li>成功後即可創建專案與訪談，並將資料同步至雲端。</li>
      </ol>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:12px;color:var(--text-primary)">📊 試算表欄位結構</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:var(--font-mono)">
          <thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
            <th style="text-align:left;padding:6px 8px">工作表</th>
            <th style="text-align:left;padding:6px 8px">欄位</th>
          </tr></thead>
          <tbody style="color:var(--text-secondary)">
            <tr><td style="padding:6px 8px;color:#818cf8">Projects</td><td style="padding:6px 8px">id, name, description, created_at</td></tr>
            <tr><td style="padding:6px 8px;color:#818cf8">Interviews</td><td style="padding:6px 8px">id, project_id, date, note, interviewers, interviewees, created_at</td></tr>
            <tr><td style="padding:6px 8px;color:#818cf8">Segments</td><td style="padding:6px 8px">id, interview_id, speaker, speaker_name, text, note, timestamp</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()

const testing = computed(() => store.connectionStatus === 'loading')

const badgeClass = computed(() => {
  const map = { connected: 'ok', error: 'fail', loading: 'idle', idle: 'idle' }
  return map[store.connectionStatus] || 'idle'
})

const badgeText = computed(() => {
  const map = { connected: '連線成功', error: '連線失敗', loading: '測試中…', idle: '未測試' }
  return map[store.connectionStatus] || '未測試'
})
</script>
