<template>
  <div class="panel-section">
    <h2 class="section-heading">📥 導入 AI 輸出 JSON</h2>
    <p class="section-sub">將 AI 回傳的標準 JSON 貼入下方，儲存至正式 PostgreSQL 資料庫。</p>

    <div v-if="!iv" class="empty-state">
      <div class="empty-icon">🔗</div>
      <div class="empty-title">尚未選取訪談</div>
      <div class="empty-sub">請從左側選取一筆訪談後，再導入 JSON 資料。</div>
    </div>

    <div v-else>
      <div class="card">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">導入目標</div>
        <div style="font-weight:700;font-size:15px">{{ iv.title || '（無標題）' }}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
          📁 {{ projectName }}&nbsp;|&nbsp;📅 {{ iv.interview_date || '—' }}
        </div>
      </div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">貼入 JSON 字串</label>
          <textarea class="form-textarea json-import-area" v-model="jsonInput"
            :placeholder='`[\n  {\n    "id": 1,\n    "speaker": "interviewer",\n    "speaker_name": "研究員A",\n    "text": "請問您對於這個政策的想法是？",\n    "note": ""\n  }\n]`'></textarea>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" @click="preview">👁️ 預覽（不儲存）</button>
          <button class="btn btn-primary" @click="importSync" :disabled="syncing">
            <span v-if="syncing" class="btn-spinner"></span>
            {{ syncing ? '儲存中…' : '導入逐字稿' }}
          </button>
        </div>
      </div>
      <div v-if="previewData.length" class="card">
        <div style="font-weight:600;margin-bottom:10px">預覽（前 5 筆）</div>
        <div v-for="seg in previewData" :key="seg.id"
          style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px">
          <div style="display:flex;gap:8px;margin-bottom:6px">
            <span class="badge" :class="seg.speaker === 'interviewer' ? 'badge-accent' : ''"
              :style="seg.speaker !== 'interviewer' ? 'background:rgba(249,115,22,0.15);color:#f97316' : ''">
              {{ seg.speaker }}
            </span>
            <span style="color:var(--text-primary);font-weight:600">{{ seg.speaker_name || '—' }}</span>
            <span style="color:var(--text-muted)">#{{ seg.id }}</span>
          </div>
          <div style="color:var(--text-secondary)">{{ seg.text || '' }}</div>
          <div v-if="seg.note" style="color:#fbbf24;margin-top:4px;font-size:11px">📌 {{ seg.note }}</div>
        </div>
        <div v-if="parsedTotal > 5" style="font-size:11px;color:var(--text-muted);text-align:center">
          …共 {{ parsedTotal }} 筆，僅顯示前 5 筆
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'
import { useToast } from '../composables/useToast.js'

const store = useAppStore()
const { toast } = useToast()

const jsonInput = ref('')
const previewData = ref([])
const parsedTotal = ref(0)
const syncing = ref(false)

const iv = computed(() => store.currentInterview)
const projectName = computed(() => {
  if (!iv.value) return '—'
  const p = store.projects.find(p => String(p.id) === String(iv.value.project_id))
  return p?.name || '—'
})

function parseJson() {
  const raw = jsonInput.value.trim()
  if (!raw) { toast('請貼入 JSON 字串', 'warning'); return null }
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) { toast('JSON 必須是陣列格式', 'error'); return null }
    return data
  } catch (e) { toast('JSON 解析失敗：' + e.message, 'error', 5000); return null }
}

function preview() {
  const data = parseJson()
  if (!data) return
  parsedTotal.value = data.length
  previewData.value = data.slice(0, 5)
}

async function importSync() {
  if (!iv.value) { toast('請先選取訪談', 'warning'); return }
  const data = parseJson()
  if (!data) return
  syncing.value = true
  store.showGlobalLoading('導入並同步至雲端…')
  try {
    await store.importSegments(data)
    jsonInput.value = ''
    previewData.value = []
    store.activeTab = 'view'
  } catch (e) { /* handled in store */ }
  finally {
    syncing.value = false
    store.hideGlobalLoading()
  }
}
</script>
