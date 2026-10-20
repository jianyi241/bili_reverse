/** 所有后端调用集中在这里，路径与 login-demo/server.js 一一对应 */

const jsonFetch = async (url, opt) => {
  const r = await fetch(url, opt)
  return r.json()
}

export const qrGenerate = () => jsonFetch('/api/qr', { method: 'POST' })

export const qrPoll = (qrcodeKey) =>
  jsonFetch('/api/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ qrcodeKey }),
  })

export const api = {
  ping: () => jsonFetch('/api/ping'),
  me: () => jsonFetch('/api/me'),
  debug: () => jsonFetch('/api/debug'),
  reset: () => jsonFetch('/api/reset', { method: 'POST' }),
  qrGenerate,
  qrPoll,
  search: (keyword, page = 1) => jsonFetch(`/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`),
  popular: (pn = 1) => jsonFetch(`/api/popular?pn=${pn}`),
  ranking: (rid = 0) => jsonFetch(`/api/ranking?rid=${rid}`),
  fav: () => jsonFetch('/api/fav'),
  favItems: (mediaId, pn = 1) => jsonFetch(`/api/fav/items?media_id=${mediaId}&pn=${pn}`),
  img: (u) => `/api/img?u=${encodeURIComponent(u)}`,

  analyze: (bvid, force = false, mode = 'full') =>
    jsonFetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bvid, force, mode }),
    }),
  analyzeStatus: (jobId) => jsonFetch(`/api/analyze/status?jobId=${encodeURIComponent(jobId)}`),

  getConfig: () => jsonFetch('/api/config'),
  saveConfig: (patch) =>
    jsonFetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  smsStart: (phone) =>
    jsonFetch('/api/sms/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    }),
  smsStatus: () => jsonFetch('/api/sms/status'),
  smsGeetest: () => jsonFetch('/api/sms/geetest'),
  smsGeetestClick: (points) =>
    jsonFetch('/api/sms/geetest/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ points }),
    }),
  smsLogin: (code) =>
    jsonFetch('/api/sms/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    }),
  smsReset: () => jsonFetch('/api/sms/reset', { method: 'POST' }),

  video: (bvid) => jsonFetch('/api/video?bvid=' + encodeURIComponent(bvid)),
  videoPrepare: (bvid, q) =>
    jsonFetch('/api/video/prepare?bvid=' + encodeURIComponent(bvid) + '&q=' + (q || 0)),
  audio: (bvid) => jsonFetch('/api/audio?bvid=' + encodeURIComponent(bvid)),
  comments: (bvid, pn = 1) =>
    jsonFetch('/api/comments?bvid=' + encodeURIComponent(bvid) + '&pn=' + pn),
}
