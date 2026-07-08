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
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()

const statusText = computed(() => {
  const map = { connected: '已連線', error: '連線失敗', loading: '連線中…', idle: '未連線' }
  return map[store.connectionStatus] || '未連線'
})
</script>
