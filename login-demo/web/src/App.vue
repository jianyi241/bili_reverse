<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from './api.js'
import TopBar from './components/TopBar.vue'
import LoginPanel from './components/LoginPanel.vue'
import SmsLoginPanel from './components/SmsLoginPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import VideoCard from './components/VideoCard.vue'
import LogPanel from './components/LogPanel.vue'
import { useLog } from './composables/useLog.js'
import { useTheme } from './composables/useTheme.js'

const { log, push, clear } = useLog()
const { theme, toggle } = useTheme()

const tab = ref('search') // search | fav | popular
const keyword = ref('')
const items = ref([])
const folders = ref([])
const activeFolder = ref(null)
const note = ref('输入番剧/视频名称，或直接粘贴 BV 号')
const loading = ref(false)
const user = ref(null)
const loginOpen = ref(false)
const smsOpen = ref(false)
const logOpen = ref(true)
const settingsOpen = ref(false)

const BV_RE = /^BV[0-9A-Za-z]{10}$/
const isBv = computed(() => BV_RE.test(keyword.value.trim()))

const tabs = [
  { key: 'search', label: '搜索' },
  { key: 'fav', label: '收藏夹' },
  { key: 'popular', label: '热门视频' },
]

function resetList(nextNote) {
  items.value = []
  note.value = nextNote || ''
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) {
    resetList('先输入名称或 BV 号')
    return
  }
  loading.value = true
  resetList(`正在搜索「${kw}」…`)
  push(`GET /api/search?keyword=${kw}` + (BV_RE.test(kw) ? '（BV 号直查 /x/web-interface/view）' : '（WBI 签名 /wbi/search/type）'))
  const j = await api.search(kw)
  loading.value = false
  items.value = j.items || []
  note.value = j.ok
    ? BV_RE.test(kw)
      ? `按 BV 号命中 1 条`
      : `「${kw}」命中约 ${j.numResults ?? '?'} 个视频，本页 ${items.value.length} 条`
    : `搜索失败 code=${j.code} ${j.message || ''}`
  push(`搜索 code=${j.code} 返回 ${items.value.length} 条`, j.ok ? 'success' : 'error')
}

async function loadPopular() {
  loading.value = true
  resetList('正在加载热门…')
  push('GET /api/popular → /x/web-interface/popular')
  const j = await api.popular(1)
  loading.value = false
  items.value = j.items || []
  note.value = j.ok ? `热门 ${items.value.length} 条` : `加载失败 code=${j.code}`
  push(`热门 code=${j.code} 返回 ${items.value.length} 条`, j.ok ? 'success' : 'error')
}

async function loadFav() {
  if (!user.value) {
    resetList('收藏夹需要登录，点右上角「登录」扫码')
    loginOpen.value = true
    return
  }
  loading.value = true
  resetList('正在加载收藏夹…')
  push('GET /api/fav → /x/v3/fav/folder/created/list-all')
  const j = await api.fav()
  if (!j.ok) {
    loading.value = false
    resetList(j.needLogin ? '登录态失效，请重新扫码' : `收藏夹获取失败 code=${j.code}`)
    push('收藏夹失败: ' + (j.message || j.code), 'error')
    return
  }
  folders.value = j.folders || []
  push(`收藏夹 ${folders.value.length} 个`, 'success')
  if (folders.value.length) {
    await openFolder(folders.value[0])
  } else {
    loading.value = false
    resetList('这个账号没有可见的收藏夹')
  }
}

async function openFolder(folder) {
  activeFolder.value = folder.id
  loading.value = true
  resetList(`正在加载「${folder.title}」…`)
  const j = await api.favItems(folder.id, 1)
  loading.value = false
  items.value = (j.items || []).filter(Boolean)
  note.value = j.ok
    ? `「${folder.title}」共 ${folder.count} 个收藏，本页 ${items.value.length} 条${j.hasMore ? '（有更多）' : ''}`
    : `加载失败 code=${j.code}`
  push(`收藏夹「${folder.title}」code=${j.code} ${items.value.length} 条`, j.ok ? 'success' : 'error')
}

function onLoginSuccess() {
  loginOpen.value = false
  api.me().then((j) => {
    if (j.ok) user.value = j.user
  })
  if (tab.value === 'fav') loadFav()
}

/** 短信登录成功：服务端已把 cookie 写进 session.json，这里刷新用户信息 */
function onSmsSuccess() {
  smsOpen.value = false
  api.me().then((j) => {
    if (j.ok) {
      user.value = j.user
      push('短信登录完成，当前账号：' + j.user.uname + ' (mid=' + j.user.mid + ')', 'success')
    } else {
      push('短信登录成功但 nav 复验失败：' + (j.message || j.code), 'error')
    }
  })
  if (tab.value === 'fav') loadFav()
}

async function logout() {
  await api.reset()
  user.value = null
  folders.value = []
  items.value = []
  activeFolder.value = null
  push('已退出：服务端 session.json 已删除', 'warn')
  resetList('已退出登录')
}

watch(tab, (t) => {
  folders.value = []
  activeFolder.value = null
  if (t === 'search') resetList('输入名称或 BV 号后回车')
  if (t === 'popular') loadPopular()
  if (t === 'fav') loadFav()
})

onMounted(async () => {
  const p = await api.ping()
  if (p.loggedIn) {
    const j = await api.me()
    if (j.ok) {
      user.value = j.user
      push('检测到已有会话（session.json）：' + j.user.uname, 'success')
    }
  } else {
    push('未登录：点右上角「登录」扫码，或先搜索/看热门')
  }
  const c = await api.getConfig()
  if (c.ok) {
    push(
      `分析引擎：分离=${c.separator.provider}（${c.separator.ready ? '就绪' : '未配置'}）· 识别=${c.recognizer.provider}（云端）`,
      c.separator.ready ? 'success' : 'warn'
    )
  }
})
</script>

<template>
  <div class="min-h-full">
    <TopBar
      :user="user"
      :theme="theme"
      @toggle-theme="toggle"
      @settings="settingsOpen = true"
      @sms-login="smsOpen = true"
      @login="loginOpen = true"
      @logout="logout"
    />

    <main class="mx-auto max-w-content space-y-3 px-3 py-3 sm:space-y-4 sm:px-6 sm:py-6">
      <!-- 工具条 -->
      <section class="card p-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1 rounded-m bg-bg-1 p-1">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="h-8 rounded-small px-3 text-lg transition-colors"
              :class="tab === t.key ? 'bg-bg-3 font-medium text-fg-3 shadow-sm' : 'text-fg-2 hover:text-fg-3'"
              @click="tab = t.key"
            >
              {{ t.label }}
            </button>
          </div>

          <div v-if="tab === 'search'" class="flex min-w-[240px] flex-1 items-center gap-2">
            <input
              v-model="keyword"
              class="field"
              placeholder="输入视频/番剧名称，或粘贴 BV 号（如 BV1GJ411x7h7）"
              @keydown.enter="doSearch"
            />
            <button class="btn-primary flex-none" :disabled="loading" @click="doSearch">搜索</button>
          </div>

          <div v-else class="flex flex-1 items-center gap-2">
            <span class="text-base text-fg-1">
              {{ tab === 'fav' ? (user ? '收藏夹来自 /x/v3/fav/*' : '需要登录后才能读取收藏夹') : '热门来自 /x/web-interface/popular' }}
            </span>
            <button v-if="tab === 'fav'" class="btn-secondary flex-none" :disabled="loading" @click="loadFav">刷新</button>
            <button v-else class="btn-secondary flex-none" :disabled="loading" @click="loadPopular">刷新</button>
          </div>
        </div>

        <!-- 收藏夹切换 -->
        <div v-if="tab === 'fav' && folders.length" class="mt-3 max-h-[136px] overflow-auto pr-1">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="f in folders"
              :key="f.id"
              class="chip max-w-[220px] truncate"
              :class="{ 'chip-on': activeFolder === f.id }"
              :title="f.title"
              @click="openFolder(f)"
            >
              {{ f.title }} · {{ f.count }}
            </button>
          </div>
        </div>

        <div class="mt-2 flex items-center gap-2 text-base text-fg-1">
          <span>{{ note }}</span>
          <span v-if="isBv && tab === 'search'" class="rounded-full border border-brand-5/30 bg-brand-5/10 px-2 text-mini text-brand-5">
            BV 号
          </span>
        </div>
      </section>

      <!-- 列表：小卡片网格（手机 1 列 / 平板 2 列 / 桌面 3 列） -->
      <section class="card p-3 sm:p-4">
        <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="i in 6" :key="i" class="overflow-hidden rounded-md border border-stroke bg-bg-3">
            <div class="aspect-video w-full animate-pulse bg-bg-0" />
            <div class="space-y-2 p-3">
              <div class="h-3.5 w-4/5 animate-pulse rounded-small bg-bg-0" />
              <div class="h-3 w-1/2 animate-pulse rounded-small bg-bg-0" />
              <div class="h-6 w-2/3 animate-pulse rounded-small bg-bg-0" />
            </div>
          </div>
        </div>

        <template v-else>
          <div v-if="items.length" class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <VideoCard v-for="(it, i) in items" :key="(it.bvid || '') + i" :item="it" @need-config="settingsOpen = true" />
          </div>
          <div v-else class="flex flex-col items-center gap-1 py-16 text-center">
            <div class="text-[24px] font-medium text-fg-2">这里还没有内容</div>
            <div class="text-lg text-fg-1">
              {{ tab === 'search' ? '输入名称或 BV 号开始搜索' : tab === 'fav' ? '登录后可以看到你的收藏夹' : '点击刷新加载热门' }}
            </div>
          </div>
        </template>
      </section>

      <LogPanel :lines="log.lines" :open="logOpen" @toggle="logOpen = !logOpen" @clear="clear" />
    </main>

    <LoginPanel :open="loginOpen" @close="loginOpen = false" @success="onLoginSuccess" />
    <SmsLoginPanel :open="smsOpen" @close="smsOpen = false" @success="onSmsSuccess" />
    <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>
