// ═══════════════════════════════════════════════════
// QualiStream — Pinia Store
// ═══════════════════════════════════════════════════

import { defineStore } from 'pinia'
import { gasGet, gasPost } from '../api/gas.js'
import { useToast } from '../composables/useToast.js'

const IV_COLORS = ['iv-color-0', 'iv-color-1', 'iv-color-2', 'iv-color-3', 'iv-color-4']
const IE_COLORS = ['ie-color-0', 'ie-color-1', 'ie-color-2', 'ie-color-3', 'ie-color-4', 'ie-color-5', 'ie-color-6', 'ie-color-7']
const IV_HEX = ['#6366f1', '#8b5cf6', '#06b6d4', '#0ea5e9', '#14b8a6']
const IE_HEX = ['#f97316', '#ec4899', '#84cc16', '#f43f5e', '#a855f7', '#eab308', '#10b981', '#fb923c']

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function today() { return new Date().toISOString().split('T')[0] }

export { IV_COLORS, IE_COLORS, IV_HEX, IE_HEX }

export const useAppStore = defineStore('app', {
  state: () => ({
    gasUrl: '',
    connectionStatus: 'idle', // 'idle' | 'loading' | 'connected' | 'error'
    projects: [],
    interviews: [],
    segments: [],
    currentInterviewId: null,
    speakerColorMap: {},
    activeTab: 'settings',
    // UI state
    globalLoading: { show: false, message: '' },
    confirmModal: {
      show: false,
      title: '',
      message: '',
      icon: '⚠️',
      okText: '確認刪除',
      btnClass: 'btn-danger',
      onConfirm: null,
    },
  }),

  getters: {
    currentInterview(state) {
      if (!state.currentInterviewId) return null
      return state.interviews.find(i => String(i.id) === String(state.currentInterviewId)) || null
    },
    currentSegments(state) {
      if (!state.currentInterviewId) return []
      return state.segments.filter(s => String(s.interview_id) === String(state.currentInterviewId))
    },
    projectInterviews(state) {
      return (projectId) => state.interviews.filter(i => String(i.project_id) === String(projectId))
    },
  },

  actions: {
    // ── Connection ──
    async testConnection() {
      const url = this.gasUrl.trim()
      if (!url) { useToast().toast('請輸入 GAS URL', 'warning'); return }
      this.gasUrl = url
      this.connectionStatus = 'loading'
      try {
        await gasGet(url, { action: 'getAll' })
        this.connectionStatus = 'connected'
        useToast().toast('已成功連接 GAS 後台！', 'success')
        await this.loadAll()
      } catch (e) {
        this.connectionStatus = 'error'
        useToast().toast('連線失敗：' + e.message, 'error', 5000)
      }
    },

    async loadAll() {
      try {
        this.connectionStatus = 'loading'
        const data = await gasGet(this.gasUrl, { action: 'getAll' })
        this.projects = data.projects || []
        this.interviews = data.interviews || []
        this.segments = data.segments || []
        this.connectionStatus = 'connected'
      } catch (e) {
        this.connectionStatus = 'error'
        useToast().toast('載入失敗：' + e.message, 'error')
      }
    },

    // ── Projects ──
    async saveProject(name, description) {
      const project = { id: uid(), name, description, created_at: new Date().toISOString() }
      try {
        if (this.gasUrl) await gasPost(this.gasUrl, { action: 'saveProject', payload: project })
        this.projects.push(project)
        useToast().toast('專案已建立', 'success')
        return project
      } catch (e) {
        useToast().toast('儲存失敗：' + e.message, 'error')
        throw e
      }
    },

    async deleteProject(id) {
      this.projects = this.projects.filter(p => String(p.id) !== String(id))
      this.interviews = this.interviews.filter(i => String(i.project_id) !== String(id))
      try {
        if (this.gasUrl) await gasPost(this.gasUrl, { action: 'deleteProject', payload: { id } })
      } catch (e) { /* swallow */ }
      useToast().toast('專案已刪除', 'success')
    },

    // ── Interviews ──
    async createInterview(projectId, note, date) {
      const interview = {
        id: uid(), project_id: projectId, date: date || today(),
        note: note || '（無標題）', interviewers: '', interviewees: '',
        created_at: new Date().toISOString(),
      }
      try {
        if (this.gasUrl) await gasPost(this.gasUrl, { action: 'saveInterview', payload: interview })
        this.interviews.push(interview)
        this.selectInterview(interview.id)
        useToast().toast('訪談已建立', 'success')
        return interview
      } catch (e) {
        useToast().toast('建立失敗：' + e.message, 'error')
        throw e
      }
    },

    selectInterview(id) {
      this.currentInterviewId = String(id)
      this.speakerColorMap = {}
      this.buildSpeakerColorMap(this.currentSegments)
    },

    async saveInterview(iv) {
      try {
        if (this.gasUrl) await gasPost(this.gasUrl, { action: 'saveInterview', payload: iv })
        useToast().toast('訪談資訊已儲存', 'success')
      } catch (e) {
        useToast().toast('儲存失敗：' + e.message, 'error')
        throw e
      }
    },

    async deleteInterview(id) {
      const targetId = id || this.currentInterviewId
      if (!targetId) return
      this.interviews = this.interviews.filter(i => String(i.id) !== String(targetId))
      this.segments = this.segments.filter(s => String(s.interview_id) !== String(targetId))
      if (String(this.currentInterviewId) === String(targetId)) {
        this.currentInterviewId = null
      }
      try {
        if (this.gasUrl) await gasPost(this.gasUrl, { action: 'deleteInterview', payload: { id: targetId } })
      } catch (e) { /* swallow */ }
      useToast().toast('訪談已刪除', 'success')
    },

    // ── Segments ──
    async importSegments(data) {
      const iv = this.currentInterview
      if (!iv) return
      const segments = data.map((seg, idx) => ({
        id: String(seg.id !== undefined ? seg.id : idx + 1),
        interview_id: String(iv.id),
        speaker: seg.speaker || 'unknown',
        speaker_name: seg.speaker_name || ('說話者 ' + (idx + 1)),
        text: seg.text || '',
        note: seg.note || '',
        timestamp: seg.timestamp || null,
      }))
      this.segments = this.segments.filter(s => String(s.interview_id) !== String(iv.id))
      this.segments.push(...segments)

      try {
        if (this.gasUrl) {
          await gasPost(this.gasUrl, { action: 'saveSegments', payload: { interview_id: String(iv.id), segments } })
          useToast().toast('已成功同步 ' + segments.length + ' 筆對話到雲端！', 'success')
        } else {
          useToast().toast('已本地匯入 ' + segments.length + ' 筆（未設定 GAS URL）', 'info')
        }
      } catch (e) {
        useToast().toast('同步失敗：' + e.message, 'error', 6000)
        throw e
      }
    },

    async saveSegments(segments) {
      const iv = this.currentInterview
      if (!iv) return
      this.segments = this.segments.filter(s => String(s.interview_id) !== String(iv.id))
      this.segments.push(...segments)

      try {
        if (this.gasUrl) {
          await gasPost(this.gasUrl, { action: 'saveSegments', payload: { interview_id: String(iv.id), segments } })
          useToast().toast('對話內容已同步至 Google Sheets！', 'success')
        } else {
          useToast().toast('已本地儲存（未設定 GAS URL）', 'info')
        }
      } catch (e) {
        useToast().toast('同步失敗：' + e.message, 'error')
        throw e
      }
    },

    // ── Speaker Colors ──
    buildSpeakerColorMap(segments) {
      this.speakerColorMap = {}
      let ivCount = 0, ieCount = 0
      segments.forEach(seg => {
        const name = seg.speaker_name
        if (this.speakerColorMap[name]) return
        if (seg.speaker === 'interviewer') {
          this.speakerColorMap[name] = {
            colorClass: IV_COLORS[ivCount % IV_COLORS.length],
            hex: IV_HEX[ivCount % IV_HEX.length],
            side: 'left', type: 'interviewer',
          }
          ivCount++
        } else {
          this.speakerColorMap[name] = {
            colorClass: IE_COLORS[ieCount % IE_COLORS.length],
            hex: IE_HEX[ieCount % IE_HEX.length],
            side: 'right', type: 'interviewee',
          }
          ieCount++
        }
      })
    },

    // ── UI Helpers ──
    showGlobalLoading(msg) {
      this.globalLoading = { show: true, message: msg || '處理中…' }
    },
    hideGlobalLoading() {
      this.globalLoading = { show: false, message: '' }
    },
    openConfirmModal(title, msg, onConfirm, opts = {}) {
      this.confirmModal = {
        show: true, title, message: msg, onConfirm,
        icon: opts.icon || '⚠️',
        okText: opts.okText || '確認刪除',
        btnClass: opts.btnClass || 'btn-danger',
      }
    },
    closeConfirmModal() {
      this.confirmModal = { ...this.confirmModal, show: false, onConfirm: null }
    },

    // ── Demo Data ──
    seedDemoData() {
      const projId = 'demo_proj_1'
      const ivId = 'demo_iv_1'
      this.projects = [{ id: projId, name: '示範：教師政策認知研究', description: '展示多語者對話視覺化功能', created_at: new Date().toISOString() }]
      this.interviews = [{
        id: ivId, project_id: projId, date: today(),
        note: '焦點小組第一場（示範）',
        interviewers: '研究員A\n研究員B',
        interviewees: '受訪者甲\n受訪者乙\n受訪者丙',
        created_at: new Date().toISOString(),
      }]
      this.segments = [
        { id: '1', interview_id: ivId, speaker: 'interviewer', speaker_name: '研究員A', text: '今天非常感謝三位撥冗參與本次焦點小組，我們主要想探討您對教師評鑑新制的看法。請問甲老師，您對這次的政策有什麼整體感受？', note: '' },
        { id: '2', interview_id: ivId, speaker: 'interviewee', speaker_name: '受訪者甲', text: '我覺得立意是良善的，政府確實應該建立一套教師專業評估機制，但問題在於指標設計是否貼近實務。許多量化指標無法反映一個老師真正的課堂功力。', note: '' },
        { id: '3', interview_id: ivId, speaker: 'interviewee', speaker_name: '受訪者乙', text: '我認同甲老師的觀點，不過我更擔心的是這個評鑑結果會如何被使用。如果只是拿來排名或淘汰，反而會造成教師的焦慮，不利於教學創新。', note: '兩人有短暫搶話，乙略晚開口' },
        { id: '4', interview_id: ivId, speaker: 'interviewer', speaker_name: '研究員B', text: '那請問丙老師，您的學校目前在推行上有遇到什麼具體困難嗎？', note: '' },
        { id: '5', interview_id: ivId, speaker: 'interviewee', speaker_name: '受訪者丙', text: '最大的困難是行政負擔。填寫各種自評表格已經佔據了我大量備課時間，這和原本「促進教學品質」的初衷有點背道而馳。', note: '' },
        { id: '6', interview_id: ivId, speaker: 'interviewee', speaker_name: '受訪者甲', text: '對，丙老師說的很到位。我們學校還有老師反映，觀察評量的時間點選得很不好，有些老師因為知道要被觀察，反而刻意準備。', note: '受訪者甲補充說明，語氣較激動' },
        { id: '7', interview_id: ivId, speaker: 'interviewer', speaker_name: '研究員A', text: '謝謝大家的分享，這些都是非常寶貴的第一線觀察。那如果可以對政策提出一點建議，您最希望修改的核心環節是什麼？', note: '' },
        { id: '8', interview_id: ivId, speaker: 'interviewee', speaker_name: '受訪者乙', text: '我希望能增加教師自主設計指標的空間，讓每個科目、每個教學情境都能有更彈性的評估方式，而不是一套框架套到底。', note: '' },
      ]
      this.currentInterviewId = ivId
    },
  },
})
