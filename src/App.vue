<template>
  <div class="app-wrapper">
    <!-- Header -->
    <AppHeader />

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Sidebar -->
      <AppSidebar
        @open-project-modal="showProjectModal = true"
        @open-interview-modal="openNewInterview"
      />

      <!-- Right Tab Panel -->
      <main class="right-panel">
        <div class="tab-bar">
          <button
            class="tab-btn"
            :class="{ active: store.activeTab === 'settings' }"
            @click="store.activeTab = 'settings'"
          >
            ⚙️ API 設定
          </button>
          <button
            class="tab-btn"
            :class="{ active: store.activeTab === 'meta' }"
            @click="store.activeTab = 'meta'"
          >
            📋 訪談資訊
          </button>
          <button
            class="tab-btn"
            :class="{ active: store.activeTab === 'prompt' }"
            @click="store.activeTab = 'prompt'"
          >
            ✨ 提示詞產生器
          </button>
          <button
            class="tab-btn"
            :class="{ active: store.activeTab === 'import' }"
            @click="store.activeTab = 'import'"
          >
            📥 導入 JSON
          </button>
          <button
            class="tab-btn"
            :class="{ active: store.activeTab === 'view' }"
            @click="store.activeTab = 'view'"
          >
            💬 對話視覺化
          </button>
          <button
            class="tab-btn"
            :class="{ active: store.activeTab === 'audio' }"
            @click="store.activeTab = 'audio'"
          >
            🎧 音檔比對
          </button>
        </div>

        <!-- Tab Contents -->
        <div class="tab-content" style="display: block;">
          <SettingsTab v-show="store.activeTab === 'settings'" />
          <MetaTab v-show="store.activeTab === 'meta'" />
          <PromptTab v-show="store.activeTab === 'prompt'" />
          <ImportTab v-show="store.activeTab === 'import'" />
          <ChatTab v-show="store.activeTab === 'view'" />
          <AudioTab v-show="store.activeTab === 'audio'" />
        </div>
      </main>
    </div>

    <!-- Modals -->
    <BaseModal
      :visible="showProjectModal"
      title="新增研究專案"
      @close="closeProjectModal"
    >
      <div class="form-group">
        <label class="form-label">專案名稱</label>
        <input
          type="text"
          class="form-input"
          v-model="newProjectName"
          placeholder="例如：2024 教師政策認知研究"
          ref="newProjectInput"
          autofocus
        />
      </div>
      <div class="form-group">
        <label class="form-label">專案說明（選填）</label>
        <textarea
          class="form-textarea"
          v-model="newProjectDesc"
          placeholder="研究背景、目標…"
          style="min-height:80px"
        ></textarea>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" @click="handleCreateProject" :disabled="creatingProject">
          <span v-if="creatingProject" class="btn-spinner"></span>
          建立專案
        </button>
        <button class="btn btn-secondary" @click="closeProjectModal">取消</button>
      </div>
    </BaseModal>

    <BaseModal
      :visible="showInterviewModal"
      title="新增訪談"
      @close="closeInterviewModal"
    >
      <div class="form-group">
        <label class="form-label">場次備註 / 標題</label>
        <input
          type="text"
          class="form-input"
          v-model="newInterviewNote"
          placeholder="例如：第一次深度訪談"
          ref="newInterviewInput"
          autofocus
        />
      </div>
      <div class="form-group">
        <label class="form-label">訪談日期</label>
        <input type="date" class="form-input" v-model="newInterviewDate" />
      </div>
      <div class="btn-group" style="margin-top:8px">
        <button class="btn btn-primary" @click="handleCreateInterview" :disabled="creatingInterview">
          <span v-if="creatingInterview" class="btn-spinner"></span>
          建立訪談
        </button>
        <button class="btn btn-secondary" @click="closeInterviewModal">取消</button>
      </div>
    </BaseModal>

    <!-- Global Layout Overlays -->
    <ToastContainer />
    <ConfirmModal />
    <GlobalLoading />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useAppStore } from './stores/appStore.js'
import { useToast } from './composables/useToast.js'

// Layout Components
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import GlobalLoading from './components/GlobalLoading.vue'
import BaseModal from './components/BaseModal.vue'

// Tab View Components
import SettingsTab from './views/SettingsTab.vue'
import MetaTab from './views/MetaTab.vue'
import PromptTab from './views/PromptTab.vue'
import ImportTab from './views/ImportTab.vue'
import ChatTab from './views/ChatTab.vue'
import AudioTab from './views/AudioTab.vue'

const store = useAppStore()
const { toast } = useToast()

// Modals UI States
const showProjectModal = ref(false)
const showInterviewModal = ref(false)
const newProjectInput = ref(null)
const newInterviewInput = ref(null)

// Forms inputs
const newProjectName = ref('')
const newProjectDesc = ref('')
const creatingProject = ref(false)

const targetProjectIdForInterview = ref(null)
const newInterviewNote = ref('')
const newInterviewDate = ref(new Date().toISOString().split('T')[0])
const creatingInterview = ref(false)

onMounted(() => {
  // Load local demo seed data initially
  store.seedDemoData()
})

function closeProjectModal() {
  showProjectModal.value = false
  newProjectName.value = ''
  newProjectDesc.value = ''
}

async function handleCreateProject() {
  const name = newProjectName.value.trim()
  if (!name) {
    toast('請輸入專案名稱', 'warning')
    return
  }
  creatingProject.value = true
  try {
    await store.saveProject(name, newProjectDesc.value.trim())
    closeProjectModal()
  } catch (e) {
    // handled inside store/useToast
  } finally {
    creatingProject.value = false
  }
}

function openNewInterview(projectId) {
  targetProjectIdForInterview.value = projectId
  newInterviewNote.value = ''
  newInterviewDate.value = new Date().toISOString().split('T')[0]
  showInterviewModal.value = true
  nextTick(() => {
    newInterviewInput.value?.focus()
  })
}

function closeInterviewModal() {
  showInterviewModal.value = false
  newInterviewNote.value = ''
  targetProjectIdForInterview.value = null
}

async function handleCreateInterview() {
  if (!targetProjectIdForInterview.value) return
  creatingInterview.value = true
  try {
    await store.createInterview(
      targetProjectIdForInterview.value,
      newInterviewNote.value.trim(),
      newInterviewDate.value
    )
    closeInterviewModal()
  } catch (e) {
    // handled inside store/useToast
  } finally {
    creatingInterview.value = false
  }
}
</script>
