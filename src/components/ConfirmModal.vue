<template>
  <Teleport to="body">
    <div v-if="store.confirmModal.show" class="confirm-modal-overlay" @click.self="store.closeConfirmModal()">
      <div class="confirm-modal">
        <div class="confirm-icon">{{ store.confirmModal.icon }}</div>
        <div class="confirm-title">{{ store.confirmModal.title }}</div>
        <div class="confirm-msg">{{ store.confirmModal.message }}</div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" @click="store.closeConfirmModal()">取消</button>
          <button class="btn" :class="store.confirmModal.btnClass" @click="handleConfirm">
            {{ store.confirmModal.okText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()

async function handleConfirm() {
  if (store.confirmModal.onConfirm) {
    await store.confirmModal.onConfirm()
  }
  store.closeConfirmModal()
}
</script>
