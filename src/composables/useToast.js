// ═══════════════════════════════════════════════════
// QualiStream — Toast Notification Composable
// ═══════════════════════════════════════════════════

import { ref } from 'vue'

const toasts = ref([])

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }

let _idCounter = 0

export function useToast() {
  function toast(msg, type = 'info', dur = 3500) {
    const id = ++_idCounter
    toasts.value.push({ id, msg, type, icon: ICONS[type] || 'ℹ️', removing: false })
    setTimeout(() => {
      const t = toasts.value.find(t => t.id === id)
      if (t) t.removing = true
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
      }, 300)
    }, dur)
  }

  return { toasts, toast }
}
