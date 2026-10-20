/** 与 login-demo/server.js 的接口封装（同源，dev 由 vite proxy 转发） */

async function jsonFetch(url, opt) {
  const r = await fetch(url, opt)
  const text = await r.text()
  try {
    return JSON.parse(text)
  } catch {
    return { ok: false, message: text.slice(0, 120) }
  }
}

export const api = {
  ping: () => jsonFetch('/api/ping'),
  me: () => jsonFetch('/api/me'),
  popular: (pn = 1) => jsonFetch('/api/popular?pn=' + pn),
  ranking: (rid = 0) => jsonFetch('/api/ranking?rid=' + rid),
  search: (kw) => jsonFetch('/api/search?keyword=' + encodeURIComponent(kw)),
  video: (bvid) => jsonFetch('/api/video?bvid=' + encodeURIComponent(bvid)),
  user: () => jsonFetch('/api/user'),
  fav: () => jsonFetch('/api/fav'),
  favItems: (mediaId, pn = 1) =>
    jsonFetch('/api/fav/items?media_id=' + mediaId + '&pn=' + pn),
  qr: () => jsonFetch('/api/qr', { method: 'POST' }),
  poll: (qrcodeKey) =>
    jsonFetch('/api/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qrcodeKey }),
    }),
  reset: () => jsonFetch('/api/reset', { method: 'POST' }),
  audio: (bvid) => jsonFetch('/api/audio?bvid=' + encodeURIComponent(bvid)),
  audioUrl: (bvid) => `/api/audio/stream?bvid=${bvid}`,
  analyze: (bvid, mode = 'recognize', force = false) =>
    jsonFetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bvid, mode, force }),
    }),
  analyzeStatus: (jobId) => jsonFetch('/api/analyze/status?jobId=' + jobId),
  comments: (bvid, pn = 1) =>
    jsonFetch('/api/comments?bvid=' + encodeURIComponent(bvid) + '&pn=' + pn),
  prepare: (bvid, q = 80) =>
    jsonFetch('/api/video/prepare?bvid=' + encodeURIComponent(bvid) + '&q=' + q),
  progress: (bvid, q = 80) =>
    jsonFetch('/api/video/progress?bvid=' + encodeURIComponent(bvid) + '&q=' + q),
  fileUrl: (bvid, q = 80) => `/api/video/file?bvid=${bvid}&q=${q}`,
  downloadUrl: (bvid, q = 80) => `/api/video/download?bvid=${bvid}&q=${q}`,
  img: (u) => (u ? '/api/img?u=' + encodeURIComponent(u) : ''),
}

/* ---------- 格式化 ---------- */
export function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '—'
  const v = Number(n)
  if (!isFinite(v)) return '—'
  if (v >= 1e8) return (v / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return String(v)
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`
}

export function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
