<template>
  <Teleport to="body">
    <div v-if="store.globalLoading.show" class="global-loading">
      <div class="global-loading-box">
        <div class="global-loading-spinner"></div>
        <div class="global-loading-msg">{{ store.globalLoading.message }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useAppStore } from '../stores/appStore.js'
const store = useAppStore()
</script>
