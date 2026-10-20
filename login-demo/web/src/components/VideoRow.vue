<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { useLog } from '../composables/useLog.js'

const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['need-config'])
const { push } = useLog()

const state = ref('idle') // idle | running | done | error
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

async function analyze(m = 'full') {
  if (state.value === 'running' || !props.item.bvid) return
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
      ? `POST /api/analyze bvid=${props.item.bvid} mode=recognize（只识别，不分离，零成本）`
      : m === 'tracklist'
        ? `POST /api/analyze bvid=${props.item.bvid} mode=tracklist（全片扫描，列出所有曲目）`
        : `POST /api/analyze bvid=${props.item.bvid}${force ? '（force）' : ''}（分离走云端）`
  )
  const j = await api.analyze(props.item.bvid, force, m)
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
      push(m ? `BGM 命中：${m.title} — ${m.artist}` : '两条轨都没识别出歌曲', m ? 'success' : 'warn')
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

const STEM_LABEL = {
  vocals: '人声',
  instrumental: '伴奏 / BGM',
  drums: '鼓',
  bass: '贝斯',
  other: '其他乐器',
  piano: '钢琴',
  guitar: '吉他',
}

/** 把后端返回的 {kind: url} 变成有序数组，方便逐个播放/下载 */
const stemList = computed(() => {
  const s = (result.value && result.value.stems) || {}
  return Object.keys(s)
    .filter((k) => s[k])
    .map((k) => ({ kind: k, label: STEM_LABEL[k] || k, url: s[k] }))
})

/** 全片扫描出来的曲目表 */
const trackList = computed(() => ((result.value && result.value.tracks) || []).filter((t) => t && t.match))
const fmt = (sec) => {
  const s = Math.max(0, Math.round(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="rounded-normal transition-colors hover:bg-bg-1">
    <div class="flex items-start gap-3 px-2 py-2.5">
      <img
        v-if="item.cover"
        :src="api.img(item.cover)"
        referrerpolicy="no-referrer"
        loading="lazy"
        alt=""
        class="h-[63px] w-[112px] flex-none rounded-mini bg-bg-0 object-cover"
        @error="(e) => (e.target.style.visibility = 'hidden')"
      />

      <div class="min-w-0 flex-1">
        <div class="line-clamp-2 text-xl font-medium leading-snug text-fg-3">{{ item.title }}</div>
        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-fg-1">
          <span v-if="item.up" class="truncate">{{ item.up }}</span>
          <span v-if="item.play !== undefined && item.play !== null">▶ {{ item.play }}</span>
          <span v-if="item.meta">{{ item.meta }}</span>
          <a
            v-if="item.bvid"
            :href="'https://www.bilibili.com/video/' + item.bvid"
            target="_blank"
            rel="noreferrer"
            class="font-mono text-info hover:underline"
            >{{ item.bvid }}</a
          >
        </div>
      </div>

      <div class="flex flex-none items-center gap-1">
        <button
          v-if="item.bvid"
          class="btn-ghost !h-7 !px-2 text-base"
          :disabled="state === 'running'"
          title="扫描整片列出所有曲目（几首 BGM 的合集也能拆出来）"
          @click="analyze('tracklist')"
        >
          全片扫描
        </button>
        <button
          v-if="item.bvid"
          class="btn-ghost !h-7 !px-2 text-base"
          :disabled="state === 'running'"
          title="不分离，直接把原音频送 Shazam：零成本、几秒钟"
          @click="analyze('recognize')"
        >
          只识别
        </button>
        <button
          v-if="item.bvid"
          class="btn-ghost !h-7 !px-2 text-base"
          :disabled="state === 'running'"
          :title="state === 'running' ? '正在分析…' : '分离人声/伴奏/BGM 并识别'"
          @click="analyze('full')"
        >
          <svg v-if="state === 'running'" class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          </svg>
          <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" />
          </svg>
          {{ state === 'done' ? '重新分离' : state === 'running' ? '分析中' : '分离+识别' }}
        </button>
      </div>
    </div>

    <!-- 进行中 -->
    <div v-if="state === 'running'" class="mx-2 mb-2 rounded-m border border-stroke bg-bg-0 px-3 py-2">
      <div class="flex items-center gap-2 text-base text-fg-2">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-5" />
        <span class="font-medium">{{ STAGE_LABEL[stage] || stage }}</span>
        <span class="truncate text-fg-1">{{ lastLine }}</span>
      </div>
      <div class="mt-1 text-mini text-fg-1">
        <template v-if="mode === 'tracklist'">扫描整片（12s 窗、10s 步进、并发识别），一般 10–30 秒，零成本。</template>
        <template v-else-if="mode === 'recognize'">扫 5 个采样窗口，几秒钟出结果，零成本。</template>
        <template v-else>首次分离要下载 67MB 模型并跑云端推理；同一视频再次分析会命中缓存。需要 Replicate 额度。</template>
      </div>
    </div>

    <!-- 结果 -->
    <div v-else-if="state === 'done' && result" class="mx-2 mb-2 rounded-m border border-stroke bg-bg-0 p-3">
      <!-- 全片扫描：曲目表 -->
      <div v-if="trackList.length > 1" class="mb-2">
        <div class="mb-1 flex items-center gap-2 text-base">
          <span class="font-medium text-fg-2">曲目表</span>
          <span class="rounded-full border border-brand-5/30 bg-brand-5/10 px-2 text-mini leading-5 text-brand-5">
            共 {{ trackList.length }} 首
          </span>
          <span class="text-mini text-fg-1">扫了 {{ result.recognizer.windows }} 个窗口，命中 {{ result.recognizer.matchedWindows }} 个</span>
        </div>
        <div
          v-if="result.recognizer.throttled"
          class="mb-1 rounded-small border border-warn/30 bg-warn/5 px-2 py-1 text-mini text-warn"
        >
          被 Shazam 免费接口限流，本轮结果不完整（已命中的会缓存）。等 30–60 分钟再点一次，会接着补。
        </div>
        <div class="space-y-0.5">
          <div
            v-for="(t, i) in trackList"
            :key="i"
            class="flex items-center gap-2 rounded-small px-1.5 py-1 hover:bg-bg-1"
          >
            <span class="w-[86px] flex-none font-mono text-mini text-fg-1">{{ fmt(t.from) }}–{{ fmt(t.to) }}</span>
            <img
              v-if="t.match.cover"
              :src="t.match.cover"
              referrerpolicy="no-referrer"
              alt=""
              class="h-6 w-6 flex-none rounded-mini object-cover"
              @error="(e) => (e.target.style.visibility = 'hidden')"
            />
            <span class="min-w-0 flex-1 truncate text-base font-medium text-fg-3">{{ t.match.title }}</span>
            <span class="max-w-[160px] truncate text-mini text-fg-1">{{ t.match.artist }}</span>
            <span v-if="t.appearances > 1" class="flex-none text-mini text-fg-1">×{{ t.appearances }}</span>
            <a
              v-if="t.match.url"
              :href="t.match.url"
              target="_blank"
              rel="noreferrer"
              class="flex-none text-mini text-info hover:underline"
              >Shazam</a
            >
          </div>
        </div>
      </div>

      <div v-else class="flex items-start gap-3">
        <img
          v-if="songOf(result.bgm) && songOf(result.bgm).cover"
          :src="songOf(result.bgm).cover"
          referrerpolicy="no-referrer"
          alt=""
          class="h-14 w-14 flex-none rounded-mini object-cover"
          @error="(e) => (e.target.style.visibility = 'hidden')"
        />
        <div class="min-w-0 flex-1">
          <template v-if="songOf(result.bgm)">
            <div class="text-base text-fg-1">BGM 识别结果</div>
            <div class="truncate text-xxl font-semibold text-fg-3">
              {{ songOf(result.bgm).title }}
              <span class="text-lg font-normal text-fg-2">— {{ songOf(result.bgm).artist }}</span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-1.5 text-mini">
              <span v-if="songOf(result.bgm).genre" class="rounded-full border border-stroke px-2 leading-5 text-fg-2">{{ songOf(result.bgm).genre }}</span>
              <span v-if="songOf(result.bgm).album" class="rounded-full border border-stroke px-2 leading-5 text-fg-2">{{ songOf(result.bgm).album }}</span>
              <span v-if="songOf(result.bgm).released" class="rounded-full border border-stroke px-2 leading-5 text-fg-2">{{ songOf(result.bgm).released }}</span>
              <a
                v-if="songOf(result.bgm).url"
                :href="songOf(result.bgm).url"
                target="_blank"
                rel="noreferrer"
                class="rounded-full border border-brand-5/30 bg-brand-5/10 px-2 leading-5 text-brand-5"
                >Shazam</a
              >
            </div>
          </template>
          <template v-else>
            <div class="text-base text-fg-1">BGM</div>
            <div class="text-xxl font-medium text-fg-2">伴奏轨没识别出歌曲（可能是原创/无版权曲库曲目）</div>
          </template>

          <div v-if="songOf(result.vocal) && (!songOf(result.bgm) || songOf(result.vocal).title !== songOf(result.bgm).title)" class="mt-1 text-base text-fg-1">
            人声轨另识别到：<span class="text-fg-3">{{ songOf(result.vocal).title }} — {{ songOf(result.vocal).artist }}</span>
          </div>
        </div>
      </div>

      <!-- 分离出来的每一轨都可单独试听 / 下载 -->
      <div v-if="stemList.length" class="mt-2">
        <div class="mb-1 flex items-center gap-2 text-mini text-fg-1">
          <span>分离音轨 · {{ stemList.length }} 轨</span>
          <span class="rounded-full border border-stroke bg-bg-1 px-2 leading-5">4-stem 会多出 鼓/贝斯/其他</span>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <div v-for="s in stemList" :key="s.kind">
            <div class="mb-1 flex items-center justify-between text-mini text-fg-1">
              <span>{{ s.label }}</span>
              <a :href="s.url + '&dl=1'" class="text-info hover:underline">下载</a>
            </div>
            <audio :src="s.url" controls preload="none" class="h-8 w-full" />
          </div>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-mini text-fg-1">
        <span class="rounded-full border border-stroke bg-bg-1 px-2 leading-5">
          分离：{{ (result.separator && result.separator.provider) || '—' }} · {{ result.model }}
        </span>
        <span class="rounded-full border border-success/30 bg-success/10 px-2 leading-5 text-success">识别：Shazam 云端</span>
        <span>音频 {{ (result.audio && result.audio.kbps) || '?' }}kbps · 缓存 cache/{{ result.bvid }}</span>
      </div>
    </div>

    <!-- 失败 -->
    <div v-else-if="state === 'error'" class="mx-2 mb-2 rounded-m border border-danger/30 bg-danger/5 px-3 py-2 text-base text-danger">
      识别失败：{{ errMsg }}
    </div>
  </div>
</template>
