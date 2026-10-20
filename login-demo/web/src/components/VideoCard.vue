<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from '../api.js'
import { useLog } from '../composables/useLog.js'

const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['need-config'])
const { push } = useLog()

const bvid = computed(() => props.item.bvid || '')

/* ---------------- 数据 ---------------- */
const stat = ref(null)      // /api/video 结果
const statErr = ref('')
let io = null

async function loadStat() {
  if (!bvid.value || stat.value) return
  const j = await api.video(bvid.value)
  if (j.ok) stat.value = j.video
  else statErr.value = j.message || '加载失败'
}

onMounted(() => {
  const el = cardEl.value
  if (!el || !('IntersectionObserver' in window)) return loadStat()
  // 只在卡片进入视口时拉详情，避免一次搜索打 20 个请求
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        loadStat()
        io && io.disconnect()
        io = null
      }
    },
    { rootMargin: '200px' }
  )
  io.observe(el)
})
onBeforeUnmount(() => io && io.disconnect())

const cardEl = ref(null)

/* ---------------- 仅播放音频 ---------------- */
const audioSrc = ref('')
const audioLoading = ref(false)
const audioErr = ref('')
const audioMeta = ref('')

async function toggleAudio() {
  if (audioSrc.value) {
    audioSrc.value = ''
    return
  }
  audioLoading.value = true
  audioErr.value = ''
  const j = await api.audio(bvid.value)
  audioLoading.value = false
  if (!j.ok) {
    audioErr.value = j.message || '取音频流失败'
    return
  }
  audioSrc.value = j.stream
  audioMeta.value = `${j.kbps}kbps · ${fmt(j.duration)}`
  videoOpen.value = false // 只留一个在放
  push(`仅播放音频：${bvid.value} → ${j.kbps}kbps m4a`, 'success')
}

/* ---------------- 评论 ---------------- */
const comments = ref([])
const commentsOpen = ref(false)
const commentsLoading = ref(false)
const commentsTotal = ref(0)
const commentsErr = ref('')
const commentPage = ref(1)

async function toggleComments() {
  commentsOpen.value = !commentsOpen.value
  if (commentsOpen.value && !comments.value.length) await loadComments(1)
}

async function loadComments(pn) {
  commentsLoading.value = true
  commentsErr.value = ''
  const j = await api.comments(bvid.value, pn)
  commentsLoading.value = false
  if (!j.ok) {
    commentsErr.value = j.message || `code=${j.code}`
    return
  }
  commentsTotal.value = j.total
  comments.value = pn === 1 ? j.replies : [{ _more: true }, ...comments.value, ...j.replies]
    .filter((x) => !x._more)
  commentPage.value = pn
}

/* ---------------- 视频播放 / 下载 ---------------- */
const videoOpen = ref(false)
const videoSrc = ref('')
const videoLoading = ref(false)
const videoErr = ref('')
const quality = ref(80) // dash id：80=1080P 64=720P 32=480P 16=360P
const QUALITIES = [
  { id: 80, name: '1080P' },
  { id: 64, name: '720P' },
  { id: 32, name: '480P' },
  { id: 16, name: '360P' },
]
const downloadHref = computed(() => `/api/video/download?bvid=${bvid.value}&q=${quality.value}`)

async function toggleVideo() {
  if (videoOpen.value) {
    videoOpen.value = false
    videoSrc.value = ''
    return
  }
  audioSrc.value = '' // 只留一个在放
  videoOpen.value = true
  videoLoading.value = true
  videoErr.value = ''
  const qName = QUALITIES.find((q) => q.id === quality.value)?.name || quality.value
  push(`POST /api/video/prepare bvid=${bvid.value} q=${quality.value}（ffmpeg 合流 ${qName}）`)
  const j = await api.videoPrepare(bvid.value, quality.value)
  videoLoading.value = false
  if (!j.ok) {
    videoErr.value = j.message || '合流失败'
    push('视频准备失败：' + videoErr.value, 'error')
    return
  }
  videoSrc.value = j.url
  push(`准备完成 ${(j.size / 1048576).toFixed(1)}MB · ${fmt(j.duration)} · ${qName}${j.ms ? ' · ' + (j.ms / 1000).toFixed(1) + 's' : ' · 命中缓存'}`, 'success')
}

// 播放中切清晰度 → 重新准备
watch(quality, () => {
  if (videoOpen.value) {
    videoOpen.value = false
    videoSrc.value = ''
    toggleVideo()
  }
})

/* ---------------- 分析（BGM 识别 / 全片扫描 / 分离） ---------------- */
const state = ref('idle')
const stage = ref('')
const lastLine = ref('')
const lastPushed = ref('')
const mode = ref('full')
const result = ref(null)
const errMsg = ref('')

const STAGE_LABEL = {
  queued: '排队中',
  resolve: '解析视频/音频流',
  download: '下载音频',
  separate: '分离人声与伴奏',
  recognize: '识别 BGM',
  done: '完成',
}
const STEM_LABEL = {
  vocals: '人声',
  instrumental: '伴奏 / BGM',
  drums: '鼓',
  bass: '贝斯',
  other: '其他乐器',
  piano: '钢琴',
  guitar: '吉他',
}

async function analyze(m = 'full') {
  if (state.value === 'running' || !bvid.value) return
  const force = state.value === 'done'
  mode.value = m
  state.value = 'running'
  stage.value = 'queued'
  lastLine.value = ''
  lastPushed.value = ''
  result.value = null
  errMsg.value = ''
  push(
    m === 'recognize'
      ? `POST /api/analyze bvid=${bvid.value} mode=recognize（只识别，零成本）`
      : m === 'tracklist'
        ? `POST /api/analyze bvid=${bvid.value} mode=tracklist（全片扫描）`
        : `POST /api/analyze bvid=${bvid.value}${force ? '（force）' : ''}（分离走云端）`
  )
  const j = await api.analyze(bvid.value, force, m)
  if (!j.ok) {
    state.value = 'error'
    errMsg.value = j.message || '启动失败'
    if (/未配置|禁用|设置/.test(errMsg.value)) emit('need-config')
    return
  }
  poll(j.jobId)
}

async function poll(jobId) {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2500))
    const s = await api.analyzeStatus(jobId)
    if (!s.ok) {
      state.value = 'error'
      errMsg.value = '任务丢失'
      return
    }
    stage.value = s.stage
    const line = (s.log || []).slice(-1)[0]
    if (line && line !== lastPushed.value) {
      lastPushed.value = line
      lastLine.value = line.replace(/\r/g, '')
      push(`[${STAGE_LABEL[s.stage] || s.stage}] ${lastLine.value}`, 'info')
    }
    if (s.state === 'done') {
      state.value = 'done'
      result.value = s.result
      const m = s.result && s.result.bgm && s.result.bgm.match
      push(m ? `BGM 命中：${m.title} — ${m.artist}` : '没识别出歌曲', m ? 'success' : 'warn')
      return
    }
    if (s.state === 'error') {
      state.value = 'error'
      errMsg.value = s.error || '未知错误'
      push('识别失败：' + errMsg.value, 'error')
      if (/未配置|禁用|设置/.test(errMsg.value)) emit('need-config')
      return
    }
  }
}

const songOf = (r) => (r && r.match) || null
const stemList = computed(() => {
  const s = (result.value && result.value.stems) || {}
  return Object.keys(s).filter((k) => s[k]).map((k) => ({ kind: k, label: STEM_LABEL[k] || k, url: s[k] }))
})
const trackList = computed(() => ((result.value && result.value.tracks) || []).filter((t) => t && t.match))

/* ---------------- 格式化 ---------------- */
function fmtNum(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}
function fmt(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

const cover = computed(() => (stat.value && stat.value.pic) || props.item.cover || '')
const title = computed(() => (stat.value && stat.value.title) || props.item.title || '')
const upName = computed(() => (stat.value && stat.value.owner && stat.value.owner.name) || props.item.up || '')
const upFace = computed(() => (stat.value && stat.value.owner && stat.value.owner.face) || '')
const follower = computed(() => (stat.value && stat.value.owner && stat.value.owner.follower) || null)
const duration = computed(() => (stat.value && stat.value.duration) || props.item.duration || 0)
const views = computed(() => (stat.value && stat.value.stat && stat.value.stat.view) ?? props.item.play ?? null)
const likes = computed(() => (stat.value && stat.value.stat && stat.value.stat.like) ?? null)
const replyCount = computed(() => (stat.value && stat.value.stat && stat.value.stat.reply) ?? null)
</script>

<template>
  <article
    ref="cardEl"
    class="group flex flex-col overflow-hidden rounded-md border border-stroke bg-bg-3 shadow-sm transition-shadow hover:shadow-"
  >
    <!-- 封面 -->
    <div class="relative aspect-video w-full overflow-hidden bg-bg-0">
      <img
        v-if="cover"
        :src="api.img(cover)"
        referrerpolicy="no-referrer"
        loading="lazy"
        alt=""
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        @error="(e) => (e.target.style.visibility = 'hidden')"
      />
      <span
        v-if="duration"
        class="absolute bottom-1.5 right-1.5 rounded-small bg-black/65 px-1.5 text-mini leading-5 text-white"
        >{{ fmt(duration) }}</span
      >
      <a
        v-if="bvid"
        :href="'https://www.bilibili.com/video/' + bvid"
        target="_blank"
        rel="noreferrer"
        class="absolute inset-0"
        :title="'在 B 站打开 ' + bvid"
      />
    </div>

    <!-- 主体 -->
    <div class="flex flex-1 flex-col gap-2 p-3">
      <h3 class="line-clamp-2 text-lg font-medium leading-snug text-fg-3" :title="title">{{ title }}</h3>

      <!-- UP 主 + 粉丝 -->
      <div class="flex items-center gap-2">
        <img
          v-if="upFace"
          :src="api.img(upFace)"
          referrerpolicy="no-referrer"
          alt=""
          class="h-6 w-6 flex-none rounded-full bg-bg-0 object-cover"
          @error="(e) => (e.target.style.visibility = 'hidden')"
        />
        <span v-else class="grid h-6 w-6 flex-none place-items-center rounded-full bg-bg-1 text-mini text-fg-2">
          {{ (upName || '?').slice(0, 1) }}
        </span>
        <span class="min-w-0 flex-1 truncate text-base text-fg-2">{{ upName || '未知 UP' }}</span>
        <span v-if="follower !== null" class="flex-none text-mini text-fg-1">{{ fmtNum(follower) }} 粉丝</span>
      </div>

      <!-- 数据 -->
      <div class="flex items-center gap-3 text-base text-fg-1">
        <span class="inline-flex items-center gap-1" title="播放量">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M8 5v14l11-7z" />
          </svg>
          <template v-if="views !== null">{{ fmtNum(views) }}</template>
          <span v-else class="inline-block h-2.5 w-8 animate-pulse rounded-small bg-bg-0" />
        </span>
        <span class="inline-flex items-center gap-1" title="点赞">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 3.6 1.7L14 9h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 19H7" />
          </svg>
          <template v-if="likes !== null">{{ fmtNum(likes) }}</template>
          <span v-else class="inline-block h-2.5 w-7 animate-pulse rounded-small bg-bg-0" />
        </span>
        <span class="inline-flex items-center gap-1" title="评论数">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-6.5A8 8 0 0 1 12 4h1a8 8 0 0 1 8 8z" />
          </svg>
          <template v-if="replyCount !== null">{{ fmtNum(replyCount) }}</template>
          <span v-else class="inline-block h-2.5 w-7 animate-pulse rounded-small bg-bg-0" />
        </span>
        <span v-if="statErr" class="ml-auto truncate text-mini text-danger">{{ statErr }}</span>
      </div>

      <!-- 操作 -->
      <div class="mt-auto space-y-1.5 pt-1">
        <!-- 播放 / 下载 / 清晰度 -->
        <div class="flex items-center gap-1.5">
          <button class="btn-soft flex-1 justify-center" :class="{ 'btn-soft-on': videoOpen }" :disabled="!bvid" @click="toggleVideo">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" />
            </svg>
            {{ videoOpen ? '收起视频' : '播放' }}
          </button>
          <a
            v-if="bvid"
            class="btn-soft flex-1 justify-center"
            :href="downloadHref"
            :download="`${(title || bvid).slice(0, 40)}.mp4`"
            title="服务端 ffmpeg 合流成 mp4（视频+音轨）"
            @click="push(`下载：${bvid} @ ${quality}p（合流 mp4）`)"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
            </svg>
            下载
          </a>
          <select
            v-model.number="quality"
            class="h-7 flex-none rounded-small border border-stroke bg-bg-1 px-1 text-mini text-fg-2 outline-none"
            title="清晰度（不支持时自动降到最近一档）"
          >
            <option v-for="q in QUALITIES" :key="q.id" :value="q.id">{{ q.name }}</option>
          </select>
        </div>

        <!-- 音频 / 评论 -->
        <div class="flex items-center gap-1.5">
          <button class="btn-soft flex-1 justify-center" :class="{ 'btn-soft-on': !!audioSrc }" :disabled="!bvid || audioLoading" @click="toggleAudio">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
              <rect x="2.5" y="13" width="4" height="7" rx="2" />
              <rect x="17.5" y="13" width="4" height="7" rx="2" />
            </svg>
            {{ audioSrc ? '收起音频' : audioLoading ? '取流…' : '听音频' }}
          </button>

          <button class="btn-soft flex-1 justify-center" :class="{ 'btn-soft-on': commentsOpen }" :disabled="!bvid" @click="toggleComments">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-6.5A8 8 0 0 1 12 4h1a8 8 0 0 1 8 8z" />
            </svg>
            {{ commentsOpen && commentsTotal ? fmtNum(commentsTotal) : '评论' }}
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <button class="btn-soft flex-1 justify-center" :disabled="state === 'running'" title="不分离，直接扫描原音频识别 BGM" @click="analyze('recognize')">
            识别
          </button>
          <button class="btn-soft flex-1 justify-center" :disabled="state === 'running'" title="扫整片，列出所有曲目" @click="analyze('tracklist')">
            全片
          </button>
          <button class="btn-soft flex-1 justify-center" :disabled="state === 'running'" title="云端分离 4 轨并识别" @click="analyze('full')">
            <svg v-if="state === 'running'" class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.2-8.6" />
            </svg>
            {{ state === 'running' ? '分析中' : state === 'done' ? '重分离' : '分离' }}
          </button>
        </div>
      </div>

      <!-- 视频播放器 -->
      <div v-if="videoOpen" class="rounded-m border border-stroke bg-bg-0 p-2">
        <div v-if="videoLoading" class="flex aspect-video w-full items-center justify-center gap-2 rounded-mini bg-black/80 text-base text-white">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          </svg>
          正在合流音视频…
        </div>
        <video
          v-else-if="videoSrc"
          :src="videoSrc"
          :poster="cover ? api.img(cover) : ''"
          controls
          autoplay
          playsinline
          class="w-full rounded-mini bg-black"
        />
        <div v-else-if="videoErr" class="px-2 py-3 text-base text-danger">{{ videoErr }}</div>
        <div class="mt-1 flex items-center justify-between text-mini text-fg-1">
          <span>ffmpeg 合流后落盘（video+audio），可拖动进度</span>
          <a :href="downloadHref" class="text-info">下载 mp4</a>
        </div>
      </div>

      <!-- 音频播放器 -->
      <div v-if="audioSrc" class="rounded-m border border-stroke bg-bg-0 p-2">
        <audio :src="audioSrc" controls autoplay preload="metadata" class="h-8 w-full" />
        <div class="mt-1 text-mini text-fg-1">仅音频流（{{ audioMeta }}）· 已跳过视频画面</div>
      </div>
      <div v-else-if="audioErr" class="rounded-m border border-danger/30 bg-danger/5 px-2 py-1 text-mini text-danger">
        {{ audioErr }}
      </div>

      <!-- 评论 -->
      <div v-if="commentsOpen" class="rounded-m border border-stroke bg-bg-0">
        <div class="flex items-center justify-between border-b border-stroke px-2.5 py-1.5">
          <span class="text-base font-medium text-fg-2">
            评论 <span class="text-fg-1">{{ fmtNum(commentsTotal) }}</span>
          </span>
          <button class="text-mini text-fg-1 hover:text-fg-3" @click="commentsOpen = false">收起</button>
        </div>
        <div v-if="commentsLoading" class="space-y-2 p-2.5">
          <div v-for="i in 3" :key="i" class="flex gap-2">
            <div class="h-6 w-6 flex-none animate-pulse rounded-full bg-bg-1" />
            <div class="flex-1 space-y-1">
              <div class="h-2.5 w-1/3 animate-pulse rounded-small bg-bg-1" />
              <div class="h-2.5 w-4/5 animate-pulse rounded-small bg-bg-1" />
            </div>
          </div>
        </div>
        <div v-else-if="commentsErr" class="px-2.5 py-2 text-mini text-danger">评论加载失败：{{ commentsErr }}</div>
        <div v-else-if="!comments.length" class="px-2.5 py-3 text-mini text-fg-1">还没有评论，或接口需要登录</div>
        <div v-else class="max-h-[260px] space-y-2 overflow-auto p-2.5">
          <div v-for="c in comments" :key="c.rpid" class="flex gap-2">
            <img
              v-if="c.avatar"
              :src="api.img(c.avatar)"
              referrerpolicy="no-referrer"
              alt=""
              class="h-6 w-6 flex-none rounded-full bg-bg-1 object-cover"
              @error="(e) => (e.target.style.visibility = 'hidden')"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 text-mini text-fg-1">
                <span class="truncate font-medium text-fg-2">{{ c.uname }}</span>
                <span>{{ fmtTime(c.ctime) }}</span>
                <span v-if="c.location" class="truncate">{{ c.location }}</span>
              </div>
              <div class="whitespace-pre-wrap break-words text-base leading-relaxed text-fg-2">{{ c.content }}</div>
              <div class="mt-0.5 flex items-center gap-2 text-mini text-fg-1">
                <span>👍 {{ fmtNum(c.like) }}</span>
                <span v-if="c.rcount">💬 {{ c.rcount }}</span>
              </div>
            </div>
          </div>
          <button
            v-if="comments.length < commentsTotal"
            class="w-full rounded-small border border-stroke py-1 text-mini text-fg-1 hover:bg-bg-1"
            :disabled="commentsLoading"
            @click="loadComments(commentPage + 1)"
          >
            加载更多
          </button>
        </div>
      </div>

      <!-- 分析状态 -->
      <div v-if="state === 'running'" class="rounded-m border border-stroke bg-bg-0 px-2.5 py-2">
        <div class="flex items-center gap-2 text-base text-fg-2">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-5" />
          <span class="font-medium">{{ STAGE_LABEL[stage] || stage }}</span>
        </div>
        <div class="mt-0.5 line-clamp-2 text-mini text-fg-1">{{ lastLine }}</div>
      </div>

      <!-- 分析结果 -->
      <div v-else-if="state === 'done' && result" class="rounded-m border border-stroke bg-bg-0 p-2.5">
        <!-- 曲目表 -->
        <div v-if="trackList.length > 1">
          <div class="mb-1 flex items-center gap-1.5 text-base">
            <span class="font-medium text-fg-2">曲目表</span>
            <span class="rounded-full border border-brand-5/30 bg-brand-5/10 px-1.5 text-mini leading-5 text-brand-5">
              {{ trackList.length }} 首
            </span>
          </div>
          <div
            v-if="result.recognizer.throttled"
            class="mb-1 rounded-small border border-warn/30 bg-warn/5 px-2 py-1 text-mini text-warn"
          >
            被 Shazam 限流，结果不完整；已命中的有缓存，稍后再点会补。
          </div>
          <div class="max-h-[220px] space-y-0.5 overflow-auto">
            <div v-for="(t, i) in trackList" :key="i" class="flex items-center gap-1.5 rounded-small px-1 py-0.5 hover:bg-bg-1">
              <span class="w-[74px] flex-none font-mono text-mini text-fg-1">{{ fmt(t.from) }}</span>
              <img
                v-if="t.match.cover"
                :src="t.match.cover"
                referrerpolicy="no-referrer"
                alt=""
                class="h-5 w-5 flex-none rounded-mini object-cover"
                @error="(e) => (e.target.style.visibility = 'hidden')"
              />
              <span class="min-w-0 flex-1 truncate text-base text-fg-3">{{ t.match.title }}</span>
              <span class="max-w-[90px] truncate text-mini text-fg-1">{{ t.match.artist }}</span>
              <a v-if="t.match.url" :href="t.match.url" target="_blank" rel="noreferrer" class="flex-none text-mini text-info">↗</a>
            </div>
          </div>
        </div>

        <!-- 单曲 -->
        <div v-else class="flex items-start gap-2">
          <img
            v-if="songOf(result.bgm) && songOf(result.bgm).cover"
            :src="songOf(result.bgm).cover"
            referrerpolicy="no-referrer"
            alt=""
            class="h-10 w-10 flex-none rounded-mini object-cover"
            @error="(e) => (e.target.style.visibility = 'hidden')"
          />
          <div class="min-w-0 flex-1">
            <template v-if="songOf(result.bgm)">
              <div class="truncate text-base font-semibold text-fg-3">{{ songOf(result.bgm).title }}</div>
              <div class="truncate text-mini text-fg-2">{{ songOf(result.bgm).artist }}</div>
              <div class="mt-0.5 flex flex-wrap gap-1 text-mini text-fg-1">
                <span v-if="songOf(result.bgm).genre">{{ songOf(result.bgm).genre }}</span>
                <span v-if="songOf(result.bgm).released">· {{ songOf(result.bgm).released }}</span>
                <a v-if="songOf(result.bgm).url" :href="songOf(result.bgm).url" target="_blank" rel="noreferrer" class="text-info">Shazam</a>
              </div>
            </template>
            <div v-else class="text-base text-fg-2">没识别出歌曲（可能是原创配乐）</div>
          </div>
        </div>

        <!-- 分离轨 -->
        <div v-if="stemList.length" class="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div v-for="s in stemList" :key="s.kind">
            <div class="flex items-center justify-between text-mini text-fg-1">
              <span>{{ s.label }}</span>
              <a :href="s.url + '&dl=1'" class="text-info">下载</a>
            </div>
            <audio :src="s.url" controls preload="none" class="h-7 w-full" />
          </div>
        </div>
      </div>

      <div v-else-if="state === 'error'" class="rounded-m border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-mini text-danger">
        {{ errMsg }}
      </div>
    </div>
  </article>
</template>
