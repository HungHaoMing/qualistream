// ═══════════════════════════════════════════════════
// QualiStream — Audio Player Composable
// ═══════════════════════════════════════════════════

import { ref, onUnmounted } from 'vue'

export function useAudioPlayer() {
  const audio = ref(null)
  const objectUrl = ref(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const isPlaying = ref(false)
  const fileName = ref('')
  const playbackRate = ref(1)
  const progressPercent = ref(0)
  const hasFile = ref(false)

  function _initAudio() {
    if (audio.value) return
    const el = new Audio()
    el.addEventListener('timeupdate', () => {
      currentTime.value = el.currentTime
      if (el.duration) {
        progressPercent.value = (el.currentTime / el.duration) * 100
      }
    })
    el.addEventListener('loadedmetadata', () => {
      duration.value = el.duration
    })
    el.addEventListener('ended', () => {
      isPlaying.value = false
    })
    el.addEventListener('play', () => { isPlaying.value = true })
    el.addEventListener('pause', () => { isPlaying.value = false })
    audio.value = el
  }

  function load(file) {
    _initAudio()
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = URL.createObjectURL(file)
    audio.value.src = objectUrl.value
    audio.value.load()
    fileName.value = file.name
    hasFile.value = true
  }

  function toggle() {
    if (!audio.value) return
    audio.value.paused ? audio.value.play() : audio.value.pause()
  }

  function seek(delta) {
    if (!audio.value) return
    audio.value.currentTime = Math.max(0, audio.value.currentTime + delta)
  }

  function seekTo(sec) {
    if (!audio.value) return
    audio.value.currentTime = Math.max(0, sec)
    audio.value.play()
  }

  function seekByClick(event) {
    if (!audio.value || !audio.value.duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const pct = (event.clientX - rect.left) / rect.width
    audio.value.currentTime = pct * audio.value.duration
  }

  function setRate(r) {
    if (!audio.value) return
    audio.value.playbackRate = r
    playbackRate.value = r
  }

  function getCurrentTimeMs() {
    return audio.value ? Math.round(audio.value.currentTime * 1000) : 0
  }

  onUnmounted(() => {
    if (audio.value) {
      audio.value.pause()
      audio.value.src = ''
    }
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  })

  return {
    currentTime, duration, isPlaying, fileName, playbackRate,
    progressPercent, hasFile,
    load, toggle, seek, seekTo, seekByClick, setRate, getCurrentTimeMs
  }
}

export function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return m + ':' + s
}
