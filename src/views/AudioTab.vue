<template>
  <div v-if="!iv" class="empty-state" style="margin-top:60px">
    <div class="empty-icon">🎧</div>
    <div class="empty-title">尚未選取訪談</div>
    <div class="empty-sub">請從左側選取一筆訪談，再上傳音檔進行比對修正。</div>
  </div>

  <div v-else style="display:flex;flex-direction:column;height:100%">
    <!-- Player Section -->
    <div style="padding:20px 24px 0;flex-shrink:0">
      <input type="file" ref="fileInputRef" accept="audio/*" style="display:none" @change="handleFileSelect" />

      <!-- Upload Area -->
      <div v-if="!player.hasFile.value" class="audio-upload-area"
        :class="{ 'drag-over': dragging }"
        @click="fileInputRef.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="handleDrop">
        <span class="upload-icon">🎤</span>
        <div class="upload-label">點擊選取或拖曳音檔</div>
        <div class="upload-hint">MP3 / WAV / M4A / OGG / FLAC 均支持</div>
      </div>

      <!-- Player -->
      <div v-else class="audio-player-card">
        <div class="audio-filename">🎵 <span>{{ player.fileName.value }}</span></div>
        <div class="audio-progress-wrap" @click="player.seekByClick($event)">
          <div class="audio-progress-fill" :style="{ width: player.progressPercent.value + '%' }"></div>
          <div class="audio-progress-thumb" :style="{ left: player.progressPercent.value + '%' }"></div>
        </div>
        <div class="audio-time">
          <span>{{ formatTime(player.currentTime.value) }}</span>
          <span>{{ formatTime(player.duration.value) }}</span>
        </div>
        <div class="audio-controls">
          <button class="audio-btn" @click="player.seek(-10)">◀◀ -10s</button>
          <button class="audio-btn play-btn" @click="player.toggle()">
            {{ player.isPlaying.value ? '⏸ 暫停' : '▶ 播放' }}
          </button>
          <button class="audio-btn" @click="player.seek(10)">+10s ▶▶</button>
          <select class="rate-select" :value="player.playbackRate.value" @change="player.setRate(+$event.target.value)">
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="1.75">1.75x</option>
            <option value="2">2.0x</option>
          </select>
          <button class="audio-btn" @click="fileInputRef.click()" style="margin-left:auto">📁 更換音檔</button>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="sync-toolbar">
      <button class="btn btn-sm" :class="markMode ? 'btn-primary' : 'btn-secondary'" @click="markMode = !markMode">
        🔖 標記模式：{{ markMode ? '開' : '關' }}
      </button>
      <button class="btn btn-sm" :class="editMode ? 'btn-success' : 'btn-secondary'" @click="editMode = !editMode">
        ✏️ 修正模式：{{ editMode ? '開' : '關' }}
      </button>
      <button v-if="editMode" class="btn btn-primary btn-sm" @click="saveCorrections" :disabled="saving">
        <span v-if="saving" class="btn-spinner"></span>
        {{ saving ? '儲存中…' : '☁️ 儲存修正' }}
      </button>
      <div style="font-size:11px;color:var(--text-muted);flex:1;text-align:right">
        {{ markMode ? '✅ 標記模式開啟——點擊任一片段可標記目前播放時間' : '💡 開啟「標記模式」後，點擊任一片段可標記目前播放時間' }}
      </div>
    </div>

    <!-- Sync List -->
    <div class="sync-list">
      <div v-if="!segments.length" class="audio-no-seg">
        <div style="font-size:32px">📝</div>
        <div style="font-weight:600">尚無對話資料</div>
        <div style="font-size:12px">請先前往「導入 JSON」頁籤導入逐字稿</div>
      </div>
      <div v-for="seg in segments" :key="seg.id"
        class="sync-row"
        :class="{ 'has-ts': seg.timestamp != null, 'mark-mode': markMode, playing: playingSegId === String(seg.id) }"
        @click="handleRowClick(seg, $event)">
        <span class="timestamp-badge" :class="{ unset: seg.timestamp == null }"
          @click.stop="seg.timestamp != null ? jumpTo(seg.timestamp) : (markMode && setTimestamp(seg))">
          {{ seg.timestamp != null ? '▶ ' + formatTime(seg.timestamp / 1000) : '未標記' }}
        </span>
        <span class="sync-row-speaker"
          :style="{ background: getSpeakerInfo(seg).hex + '22', color: getSpeakerInfo(seg).hex, border: '1px solid ' + getSpeakerInfo(seg).hex + '44' }">
          {{ seg.speaker_name }}
        </span>
        <div class="sync-row-text" :contenteditable="editMode" spellcheck="false"
          @blur="e => { if (editMode) seg.text = e.target.textContent.trim() || seg.text }">
          {{ seg.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAppStore } from '../stores/appStore.js'
import { useToast } from '../composables/useToast.js'
import { useAudioPlayer, formatTime } from '../composables/useAudioPlayer.js'

const store = useAppStore()
const { toast } = useToast()
const player = useAudioPlayer()

const fileInputRef = ref(null)
const dragging = ref(false)
const markMode = ref(false)
const editMode = ref(false)
const saving = ref(false)
const playingSegId = ref(null)

const iv = computed(() => store.currentInterview)
const segments = computed(() => store.currentSegments)

// Highlight by time
watch(() => player.currentTime.value, (sec) => {
  if (!iv.value) return
  const segs = segments.value.filter(s => s.timestamp != null)
  let best = null
  segs.forEach(s => {
    if (Number(s.timestamp) <= sec * 1000) best = s
  })
  playingSegId.value = best ? String(best.id) : null
})

watch(segments, (segs) => {
  store.buildSpeakerColorMap(segs)
}, { immediate: true })

function getSpeakerInfo(seg) {
  return store.speakerColorMap[seg.speaker_name] || { hex: '#6366f1', type: 'unknown' }
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) loadFile(file)
}

function handleDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) loadFile(file)
}

function loadFile(file) {
  if (!file || !file.type.startsWith('audio/')) { toast('請選取音訊檔案', 'warning'); return }
  player.load(file)
  toast('音檔已載入：' + file.name, 'success')
}

function setTimestamp(seg) {
  const currentMs = player.getCurrentTimeMs()
  seg.timestamp = currentMs
  toast('已標記：#' + seg.id + ' @ ' + formatTime(currentMs / 1000), 'success', 2000)
}

function jumpTo(ms) {
  if (!player.hasFile.value) { toast('請先上傳音檔', 'warning'); return }
  player.seekTo(ms / 1000)
}

function handleRowClick(seg, event) {
  if (!markMode.value) return
  if (event.target.classList.contains('timestamp-badge') && seg.timestamp != null) return
  if (event.target.classList.contains('sync-row-text') && editMode.value) return
  setTimestamp(seg)
}

async function saveCorrections() {
  if (!iv.value) return
  saving.value = true
  store.showGlobalLoading('儲存修正內容…')
  try {
    await store.saveSegments([...segments.value])
  } finally {
    saving.value = false
    store.hideGlobalLoading()
  }
}
</script>
