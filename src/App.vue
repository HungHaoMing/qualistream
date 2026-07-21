<template>
  <div class="app-shell">
    <header class="topbar">
      <div><div class="brand">QualiStream</div><div class="tagline">本機質性訪談工作台</div></div>
      <div class="status"><span class="status-dot"></span>SQLite 本機資料庫</div>
    </header>

    <aside class="sidebar">
      <section>
        <div class="side-title"><span>研究專案</span><button class="icon-btn" @click="showProjectForm = !showProjectForm">＋</button></div>
        <form v-if="showProjectForm" class="compact-form" @submit.prevent="addProject">
          <input v-model="projectName" placeholder="專案名稱" required><button>建立</button>
        </form>
        <button v-for="project in store.projects" :key="project.id" class="nav-item" :class="{active: project.id === store.currentProjectId}" @click="store.selectProject(project.id)">
          <span class="nav-icon">◆</span><span>{{ project.name }}</span>
        </button>
        <div v-if="!store.projects.length" class="empty-small">建立第一個研究專案</div>
      </section>
      <section v-if="store.currentProject">
        <div class="side-title"><span>訪談場次</span><button class="icon-btn" @click="showInterviewForm = !showInterviewForm">＋</button></div>
        <form v-if="showInterviewForm" class="compact-form" @submit.prevent="addInterview">
          <input v-model="interviewTitle" placeholder="訪談標題" required><input v-model="interviewDate" type="date"><button>建立</button>
        </form>
        <button v-for="interview in store.interviews" :key="interview.id" class="nav-item interview-item" :class="{active: interview.id === store.currentInterviewId}" @click="store.selectInterview(interview.id)">
          <span><strong>{{ interview.title }}</strong><small>{{ interview.interview_date || '未設定日期' }} · {{ interview.transcript_status === 'ready' ? '已有逐字稿' : '尚無逐字稿' }}</small></span>
        </button>
      </section>
    </aside>

    <main class="workspace">
      <div v-if="store.error" class="banner error">{{ store.error }} <button @click="store.error = ''">關閉</button></div>
      <div v-if="store.notice" class="banner success">{{ store.notice }}</div>
      <div v-if="!store.currentInterview" class="welcome">
        <div class="welcome-mark">Q</div><h1>從一場訪談開始</h1><p>建立研究專案與訪談場次，接著上傳音檔或匯入逐字稿。</p>
      </div>
      <template v-else>
        <div class="workspace-header">
          <div><div class="eyebrow">{{ store.currentProject?.name }}</div><h1>{{ store.currentInterview.title }}</h1></div>
          <button class="button danger" @click="removeInterview">刪除訪談</button>
          <nav class="tabs">
            <button v-for="tab in tabs" :key="tab.id" :class="{active: store.activeTab === tab.id}" @click="store.activeTab = tab.id">{{ tab.label }}</button>
          </nav>
        </div>

        <section v-if="store.activeTab === 'transcript'" class="content-grid">
          <div class="transcript-column">
            <div class="toolbar">
              <span>{{ store.segments.length }} 個片段</span>
              <div class="toolbar-actions"><label class="button ghost">匯入 JSON<input type="file" accept="application/json,.json" hidden @change="importJsonFile"></label><a class="button ghost" :href="`/api/v1/interviews/${store.currentInterviewId}/export?format=md`" target="_blank">匯出 Markdown</a></div>
            </div>
            <div v-if="!store.segments.length" class="empty-card">尚無逐字稿。請前往「語音辨識」建立逐字稿，或從 JSON 匯入。</div>
            <article v-for="segment in store.segments" :key="segment.id" class="segment-card">
              <div class="segment-meta">
                <span class="timecode">{{ time(segment.start_ms) }} — {{ time(segment.end_ms) }}</span>
                <select v-model="segment.speaker_id">
                  <option :value="null">未知語者</option><option v-for="speaker in store.speakers" :key="speaker.id" :value="speaker.id">{{ speaker.display_name }}</option>
                </select>
                <span class="version">v{{ segment.version }}</span>
              </div>
              <textarea :ref="el => textareas[segment.id] = el" v-model="segment.text" rows="3" @select="captureSelection(segment, $event)" @keyup="captureSelection(segment, $event)"></textarea>
              <div v-if="store.codings[segment.id]?.length" class="coded-preview">
                <span v-for="(run, index) in runs(segment)" :key="index" :class="{marked: run.codings.length, review: run.codings.some(c => c.status === 'needs_review')}" :style="runStyle(run)" :title="run.codings.map(c => c.code.name).join('、')">{{ run.text }}</span>
              </div>
              <div class="segment-actions">
                <input v-model.number="segment.start_ms" type="number" min="0" aria-label="開始毫秒"><input v-model.number="segment.end_ms" type="number" min="0" aria-label="結束毫秒">
                <button class="button primary" @click="store.saveSegment(segment)">儲存校正</button>
                <button class="button" @click="showRevisions(segment)">修訂歷程</button>
                <button class="button" :disabled="selection.segmentId !== segment.id || selection.start <= 0 || selection.start >= Array.from(segment.text).length" @click="splitAtSelection(segment)">從游標拆分</button>
                <button class="button" @click="mergeNext(segment)">合併下一段</button>
                <select v-model="selectedCodeId"><option value="">選擇代碼</option><option v-for="code in store.codes" :key="code.id" :value="code.id">{{ code.name }}</option></select>
                <button class="button" :disabled="selection.segmentId !== segment.id || !selection.text || !selectedCodeId" @click="applyCoding(segment)">編碼選取文字</button>
              </div>
              <div class="coding-list">
                <button v-for="coding in store.codings[segment.id]" :key="coding.id" class="code-chip" :class="{review: coding.status === 'needs_review'}" :style="{borderColor: coding.code.color}" @click="store.deleteCoding(coding)" :title="'點擊移除：' + coding.quoted_text">
                  <span :style="{background: coding.code.color}"></span>{{ coding.code.name }} ·「{{ coding.quoted_text }}」<b v-if="coding.status === 'needs_review'">需確認</b>
                </button>
              </div>
              <div v-if="revisionSegmentId === segment.id" class="revision-panel">
                <div class="revision-title">修訂歷程 <button @click="revisionSegmentId = null">關閉</button></div>
                <div v-if="!revisionRows.length" class="muted">尚無修訂紀錄</div>
                <div v-for="revision in revisionRows" :key="revision.id" class="revision-row"><time>{{ new Date(revision.created_at).toLocaleString('zh-TW') }}</time><span>{{ revision.reason || '人工修改' }}</span><del>{{ revision.previous_text }}</del><strong>{{ revision.new_text }}</strong></div>
              </div>
            </article>
          </div>
          <aside class="detail-panel">
            <h2>語者設定</h2>
            <div v-for="speaker in store.speakers" :key="speaker.id" class="speaker-row">
              <input type="color" v-model="speaker.color" @change="store.updateSpeaker(speaker)"><input v-model="speaker.display_name" @change="store.updateSpeaker(speaker)">
              <select v-model="speaker.role" @change="store.updateSpeaker(speaker)"><option value="unknown">未指定</option><option value="interviewer">訪談者</option><option value="interviewee">受訪者</option></select>
            </div>
            <h2>音檔</h2>
            <audio v-if="store.currentInterview.audio_file_id" controls :src="`/api/v1/audio/${store.currentInterview.audio_file_id}/stream`"></audio>
            <p v-else class="muted">尚未上傳音檔</p>
            <h2>訪談備忘錄</h2>
            <textarea v-model="memoDraft" rows="7" placeholder="研究觀察、待追問事項、分析想法…"></textarea>
            <button class="button primary" @click="store.saveInterviewMemo(memoDraft)">儲存備忘錄</button>
          </aside>
        </section>

        <section v-if="store.activeTab === 'asr'" class="single-panel">
          <div class="panel-heading"><div><span class="eyebrow">INTERVIEWASR</span><h2>語音辨識</h2></div><button class="button" @click="checkAsr">檢查服務</button></div>
          <div v-if="asrHealth" class="banner success">服務正常 · {{ asrHealth.engines?.join(' / ') }}</div>
          <div class="upload-box"><input type="file" accept="audio/*,video/*" @change="uploadSelected"><strong>{{ store.currentInterview.audio_file_id ? '已上傳音檔，可開始辨識' : '選擇訪談音檔' }}</strong><small>音檔只保存在本機資料目錄</small></div>
          <div class="option-grid">
            <label>引擎<select v-model="asrOptions.engine"><option value="breeze">Breeze</option><option value="qwen">Qwen</option><option value="whisper">Whisper</option></select></label>
            <label>模式<select v-model="asrOptions.mode"><option value="quality">高品質</option><option value="fast">快速</option></select></label>
            <label>語者數<input v-model.number="asrOptions.num_speakers" type="number" min="1"></label>
            <label class="wide">術語<textarea v-model="asrOptions.terms" rows="4" placeholder="每行一個詞；校正可寫：舊詞 => 新詞"></textarea></label>
          </div>
          <button class="button primary large" :disabled="!store.currentInterview.audio_file_id" @click="beginAsr">開始辨識</button>
          <div class="jobs">
            <article v-for="job in store.asrJobs" :key="job.id" class="job-card">
              <div><strong>{{ statusLabel(job.status) }}</strong><small>{{ job.stage }} · {{ job.message }}</small></div>
              <div class="progress"><span :style="{width: ((job.progress || 0) * 100) + '%'}"></span></div>
              <button class="button" @click="refreshJob(job)">更新</button><button v-if="job.status === 'completed'" class="button primary" @click="importJob(job)">匯入逐字稿</button>
            </article>
          </div>
        </section>

        <section v-if="store.activeTab === 'codes'" class="single-panel">
          <div class="panel-heading"><div><span class="eyebrow">CODEBOOK</span><h2>編碼本</h2></div></div>
          <form v-if="!store.activeCodebook" class="inline-form" @submit.prevent="createCodebook"><input v-model="codebookName" placeholder="編碼本名稱" required><button class="button primary">建立編碼本</button></form>
          <template v-else>
            <div class="codebook-title"><h3>{{ store.activeCodebook.name }}</h3><span>{{ store.codes.length }} 個代碼</span></div>
            <form class="code-form" @submit.prevent="addCode">
              <input v-model="newCode.name" placeholder="代碼名稱" required><input v-model="newCode.definition" placeholder="操作型定義"><input v-model="newCode.color" type="color"><select v-model="newCode.parent_id"><option :value="null">最上層</option><option v-for="code in store.codes" :key="code.id" :value="code.id">{{ code.name }}</option></select><button class="button primary">新增代碼</button>
            </form>
            <div class="code-grid"><article v-for="code in store.codes" :key="code.id" class="code-card" :style="{borderTopColor: code.color}"><div><strong>{{ code.name }}</strong><small v-if="code.parent_id">子代碼</small></div><p>{{ code.definition || '尚未填寫定義' }}</p></article></div>
          </template>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useAppStore } from './stores/appStore.js'
import { api } from './api/client.js'
import { buildTextRuns, textareaSelection } from './utils/textRanges.js'

const store = useAppStore()
const tabs = [{id:'transcript',label:'逐字稿校正'},{id:'asr',label:'語音辨識'},{id:'codes',label:'編碼本'}]
const showProjectForm = ref(false), showInterviewForm = ref(false)
const projectName = ref(''), interviewTitle = ref(''), interviewDate = ref('')
const codebookName = ref(''), selectedCodeId = ref(''), asrHealth = ref(null)
const memoDraft = ref('')
const revisionSegmentId = ref(null), revisionRows = ref([])
const textareas = reactive({}), selection = reactive({segmentId:null,start:0,end:0,text:''})
const newCode = reactive({name:'',definition:'',color:'#8b5cf6',parent_id:null,sort_order:0})
const asrOptions = reactive({engine:'breeze',mode:'quality',diarization:true,speaker_mode:'fixed',num_speakers:2,min_speakers:2,max_speakers:2,terms:'',traditional:true,make_readable:false,offline:false})

onMounted(() => store.initialize())
watch(() => store.interviewMemo, memo => { memoDraft.value = memo?.content || '' }, { immediate: true })
async function addProject(){ await store.createProject(projectName.value); projectName.value=''; showProjectForm.value=false }
async function addInterview(){ await store.createInterview(interviewTitle.value, interviewDate.value); interviewTitle.value=''; showInterviewForm.value=false }
async function createCodebook(){ await store.createCodebook(codebookName.value); codebookName.value='' }
async function addCode(){ await store.createCode({...newCode}); Object.assign(newCode,{name:'',definition:'',color:'#8b5cf6',parent_id:null,sort_order:0}) }
function captureSelection(segment,event){ const value=textareaSelection(event.target); Object.assign(selection,{segmentId:segment.id,...value}) }
async function applyCoding(segment){ await store.createCoding(segment,{...selection},selectedCodeId.value); Object.assign(selection,{segmentId:null,start:0,end:0,text:''}) }
async function splitAtSelection(segment){ await store.splitSegment(segment,selection.start); Object.assign(selection,{segmentId:null,start:0,end:0,text:''}) }
async function mergeNext(segment){ try{await store.mergeSegment(segment)}catch(error){store.error=error.message} }
async function showRevisions(segment){ revisionRows.value=await store.getRevisions(segment.id); revisionSegmentId.value=segment.id }
async function importJsonFile(event){ const file=event.target.files?.[0]; if(!file)return; try{const payload=JSON.parse(await file.text()); const replace=store.segments.length?window.confirm('目前已有逐字稿，確定封存現有版本並匯入新版本？'):false; if(store.segments.length&&!replace)return; await store.importJson(payload,replace)}catch(error){store.error=error.message||'JSON 格式無效'} finally{event.target.value=''} }
async function removeInterview(){ if(!window.confirm(`確定刪除「${store.currentInterview.title}」及其本機資料？`))return; await store.deleteInterview() }
function runs(segment){ return buildTextRuns(segment.text,store.codings[segment.id]||[]) }
function runStyle(run){ const colors=run.codings.map(c=>c.code.color); return colors.length?{background:colors.length===1?colors[0]+'33':`linear-gradient(${colors.map((c,i)=>`${c}44 ${i/colors.length*100}% ${(i+1)/colors.length*100}%`).join(',')})`}:{} }
function time(ms){ const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60); return [h,m%60,s%60].map(v=>String(v).padStart(2,'0')).join(':') }
async function uploadSelected(event){ const file=event.target.files?.[0]; if(file) await store.uploadAudio(file) }
async function checkAsr(){ asrHealth.value=await api.get('/asr/health') }
async function beginAsr(){ await store.startAsr({...asrOptions}) }
async function refreshJob(job){ await store.syncAsrJob(job) }
async function importJob(job){ const replace=store.segments.length?window.confirm('已有逐字稿。建立新的正式工作副本會取代目前片段，確定繼續？'):false; if(store.segments.length&&!replace)return; await store.importAsr(job,replace); store.activeTab='transcript' }
function statusLabel(status){ return ({queued:'等待中',running:'辨識中',completed:'已完成',failed:'失敗',interrupted:'已中斷',cancelled:'已取消'})[status]||status }
</script>
