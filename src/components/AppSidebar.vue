<template>
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-section-title">研究專案</div>
      <button class="btn btn-primary btn-sm" style="width:100%" @click="$emit('open-project-modal')">
        ＋ 新增專案
      </button>
    </div>
    <div class="project-list">
      <div v-if="!store.projects.length" class="empty-state" style="padding:30px 10px">
        <div class="empty-icon" style="font-size:28px">📁</div>
        <div class="empty-sub" style="font-size:11px">尚無專案，請先建立</div>
      </div>
      <div
        v-for="project in store.projects"
        :key="project.id"
        class="project-item"
        :class="{ open: openProjects[project.id] }"
      >
        <div class="project-header" @click="selectProject(project.id)">
          <div class="project-title">
            <span class="project-toggle">▶</span>
            📁 {{ project.name }}
            <span class="badge badge-muted">{{ store.projectInterviews(project.id).length }}</span>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-icon" title="新增訪談" @click.stop="$emit('open-interview-modal', project.id)">＋</button>
            <button class="btn-icon danger" title="刪除專案" @click.stop="handleDeleteProject(project.id)">🗑</button>
          </div>
        </div>
        <div class="interview-list">
          <div v-if="!store.projectInterviews(project.id).length" style="font-size:11px;color:var(--text-muted);padding:6px 10px">
            尚無訪談紀錄
          </div>
          <div
            v-for="iv in store.projectInterviews(project.id)"
            :key="iv.id"
            class="interview-item"
            :class="{ active: store.currentInterviewId === String(iv.id) }"
            @click="store.selectInterview(iv.id)"
          >
            <div class="interview-item-info">
              <div class="interview-item-note">{{ iv.title || '（無標題）' }}</div>
              <div class="interview-item-date">📅 {{ iv.interview_date || '—' }}</div>
            </div>
            <button class="btn-icon danger" title="刪除" @click.stop="handleDeleteInterview(iv.id)">✕</button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { reactive } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
const openProjects = reactive({})

defineEmits(['open-project-modal', 'open-interview-modal'])

function toggleProject(id) {
  openProjects[id] = !openProjects[id]
}

async function selectProject(id) {
  toggleProject(id)
  if (store.currentProjectId !== id) await store.selectProject(id)
}

function handleDeleteProject(id) {
  store.openConfirmModal(
    '刪除專案',
    '確定要刪除此專案及其下所有訪談資料？此操作無法還原。',
    async () => {
      store.showGlobalLoading('刪除專案中…')
      await store.deleteProject(id)
      store.hideGlobalLoading()
    },
    { icon: '🗑️', okText: '確定刪除' }
  )
}

function handleDeleteInterview(id) {
  store.openConfirmModal(
    '刪除訪談',
    '確定刪除此訪談及所有對話片段？此操作無法還原。',
    async () => {
      store.showGlobalLoading('刪除訪談中…')
      await store.deleteInterview(id)
      store.hideGlobalLoading()
    },
    { icon: '🗑️', okText: '確定刪除' }
  )
}

// Auto-open projects that have the current interview
store.$subscribe(() => {
  if (store.currentInterviewId) {
    const iv = store.currentInterview
    if (iv) openProjects[iv.project_id] = true
  }
})
</script>
