<template>
  <header class="app-header">
    <div class="brand">
      <div class="brand-icon">🎙️</div>
      <div>
        <div class="brand-name">QualiStream</div>
        <div class="brand-tagline">多語者質性研究訪談視覺化管理系統</div>
      </div>
    </div>
    <div class="header-status">
      <div class="status-dot" :class="store.connectionStatus"></div>
      <span>{{ statusText }}</span>
      <span v-if="store.user">{{ store.user.email }}</span>
      <button class="btn btn-secondary btn-sm" @click="$emit('logout')">登出</button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
defineEmits(['logout'])

const statusText = computed(() => {
  const map = { connected: '已連線', error: '連線失敗', loading: '連線中…', idle: '未連線' }
  return map[store.connectionStatus] || '未連線'
})
</script>
