<template>
  <div class="panel-section">
    <h2 class="section-heading">✨ AI 提示詞產生器</h2>
    <p class="section-sub">填入訪綱與逐字稿片段，系統將自動帶入語者名單，生成可直接貼入 ChatGPT / Claude 的精準提示詞。</p>
    <div class="card">
      <div class="form-group">
        <label class="form-label">📑 訪談綱要（研究主軸與核心問題）</label>
        <textarea class="form-textarea" v-model="guide" placeholder="例如：本研究目的為探討…&#10;訪談問題：&#10;1. 請問您對於…？&#10;2. 在您的經驗中…？" style="min-height:110px"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">📝 原始逐字稿片段（可貼入大段文字）</label>
        <textarea class="form-textarea" v-model="transcript" placeholder="請貼入語音轉文字產出的原始逐字稿…" style="min-height:150px"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">🧑‍🤝‍🧑 本場次語者名單（自動帶入）</label>
        <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;min-height:38px;color:var(--text-secondary);font-size:13px">
          <template v-if="allSpeakers.length">
            <span style="color:#818cf8">🎤 訪談者：</span>{{ ivList.join('、') || '（未填）' }}
            &nbsp;&nbsp;
            <span style="color:#f97316">👥 受訪者：</span>{{ ieList.join('、') || '（未填）' }}
          </template>
          <em v-else style="color:var(--text-muted)">請先選取訪談並填寫成員資訊</em>
        </div>
        <div class="form-hint">訪談者與受訪者均會列入此名單，提供 AI 精準識別說話者。</div>
      </div>
    </div>
    <div class="btn-group" style="margin-bottom:20px">
      <button class="btn btn-primary" @click="generate">⚡ 生成 AI 提示詞</button>
      <button v-if="promptOutput" class="btn btn-secondary" @click="copy">📋 一鍵複製</button>
    </div>
    <div v-if="promptOutput" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:600;font-size:13px;color:var(--text-primary)">🤖 生成的提示詞</div>
        <button class="btn btn-secondary btn-sm" @click="copy">📋 複製</button>
      </div>
      <div class="prompt-output">{{ promptOutput }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'
import { useToast } from '../composables/useToast.js'

const store = useAppStore()
const { toast } = useToast()

const guide = ref('')
const transcript = ref('')
const promptOutput = ref('')

const iv = computed(() => store.currentInterview)
const ivList = computed(() => [...new Set(store.currentSegments.filter(s => s.speaker_role === 'researcher').map(s => s.speaker_name))])
const ieList = computed(() => [...new Set(store.currentSegments.filter(s => s.speaker_role === 'participant').map(s => s.speaker_name))])
const allSpeakers = computed(() => [...ivList.value, ...ieList.value])

function generate() {
  if (!transcript.value.trim()) { toast('請填入原始逐字稿', 'warning'); return }

  const speakerBlock = allSpeakers.value.length
    ? '【本場次語者名單】\n- 訪談者（interviewer）：' + (ivList.value.join('、') || '無') + '\n- 受訪者（interviewee）：' + (ieList.value.join('、') || '無')
    : '【注意】本場次語者名單未填寫，請盡可能從逐字稿內容推斷說話者身份。'

  promptOutput.value =
    '你是一位專業的質性研究助理，精通逐字稿整理與多語者對話分析。\n\n' +
    '===【任務說明】===\n' +
    '請根據以下提供的「訪談綱要」與「原始逐字稿」，執行以下工作：\n' +
    '1. 去除語助詞、贅字與停頓標記，保留完整語意。\n' +
    '2. 潤飾文句，使其通順自然，但不得更改原意。\n' +
    '3. ⚠️【最關鍵任務】精準識別每一句話的說話者，並依據「語者名單」填入正確的 speaker_name。\n' +
    '   - 若說話者明顯是訪談者，speaker 填 "interviewer"，speaker_name 填對應的具體姓名或代號。\n' +
    '   - 若說話者明顯是受訪者，speaker 填 "interviewee"，speaker_name 填對應的具體姓名或代號。\n' +
    '   - 請絕對不要使用「說話者A」、「未知」等模糊稱呼，必須對應到語者名單中的具體人名。\n' +
    '4. 若有搶話、重疊發言、特殊場景等值得記錄的現象，請在 note 欄位標記，否則留空字串。\n\n' +
    speakerBlock + '\n' +
    (guide.value.trim() ? '\n===【訪談綱要（供理解語境）】===\n' + guide.value.trim() + '\n' : '') + '\n' +
    '===【原始逐字稿】===\n' + transcript.value.trim() + '\n\n' +
    '===【嚴格輸出規範】===\n' +
    '- 僅輸出純 JSON 陣列，不得包含任何說明文字、Markdown 代碼塊（```）。\n' +
    '- 每個元素格式如下（id 從 1 開始遞增）：\n' +
    '[\n  {\n    "id": 1,\n    "speaker": "interviewer 或 interviewee",\n    "speaker_name": "必須是語者名單中的具體人名",\n    "text": "整理後的發言內容",\n    "note": "備註或空字串"\n  }\n]\n' +
    '- 請確保 JSON 格式正確，可直接被 JSON.parse() 解析。'

  toast('提示詞已生成！', 'success')
}

function copy() {
  if (!promptOutput.value) return
  navigator.clipboard.writeText(promptOutput.value).then(() => toast('已複製到剪貼簿', 'success'))
}
</script>
