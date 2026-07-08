<template>
  <div class="toast-container">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="[t.type, { 'fade-out': t.removing }]"
      :style="t.removing ? 'animation: fadeOut 0.3s ease forwards' : ''"
    >
      <span>{{ t.icon }}</span>
      <span>{{ t.msg }}</span>
    </div>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast.js'
const { toasts } = useToast()
</script>
