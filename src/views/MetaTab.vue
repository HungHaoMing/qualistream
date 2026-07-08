<template>
  <div class="panel-section">
    <h2 class="section-heading">訪談資訊設定</h2>
    <p class="section-sub">請先在左側選取訪談，或點擊「新增訪談」建立新筆訪談記錄。</p>

    <div v-if="!iv" class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">尚未選取訪談</div>
      <div class="empty-sub">請從左側選取一筆訪談，或在專案下新增訪談。</div>
    </div>

    <div v-else>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">訪談日期</label>
            <input type="date" class="form-input" v-model="iv.date" />
          </div>
          <div class="form-group">
            <label class="form-label">所屬研究專案</label>
            <select class="form-select" v-model="iv.project_id">
              <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">場次備註 / 標題</label>
          <input type="text" class="form-input" v-model="iv.note" placeholder="例如：第一次深度訪談、焦點小組初探…" />
        </div>
      </div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">🎤 訪談者成員（研究員）</label>
            <textarea class="form-textarea" v-model="iv.interviewers" placeholder="一行一位，例如：&#10;研究員A&#10;研究員B" style="min-height:90px"></textarea>
            <div class="form-hint">每位成員請換行分隔，名稱須與 AI JSON 的 speaker_name 一致。</div>
          </div>
          <div class="form-group">
            <label class="form-label">👥 受訪者成員</label>
            <textarea class="form-textarea" v-model="iv.interviewees" placeholder="一行一位，例如：&#10;受訪者甲&#10;受訪者乙&#10;受訪者丙" style="min-height:90px"></textarea>
            <div class="form-hint">每位成員請換行分隔，名稱須與 AI JSON 的 speaker_name 一致。</div>
          </div>
        </div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" @click="handleSave" :disabled="saving">
          <span v-if="saving" class="btn-spinner"></span>
          {{ saving ? '儲存中…' : '💾 儲存訪談資訊' }}
        </button>
        <button class="btn btn-danger btn-sm" @click="handleDelete">🗑️ 刪除此訪談</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
const saving = ref(false)

const iv = computed(() => store.currentInterview)

async function handleSave() {
  if (!iv.value) return
  saving.value = true
  try {
    await store.saveInterview(iv.value)
  } finally {
    saving.value = false
  }
}

function handleDelete() {
  store.openConfirmModal(
    '刪除訪談',
    '確定刪除此訪談及所有對話片段？此操作無法還原。',
    async () => {
      store.showGlobalLoading('刪除訪談中…')
      await store.deleteInterview(null)
      store.hideGlobalLoading()
    },
    { icon: '🗑️', okText: '確定刪除' }
  )
}
</script>
