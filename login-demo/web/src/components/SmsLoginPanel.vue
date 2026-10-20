<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api } from '../api.js'
import { useLog } from '../composables/useLog.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'success'])

const { push } = useLog()

const phone = ref('')
const code = ref('')
const stage = ref('idle')
const hint = ref('')
const errMsg = ref('')
const busy = ref(false)
const snap = ref(null)

// 极验面板镜像
const gcap = ref(null)          // {png, rect, tip}
const points = ref([])          // 截图坐标系里的点击点
const forwarding = ref(false)
const dispW = ref(360)

let timer = null
let capTimer = null

const STAGE_LABEL = {
  idle: '待开始',
  opening: '正在打开 B 站登录页…',
  geetest: '等待点选验证',
  sent: '验证码已发送',
  logging: '登录中…',
  done: '登录成功',
  error: '出错了',
}

const scale = computed(() => (gcap.value && gcap.value.rect ? dispW.value / gcap.value.rect.width : 1))

async function start() {
  const p = phone.value.trim()
  if (!/^1\d{10}$/.test(p)) {
    errMsg.value = '手机号要 11 位'
    return
  }
  busy.value = true
  errMsg.value = ''
  code.value = ''
  points.value = []
  push('POST /api/sms/start → 打开登录页 + 触发极验')
  const j = await api.smsStart(p)
  busy.value = false
  if (!j.ok) {
    errMsg.value = j.message || '启动失败'
    stage.value = 'error'
    return
  }
  apply(j)
  startPolling()
  if (j.stage === 'geetest') startCapture()
}

function apply(j) {
  if (!j) return
  snap.value = j
  if (j.stage) stage.value = j.stage
  if (j.hint) hint.value = j.hint
  if (j.error) errMsg.value = j.error
  if (j.stage === 'sent' || j.stage === 'done') stopCapture()
}

function startPolling() {
  stopPolling()
  timer = setInterval(async () => {
    const j = await api.smsStatus()
    const before = stage.value
    apply(j)
    if (before !== 'sent' && j.stage === 'sent') push('短信已发送（captcha_key 已抓到）', 'success')
    if (j.stage === 'done') {
      stopPolling()
      stopCapture()
      push('短信登录成功，session.json 已更新', 'success')
      emit('success', j)
    }
  }, 1500)
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = null
}

/* ---------- 极验：截图 → 用户在面板里点 → 坐标转发 ---------- */
async function refreshCapture() {
  const j = await api.smsGeetest()
  if (!j.ok) {
    errMsg.value = j.message || ''
    return
  }
  if (!j.active) {
    gcap.value = null
    return
  }
  gcap.value = j
  dispW.value = Math.min(360, j.rect.width)
}

function startCapture() {
  stopCapture()
  refreshCapture()
  capTimer = setInterval(refreshCapture, 2500)
}

function stopCapture() {
  if (capTimer) clearInterval(capTimer)
  capTimer = null
}

function onImageClick(e) {
  const r = e.target.getBoundingClientRect()
  const x = (e.clientX - r.left) / scale.value
  const y = (e.clientY - r.top) / scale.value
  if (points.value.length >= 8) points.value.shift()
  points.value.push({ x: Math.round(x), y: Math.round(y) })
}

async function submitPoints() {
  if (!points.value.length) {
    errMsg.value = '先在图上点选'
    return
  }
  forwarding.value = true
  errMsg.value = ''
  const pts = points.value.slice()
  push(`POST /api/sms/geetest/click → 转发 ${pts.length} 次点击到真页面（受信任事件）`)
  const j = await api.smsGeetestClick(pts)
  forwarding.value = false
  points.value = []
  if (!j.ok) {
    errMsg.value = j.message || '转发失败'
    return
  }
  push('点击已转发，等待极验校验结果…')
  // 等 2 秒看是否已通过（stage 变 sent）
  await new Promise((r) => setTimeout(r, 2000))
  const s = await api.smsStatus()
  apply(s)
  if (s.stage === 'geetest') {
    refreshCapture()
    errMsg.value = '极验还没通过（可能点错/点少了），看新图再试一次'
  }
}

async function reset() {
  await api.smsReset()
  stage.value = 'idle'
  hint.value = ''
  errMsg.value = ''
  snap.value = null
  gcap.value = null
  points.value = []
  code.value = ''
  stopPolling()
  stopCapture()
}

async function submitCode() {
  if (!/^\d{6}$/.test(code.value.trim())) return
  busy.value = true
  errMsg.value = ''
  push('POST /api/sms/login → 提交 6 位验证码')
  const j = await api.smsLogin(code.value.trim())
  busy.value = false
  apply(j)
  if (j.ok && j.stage === 'done') {
    push('登录成功：session.json 已写入', 'success')
    stopPolling()
    emit('success', j)
  } else if (j.message) {
    errMsg.value = j.message
  }
}

watch(
  () => code.value,
  (v) => {
    if (/^\d{6}$/.test(v.trim())) submitCode()
  }
)

watch(
  () => props.open,
  async (v) => {
    if (!v) {
      stopPolling()
      stopCapture()
      return
    }
    const j = await api.smsStatus()
    apply(j)
    if (j.stage === 'geetest' || j.stage === 'sent') startPolling()
    if (j.stage === 'geetest') startCapture()
  }
)

onBeforeUnmount(() => {
  stopPolling()
  stopCapture()
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="card w-[460px] max-h-[92vh] overflow-auto rounded-xxl p-6">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <div class="text-xxl font-semibold text-fg-4">短信登录</div>
          <div class="text-base text-fg-1">极验点选镜像到本面板，点完坐标转发回真页面</div>
        </div>
        <button class="btn-ghost !h-7 !px-2" @click="$emit('close')">✕</button>
      </div>

      <!-- 手机号 -->
      <label class="mb-1 block text-base text-fg-1">手机号</label>
      <div class="flex gap-2">
        <input v-model="phone" class="field" placeholder="11 位手机号" :disabled="stage === 'geetest' || stage === 'sent'" />
        <button class="btn-primary flex-none" :disabled="busy" @click="start">
          {{ stage === 'idle' ? '发送验证码' : '重新发送' }}
        </button>
      </div>

      <!-- 状态 -->
      <div class="mt-3 rounded-m border border-stroke bg-bg-0 p-3">
        <div class="flex items-center gap-2 text-base">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="{
              'bg-fg-1': stage === 'idle',
              'animate-pulse bg-warn': stage === 'opening' || stage === 'geetest' || stage === 'logging',
              'bg-success': stage === 'sent' || stage === 'done',
              'bg-danger': stage === 'error',
            }"
          />
          <span class="font-medium text-fg-2">{{ STAGE_LABEL[stage] || stage }}</span>
          <span v-if="stage === 'geetest' && gcap" class="text-mini text-fg-1">已点 {{ points.length }} 个</span>
        </div>
        <div v-if="hint" class="mt-1 text-mini text-fg-1">{{ hint }}</div>
        <div v-if="errMsg" class="mt-1 text-mini text-danger">{{ errMsg }}</div>
        <div v-if="snap && snap.geetest" class="mt-2 space-y-0.5 font-mono text-mini text-fg-1">
          <div>token&nbsp;&nbsp;&nbsp;&nbsp;{{ snap.geetest.token }}</div>
          <div>challenge {{ snap.geetest.challenge }}</div>
          <div>validate&nbsp;{{ snap.geetest.validate }}</div>
        </div>
      </div>

      <!-- 极验镜像面板 -->
      <div v-if="stage === 'geetest'" class="mt-3">
        <div class="mb-1 flex items-center justify-between text-base">
          <span class="font-medium text-fg-2">{{ (gcap && gcap.tip) || '请在下图依次点击：' }}</span>
          <button class="btn-ghost !h-7 !px-2 text-mini" @click="refreshCapture">刷新图</button>
        </div>

        <div v-if="gcap" class="relative inline-block overflow-hidden rounded-m border border-stroke bg-white">
          <img
            :src="gcap.png"
            :style="{ width: dispW + 'px', display: 'block', cursor: 'crosshair' }"
            alt="极验点选"
            @click="onImageClick"
          />
          <span
            v-for="(p, i) in points"
            :key="i"
            class="pointer-events-none absolute grid h-5 w-5 place-items-center rounded-full bg-brand-5 text-mini font-semibold text-white shadow"
            :style="{ left: p.x * scale - 10 + 'px', top: p.y * scale - 10 + 'px' }"
            >{{ i + 1 }}</span
          >
        </div>
        <div v-else class="rounded-m border border-stroke bg-bg-0 px-3 py-6 text-center text-base text-fg-1">
          极验面板还没打开（点「重新发送」触发）
        </div>

        <div class="mt-2 flex gap-2">
          <button class="btn-primary flex-1 !h-8" :disabled="forwarding || !points.length" @click="submitPoints">
            {{ forwarding ? '转发中…' : '提交点选' }}
          </button>
          <button class="btn-secondary !h-8" @click="points = []">清空</button>
        </div>
        <div class="mt-1 text-mini text-fg-1">
          图是从真页面实时截的；点完把坐标用 <code class="font-mono">Input.dispatchMouseEvent</code> 转发（isTrusted=true），
          极验自己算 w，所以不需要逆 w。
        </div>
      </div>

      <!-- 验证码 -->
      <template v-if="stage === 'sent'">
        <label class="mb-1 mt-4 block text-base text-fg-1">短信验证码</label>
        <div class="flex gap-2">
          <input
            v-model="code"
            class="field font-mono tracking-[0.4em]"
            placeholder="6 位数字（输满自动提交）"
            maxlength="6"
            inputmode="numeric"
            :disabled="busy"
          />
          <button class="btn-primary flex-none" :disabled="busy" @click="submitCode">登录</button>
        </div>
      </template>

      <div class="mt-4 rounded-m border border-stroke bg-bg-0 p-3 text-mini leading-relaxed text-fg-1">
        <div>· geetest 提交的不是「坐标」，是加密后的 <code class="font-mono">w</code>（AES+轨迹+指纹）；所以坐标必须喂给真页面的极验 JS；</div>
        <div>· 本面板的做法：截图给你点 → 坐标 → 真页面上的受信任鼠标事件 → 极验自己算 w 并提交；</div>
        <div>· 验证码与极验 validate 都是一次性的，失败要重新发送。</div>
      </div>

      <div class="mt-4 flex gap-2">
        <button class="btn-secondary flex-1" @click="$emit('close')">关闭</button>
        <button class="btn-secondary flex-1" @click="reset">重置</button>
      </div>
    </div>
  </div>
</template>
