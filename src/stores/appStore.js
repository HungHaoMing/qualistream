import { defineStore } from 'pinia'
import { api } from '../api/client.js'

export const useAppStore = defineStore('app', {
  state: () => ({
    projects: [], interviews: [], segments: [], speakers: [], codebooks: [], codes: [],
    codings: {}, asrJobs: [], currentProjectId: null, currentInterviewId: null,
    activeTab: 'transcript', loading: false, error: '', notice: '', interviewMemo: null,
  }),
  getters: {
    currentProject: (s) => s.projects.find(p => p.id === s.currentProjectId) || null,
    currentInterview: (s) => s.interviews.find(i => i.id === s.currentInterviewId) || null,
    activeCodebook: (s) => s.codebooks[0] || null,
  },
  actions: {
    async guard(work) {
      this.error = ''
      try { return await work() }
      catch (error) { this.error = error.message || '操作失敗'; throw error }
    },
    async initialize() {
      this.loading = true
      try {
        this.projects = await api.get('/projects')
        if (this.projects.length) await this.selectProject(this.projects[0].id)
      } finally { this.loading = false }
    },
    async createProject(name, description = '') {
      const row = await this.guard(() => api.post('/projects', { name, description }))
      this.projects.unshift(row); await this.selectProject(row.id); return row
    },
    async selectProject(id) {
      this.currentProjectId = id; this.currentInterviewId = null; this.segments = []; this.speakers = []
      const [interviews, codebooks] = await Promise.all([api.get(`/projects/${id}/interviews`), api.get(`/projects/${id}/codebooks`)])
      this.interviews = interviews; this.codebooks = codebooks
      this.codes = this.codebooks.length ? await api.get(`/codebooks/${this.codebooks[0].id}/codes`) : []
      if (interviews.length) await this.selectInterview(interviews[0].id)
    },
    async createInterview(title, interviewDate = null) {
      const row = await this.guard(() => api.post(`/projects/${this.currentProjectId}/interviews`, { title, interview_date: interviewDate || null }))
      this.interviews.unshift(row); await this.selectInterview(row.id); return row
    },
    async deleteInterview() {
      if (!this.currentInterviewId) return
      await api.delete(`/interviews/${this.currentInterviewId}?confirm=true`)
      const projectId = this.currentProjectId
      this.currentInterviewId = null
      await this.selectProject(projectId)
    },
    async selectInterview(id) {
      this.currentInterviewId = id
      const [segments, speakers, jobs] = await Promise.all([
        api.get(`/interviews/${id}/segments`), api.get(`/interviews/${id}/speakers`), api.get(`/interviews/${id}/asr/jobs`),
      ])
      this.segments = segments; this.speakers = speakers; this.asrJobs = jobs; this.codings = {}
      const memos = await api.get(`/memos?interview_id=${id}`)
      this.interviewMemo = memos[0] || null
      await Promise.all(segments.map(segment => this.loadCodings(segment.id)))
    },
    async saveSegment(segment) {
      const updated = await this.guard(() => api.patch(`/segments/${segment.id}`, {
        version: segment.version, text: segment.text, speaker_id: segment.speaker_id,
        start_ms: Number(segment.start_ms), end_ms: Number(segment.end_ms), note: segment.note || '', reason: '人工校正',
      }))
      Object.assign(segment, updated); this.notice = '已儲存至本機資料庫'; return updated
    },
    async getRevisions(segmentId) { return api.get(`/segments/${segmentId}/revisions`) },
    async importJson(payload, replace = false) {
      const result = await api.post(`/interviews/${this.currentInterviewId}/transcript/import-json?replace_confirmed=${replace}`, payload)
      await this.selectInterview(this.currentInterviewId); return result
    },
    async updateSpeaker(speaker) {
      const updated = await api.patch(`/speakers/${speaker.id}`, { display_name: speaker.display_name, role: speaker.role, color: speaker.color })
      Object.assign(speaker, updated)
    },
    async createCodebook(name) {
      const row = await api.post(`/projects/${this.currentProjectId}/codebooks`, { name, description: '' })
      this.codebooks.push(row); this.codes = []; return row
    },
    async createCode(payload) {
      const row = await api.post(`/codebooks/${this.activeCodebook.id}/codes`, payload); this.codes.push(row); return row
    },
    async loadCodings(segmentId) { this.codings[segmentId] = await api.get(`/segments/${segmentId}/codings`) },
    async createCoding(segment, selection, codeId) {
      const row = await api.post(`/segments/${segment.id}/codings`, {
        code_id: codeId, start_offset: selection.start, end_offset: selection.end, quoted_text: selection.text, memo: '',
      })
      this.codings[segment.id] = [...(this.codings[segment.id] || []), row]; return row
    },
    async deleteCoding(coding) {
      await api.delete(`/codings/${coding.id}?confirm=true`)
      this.codings[coding.segment_id] = (this.codings[coding.segment_id] || []).filter(c => c.id !== coding.id)
    },
    async splitSegment(segment, offset) {
      await api.post(`/segments/${segment.id}/split`, { split_offset: offset })
      await this.selectInterview(this.currentInterviewId)
    },
    async mergeSegment(segment) {
      await api.post(`/segments/${segment.id}/merge`, {})
      await this.selectInterview(this.currentInterviewId)
    },
    async saveInterviewMemo(content) {
      if (this.interviewMemo) {
        this.interviewMemo = await api.patch(`/memos/${this.interviewMemo.id}`, { ...this.interviewMemo, content })
      } else {
        this.interviewMemo = await api.post('/memos', { interview_id: this.currentInterviewId, title: '訪談備忘錄', content })
      }
      this.notice = '備忘錄已儲存'
    },
    async uploadAudio(file) {
      const form = new FormData(); form.append('file', file)
      const result = await api.post(`/interviews/${this.currentInterviewId}/audio`, form)
      const interview = await api.get(`/interviews/${this.currentInterviewId}`); Object.assign(this.currentInterview, interview)
      return result
    },
    async startAsr(options) {
      const result = await api.post(`/interviews/${this.currentInterviewId}/asr/jobs`, options)
      await this.refreshAsrJobs(); return result
    },
    async refreshAsrJobs() { this.asrJobs = await api.get(`/interviews/${this.currentInterviewId}/asr/jobs`) },
    async syncAsrJob(job) {
      const updated = await api.get(`/asr/jobs/${job.id}`); Object.assign(job, updated); return updated
    },
    async importAsr(job, replace = false) {
      const result = await api.post(`/asr/jobs/${job.id}/import?replace_confirmed=${replace}`)
      await this.selectInterview(this.currentInterviewId); return result
    },
  },
})
