<template>
  <div v-if="!iv" class="empty-state" style="margin-top:60px">
    <div class="empty-icon">💬</div>
    <div class="empty-title">尚未選取訪談</div>
    <div class="empty-sub">請從左側選取一筆訪談，即可看到多語者對話視覺化。</div>
  </div>

  <div v-else style="display:flex;flex-direction:column;height:100%">
    <!-- Header -->
    <div class="interview-header">
      <div class="interview-meta">
        <div class="meta-chip">📁 <strong>{{ projectName }}</strong></div>
        <div class="meta-chip">📋 <strong>{{ iv.note || '（無標題）' }}</strong></div>
        <div class="meta-chip">📅 <strong>{{ iv.date || '—' }}</strong></div>
        <div class="meta-chip">💬 <strong>{{ segments.length }}</strong> 個片段</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary btn-sm" @click="store.activeTab = 'meta'">✏️ 編輯資訊</button>
      </div>
    </div>

    <!-- Legend -->
    <div class="legend">
      <div v-for="(info, name) in store.speakerColorMap" :key="name" class="legend-chip"
        :style="{ background: info.hex + '18', border: '1px solid ' + info.hex + '44' }">
        <div class="legend-dot" :style="{ background: info.hex }"></div>
        <span :style="{ color: info.hex, fontSize: '11px', fontWeight: 700 }">{{ name }}</span>
        <span style="color:var(--text-muted);font-size:10px">{{ info.type === 'interviewer' ? '訪談者' : '受訪者' }}</span>
      </div>
    </div>

    <!-- Toolbar -->
    <div style="padding:10px 24px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;background:var(--bg-secondary);flex-shrink:0">
      <button class="btn btn-success btn-sm" @click="saveAndSync" :disabled="syncing">
        <span v-if="syncing" class="btn-spinner"></span>
        {{ syncing ? '同步中…' : '☁️ 儲存並同步至雲端' }}
      </button>
      <button class="btn btn-secondary btn-sm" @click="exportJson">⬇️ 匯出 JSON</button>
      <div style="font-size:11px;color:var(--text-muted)">{{ syncStatus }}</div>
    </div>

    <!-- Chat -->
    <div class="chat-area" style="flex:1;overflow-y:auto;min-height:0" ref="chatAreaRef">
      <div v-if="!segments.length" class="empty-state">
        <div class="empty-icon">💬</div>
        <div class="empty-title">尚無對話資料</div>
        <div class="empty-sub">請前往「導入 JSON」頁籤貼入 AI 處理後的逐字稿 JSON。</div>
      </div>
      <div v-for="seg in segments" :key="seg.id" class="chat-msg" :class="getSpeakerInfo(seg).side">
        <div class="segment-id">#{{ seg.id }}</div>
        <div class="speaker-label" contenteditable="true" spellcheck="false"
          :style="labelStyle(seg)"
          @blur="e => seg.speaker_name = e.target.textContent.trim() || seg.speaker_name">
          {{ seg.speaker_name }}
        </div>
        <div class="bubble" :class="getSpeakerInfo(seg).colorClass" contenteditable="true" spellcheck="false"
          @blur="e => seg.text = e.target.textContent.trim() || seg.text">
          {{ seg.text }}
        </div>
        <div class="note-badge" contenteditable="true" spellcheck="false"
          :style="{ display: seg.note ? 'flex' : 'none' }"
          :data-has-note="!!seg.note"
          @blur="e => seg.note = e.target.textContent.trim()">
          {{ seg.note }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAppStore } from '../stores/appStore.js'
import { useToast } from '../composables/useToast.js'

const store = useAppStore()
const { toast } = useToast()

const syncing = ref(false)
const syncStatus = ref('')

const iv = computed(() => store.currentInterview)
const segments = computed(() => store.currentSegments)
const projectName = computed(() => {
  if (!iv.value) return '—'
  return store.projects.find(p => String(p.id) === String(iv.value.project_id))?.name || '—'
})

watch(segments, (segs) => {
  store.buildSpeakerColorMap(segs)
  syncStatus.value = '共 ' + segs.length + ' 個對話片段，點擊任意氣泡可直接編輯'
}, { immediate: true })

function getSpeakerInfo(seg) {
  return store.speakerColorMap[seg.speaker_name] || {
    colorClass: seg.speaker === 'interviewee' ? 'ie-color-0' : 'iv-color-0',
    hex: seg.speaker === 'interviewee' ? '#f97316' : '#6366f1',
    side: seg.speaker === 'interviewee' ? 'right' : 'left',
  }
}

function labelStyle(seg) {
  const info = getSpeakerInfo(seg)
  return { background: info.hex + '22', color: info.hex, border: '1px solid ' + info.hex + '44' }
}

async function saveAndSync() {
  if (!iv.value) return
  syncing.value = true
  syncStatus.value = '⏳ 同步中…'
  try {
    await store.saveSegments([...segments.value])
    syncStatus.value = '✅ 已於 ' + new Date().toLocaleTimeString('zh-TW') + ' 同步'
    store.buildSpeakerColorMap(segments.value)
  } catch (e) {
    syncStatus.value = '❌ 同步失敗'
  } finally {
    syncing.value = false
  }
}

function exportJson() {
  if (!iv.value) return
  const data = segments.value.map(s => ({ id: s.id, speaker: s.speaker, speaker_name: s.speaker_name, text: s.text, note: s.note }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'interview_' + iv.value.id + '_' + (iv.value.date || 'export') + '.json'
  a.click(); URL.revokeObjectURL(url)
  toast('JSON 已下載', 'success')
}
</script>
