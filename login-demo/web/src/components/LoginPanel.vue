<script setup>
import { qrGenerate, qrPoll } from '../api.js'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useLog } from '../composables/useLog.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'success'])

const { push } = useLog()

const png = ref('')
const qrKey = ref('')
const status = ref('idle') // idle | wait | scan | done | expired | error
const statusText = ref('待生成')
const left = ref(0)
let poller = null
let ticker = null

function stopTimers() {
  if (poller) clearInterval(poller)
  if (ticker) clearInterval(ticker)
  poller = null
  ticker = null
}

async function start() {
  stopTimers()
  status.value = 'wait'
  statusText.value = '请求二维码…'
  push('POST /api/qr → passport.bilibili.com/x/passport-login/web/qrcode/generate')
  const j = await qrGenerate()
  if (!j.ok) {
    status.value = 'error'
    statusText.value = '生成失败'
    push('generate 失败: ' + JSON.stringify(j.resp || j), 'error')
    return
  }
  png.value = j.png
  qrKey.value = j.qrcodeKey
  status.value = 'wait'
  statusText.value = '未扫码'
  push('qrcode_key = ' + j.qrcodeKey)
  push('有效期 180s，每 2s 轮询 poll')

  const deadline = Date.now() + (j.ttlSeconds || 180) * 1000
  ticker = setInterval(() => {
    left.value = Math.max(0, Math.round((deadline - Date.now()) / 1000))
    if (left.value === 0) {
      stopTimers()
      status.value = 'expired'
      statusText.value = '二维码已失效'
      push('本地倒计时结束，请重新生成', 'error')
    }
  }, 500)
  left.value = j.ttlSeconds || 180

  poller = setInterval(poll, 2000)
  poll()
}

let busy = false
async function poll() {
  if (busy || !qrKey.value) return
  busy = true
  try {
    const j = await qrPoll(qrKey.value)
    if (j.done) {
      stopTimers()
      status.value = 'done'
      if (j.user) {
        statusText.value = '登录成功'
        push('poll data.code = 0 → 登录成功：' + j.user.uname + ' (mid=' + j.user.mid + ')', 'success')
        if (j.extra) push('buvid ' + (j.extra.buvid ? '已补齐' : '未补齐') + ' · bili_ticket ' + (j.extra.ticket ? '已获取' : '未获取'))
        if (j.hasRefreshToken) push('refresh_token 已拿到（可续期）', 'success')
        emit('success', j)
      } else {
        status.value = 'error'
        statusText.value = '扫码成功但复验失败'
        push('nav 复验失败: ' + JSON.stringify(j.nav), 'error')
        push('诊断: GET /api/debug 查看 setCookieNames / jarNames', 'error')
      }
      return
    }
    if (j.pollCode === 86090) {
      status.value = 'scan'
      statusText.value = '已扫码，等待手机确认'
    } else if (j.pollCode === 86101) {
      status.value = 'wait'
      statusText.value = '未扫码'
    } else if (j.pollCode === 86038) {
      stopTimers()
      status.value = 'expired'
      statusText.value = '二维码已失效'
      push('poll data.code = 86038 → 已失效，请重新生成', 'error')
    } else if (!j.ok) {
      status.value = 'error'
      statusText.value = j.message || '异常'
      push('poll 异常: ' + JSON.stringify(j), 'error')
    }
  } finally {
    busy = false
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      left.value = 0
      start()
    } else {
      stopTimers()
    }
  }
)

onBeforeUnmount(stopTimers)

const badgeClass = {
  idle: 'text-fg-1 border-stroke bg-bg-1',
  wait: 'text-warn border-warn/30 bg-warn/10',
  scan: 'text-brand-5 border-brand-5/30 bg-brand-5/10',
  done: 'text-success border-success/30 bg-success/10',
  expired: 'text-danger border-danger/30 bg-danger/10',
  error: 'text-danger border-danger/30 bg-danger/10',
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="card w-[380px] rounded-xxl p-6">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <div class="text-xxl font-semibold text-fg-4">扫码登录</div>
          <div class="text-base text-fg-1">用 B 站 App 扫下方二维码</div>
        </div>
        <button class="btn-ghost !h-7 !px-2" @click="$emit('close')">✕</button>
      </div>

      <div class="grid place-items-center">
        <div class="grid h-[220px] w-[220px] place-items-center overflow-hidden rounded-md border border-stroke bg-white">
          <img v-if="png" :src="png" alt="登录二维码" class="h-full w-full object-contain" />
          <span v-else class="px-6 text-center text-base text-fg-1">正在生成二维码…</span>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-center gap-2">
        <span class="rounded-full border px-2.5 py-0.5 text-base" :class="badgeClass[status]">{{ statusText }}</span>
        <span v-if="left > 0 && status !== 'done'" class="text-base text-fg-1">剩余 {{ left }}s</span>
      </div>

      <div class="mt-5 flex gap-2">
        <button class="btn-secondary flex-1" @click="start">重新生成</button>
        <button class="btn-primary flex-1" @click="$emit('close')">完成</button>
      </div>

      <div class="mt-4 rounded-m border border-stroke bg-bg-0 p-3 text-base leading-relaxed text-fg-1">
        扫码成功后 Cookie 落到本地服务（<code class="font-mono">session.json</code>），页面只显示脱敏值；
        登录日志在下方 Log 面板。
      </div>
    </div>
  </div>
</template>
