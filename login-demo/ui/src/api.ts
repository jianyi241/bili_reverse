/**
 * 与 login-demo/server.js 的真实接口对接（同源 /api，dev 由 vite 代理到 18787）
 * 视图层只认识 Video 这个形状，样式不用动。
 */

export type Video = {
  id: number
  bvid: string
  title: string
  cat: string
  tag: string
  time: string
  dur: string
  cover: string
  author: string
  avatar: string
  views: string
  likes: string
  comments: string
  followed?: boolean
  duration?: number
  ownerMid?: number
  desc?: string
  follower?: number
  danmaku?: string
}

export type User = {
  mid: number
  uname: string
  face: string
  level: number
  vip: string
  coins?: number
  fans?: number
  following?: number
  favCount?: number
}

export type Comment = {
  rpid: number
  uname: string
  avatar: string
  content: string
  like: number
  rcount: number
  ctime: number
  location: string
}

export type Track = { from: number; to: number; title: string; artist: string; cover?: string; url?: string }

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  const text = await r.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, message: text.slice(0, 120) } as unknown as T
  }
}

export function fmtNum(n?: number | null): string {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  if (!isFinite(v)) return '—'
  if (v >= 1e8) return (v / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return String(v)
}

export function fmtDur(sec?: number): string {
  const s = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (x: number) => String(x).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`
}

export function fmtAgo(ts?: number): string {
  if (!ts) return ''
  const d = Math.floor(Date.now() / 1000 - ts)
  if (d < 60) return '刚刚'
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} 天前`
  const dt = new Date(ts * 1000)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** bilibili 图片要走本地代理（hdslb 对 127.0.0.1 的 Referer 返回 403） */
export const img = (u?: string) => (u ? '/api/img?u=' + encodeURIComponent(u) : '')

/** 首页列表项 → 视图 Video */
type PopularItem = {
  bvid: string
  title: string
  cover: string
  up: string
  play: number
  duration: number
  pubdate: number
  tname: string
  like: number
  reply: number
  danmaku: number
  owner?: { mid?: number; name?: string; face?: string }
}

function toVideo(it: PopularItem, i: number): Video {
  return {
    id: i + 1,
    bvid: it.bvid,
    title: it.title,
    cat: it.tname || '综合',
    tag: (it.danmaku && it.danmaku > 1000 ? '热门' : '') || '推荐',
    time: fmtAgo(it.pubdate),
    dur: fmtDur(it.duration),
    cover: it.cover,
    author: it.up || it.owner?.name || '',
    avatar: it.owner?.face || '',
    views: fmtNum(it.play),
    likes: fmtNum(it.like),
    comments: fmtNum(it.reply),
    duration: it.duration,
    ownerMid: it.owner?.mid,
    danmaku: fmtNum(it.danmaku),
  }
}

export const api = {
  ping: () => j<{ ok: boolean; loggedIn: boolean }>('/api/ping'),
  me: () => j<{ ok: boolean; user?: User }>('/api/me'),
  user: () => j<{ ok: boolean; user?: User }>('/api/user'),
  reset: () => j<{ ok: boolean }>('/api/reset', { method: 'POST' }),

  qr: () => j<{ ok: boolean; png?: string; qrcodeKey?: string; message?: string }>('/api/qr', { method: 'POST' }),
  poll: (qrcodeKey: string) =>
    j<{ code: number; message?: string }>('/api/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qrcodeKey }),
    }),

  /** 热门榜（固定一期，分页可取更多） */
  async feed(pn = 1): Promise<{ items: Video[]; noMore: boolean }> {
    const r = await j<{ ok: boolean; items?: PopularItem[]; noMore?: boolean }>(`/api/popular?pn=${pn}`)
    return { items: (r.items || []).map(toVideo), noMore: !!r.noMore }
  },

  /** 推荐流「换一批」：每次都不同（/x/web-interface/wbi/index/top/feed/rcmd） */
  async recommend(brush = 1): Promise<Video[]> {
    const r = await j<{ ok: boolean; items?: PopularItem[] }>(`/api/feed/recommend?refresh=${brush}`)
    return (r.items || []).map(toVideo)
  },

  video: (bvid: string) =>
    j<{
      ok: boolean
      video?: {
        bvid: string
        title: string
        pic: string
        desc: string
        duration: number
        pubdate: number
        tname: string
        stat: Record<string, number>
        owner: { mid: number; name: string; face: string; follower: number }
      }
      message?: string
    }>('/api/video?bvid=' + bvid),

  prepare: (bvid: string, q = 80) =>
    j<{ ok: boolean; url?: string; size?: number; duration?: number; quality?: number; ms?: number; message?: string }>(
      `/api/video/prepare?bvid=${bvid}&q=${q}`
    ),
  progress: (bvid: string, q = 80) =>
    j<{ ok: boolean; running: boolean; percent: number; eta?: number; speed?: number; outTime?: number; duration?: number }>(
      `/api/video/progress?bvid=${bvid}&q=${q}`
    ),

  audioUrl: (bvid: string) => `/api/audio/stream?bvid=${bvid}`,
  downloadUrl: (bvid: string, q = 80) => `/api/video/download?bvid=${bvid}&q=${q}`,

  comments: (bvid: string, pn = 1) =>
    j<{ ok: boolean; total: number; replies: Comment[]; code?: number; message?: string }>(
      `/api/comments?bvid=${bvid}&pn=${pn}`
    ),

  analyze: (bvid: string, mode: 'recognize' | 'tracklist' | 'full', force = false) =>
    j<{ ok: boolean; jobId?: string; message?: string }>('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bvid, mode, force }),
    }),

  analyzeStatus: (jobId: string) =>
    j<{
      ok: boolean
      state: string
      stage: string
      log?: string[]
      error?: string
      result?: {
        bvid: string
        duration: number
        tracks?: { from: number; to: number; match: { title: string; artist: string; cover?: string; url?: string } | null }[]
        stems?: Record<string, string>
        bgm?: { match: { title: string; artist: string; cover?: string } | null }
        recognizer?: { windows: number; matchedWindows: number; throttled?: boolean }
      }
    }>('/api/analyze/status?jobId=' + jobId),

  fav: () => j<{ ok: boolean; folders?: { id: number; title: string; count: number; cover?: string }[]; message?: string }>('/api/fav'),
}
