/**
 * bilibili 扫码登录 / 主要接口 验证台（本地服务）
 *
 * 为什么必须有这个本地服务：
 *   1) 浏览器直连 passport.bilibili.com 会被 CORS 拦（对方只放行 https://www.bilibili.com）
 *   2) 浏览器禁止 JS 设置 Cookie 头，拿到 SESSDATA 后无法在页面里验证登录态
 *   → 页面 ←(同源)→ 本地服务 ←(带 Cookie/Referer)→ B 站接口
 *
 * 运行：node server.js        默认 http://127.0.0.1:18787（被占用自动 +1）
 * 环境：node >= 22（需要 fetch / Headers.getSetCookie），依赖仅 qrcode
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const env = require('./lib/env');
const cloud = require('./lib/cloud');
const sms = require('./lib/sms');
const QR = require('qrcode');

const PORT = 18787;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const SESSION_FILE = path.join(__dirname, 'session.json');
const DIST = path.join(__dirname, 'web', 'dist');
const CACHE = path.join(__dirname, 'cache');
/** playurl dash 缓存（bvid → {dash, title, duration, at}），5 分钟 */
const dashCache = new Map();
async function getDash(bvid) {
  const hit = dashCache.get(bvid);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return { ok: true, dash: hit.dash, title: hit.title, duration: hit.duration };
  const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  if (v.code !== 0) return { ok: false, code: v.code, message: v.message };
  const pu = await wbiGet('https://api.bilibili.com/x/player/wbi/playurl', {
    bvid, cid: String(v.data.cid), fnval: '4048', fnver: '0', fourk: '1',
  });
  if (pu.code !== 0) return { ok: false, code: pu.code, message: pu.message };
  const dash = pu.data && pu.data.dash;
  if (!dash) return { ok: false, message: '该视频没有 dash 流（可能是番剧/付费内容）' };
  if (dashCache.size > 60) dashCache.delete(dashCache.keys().next().value);
  dashCache.set(bvid, { dash, title: v.data.title, duration: v.data.duration, at: Date.now() });
  return { ok: true, dash, title: v.data.title, duration: v.data.duration };
}

/** 音频直链缓存（bvid → {url, at}），用于「仅播放音频」，30 分钟过期 */
const audioCache = new Map();
/** 视频详情缓存（bvid → {data, at}），列表卡片会集中请求，10 分钟内复用 */
const videoCache = new Map();
/** 图片二进制缓存（url → {buf, type, at}），最多 300 条，避免列表反复拉封面 */
const imgCache = new Map();

/** stem 文件判定：vocals / instrumental / drums / bass / other / piano / guitar */
const STEM_EXT = /\.(wav|flac)$/i;
const STEM_KINDS = ['vocals', 'instrumental', 'drums', 'bass', 'other', 'piano', 'guitar'];
function stemKindOf(file) {
  if (!STEM_EXT.test(file)) return null;
  const s = file.toLowerCase();
  if (/instrumental|no_vocal|accompan/.test(s)) return 'instrumental';
  for (const k of STEM_KINDS) if (s.includes(k)) return k;
  return null;
}

/** 外部工具：Python（audio-separator / shazamio）、ffmpeg 需在 PATH 或以下默认位置 */
const PY =
  process.env.BILI_PY ||
  path.join(process.env.LOCALAPPDATA || 'C:/Users/Public', 'Programs', 'Python', 'Python312', 'python.exe');
const SEP_EXE = path.join(path.dirname(PY), 'Scripts', 'audio-separator.exe');
const FFMPEG = path.join(__dirname, 'bin', 'ffmpeg.exe');
/** 分离模型：默认 UVR MDX-Net 人声模型（onnx，CPU 可跑）；可用 BILI_SEP_MODEL 覆盖 */
const SEP_MODEL = process.env.BILI_SEP_MODEL || 'UVR-MDX-NET-Inst_HQ_3.onnx';

/** 分析任务表（内存；单任务串行，避免 CPU 打满） */
const jobs = new Map();
let analyzeBusy = false;
const analyzeQueue = [];

/** 会话与诊断状态（会话落盘见 saveSession） */
const state = {
  cookies: {},        // name -> value
  refreshToken: '',
  lastPoll: null,     // 最近一次 poll 成功时的取证信息（只有名字，没有值）
  wbiMixin: null,     // WBI mixinKey
  wbiKeys: null,
};

const baseHeaders = (extra = {}) => ({
  'user-agent': UA,
  referer: 'https://www.bilibili.com/',
  origin: 'https://www.bilibili.com',
  accept: 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  ...extra,
});

/* ------------------------------------------------------------------ *
 * HTTP：同时保留 JSON 与 Set-Cookie
 * poll 成功时 Cookie 走 Set-Cookie 头，只解析 data.url 会漏掉 SESSDATA
 * ------------------------------------------------------------------ */
async function bili(url, { method = 'GET', form, cookies, binary = false } = {}) {
  const headers = baseHeaders();
  const jar = cookies || state.cookies;
  const ck = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (ck) headers.cookie = ck;
  const opt = { method, headers };
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    opt.body = new URLSearchParams(form).toString();
  }
  try {
    const res = await fetch(url, opt);
    const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (binary) {
      return { _status: res.status, _buf: Buffer.from(await res.arrayBuffer()), _setCookie: setCookie };
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { code: -1, message: 'non-json', raw: text.slice(0, 200) }; }
    return Object.assign(parsed, { _setCookie: setCookie, _status: res.status });
  } catch (e) {
    return { code: -1, message: 'network: ' + e.message, _setCookie: [] };
  }
}

const LOGIN_KEYS = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'];

/** 老流程：Cookie 在 data.url 的 query 里 */
function cookiesFromUrl(u) {
  const out = {};
  try {
    const url = new URL(u);
    for (const [k, v] of url.searchParams) if (LOGIN_KEYS.includes(k)) out[k] = v;
  } catch { /* ignore */ }
  return out;
}

/** 新流程：Cookie 在 Set-Cookie 头里 */
function cookiesFromSetCookie(list) {
  const out = {};
  for (const line of list || []) {
    const [pair] = String(line).split(';');
    const i = pair.indexOf('=');
    if (i <= 0) continue;
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (name && value) out[name] = value;
  }
  return out;
}

const mask = (v) => (String(v).length <= 8 ? '****' : `${String(v).slice(0, 4)}…${String(v).slice(-4)} (${String(v).length})`);

/* ------------------------------------------------------------------ *
 * WBI 签名：混排表取自线上 bundle laputa-home/assets/index-*.js 的 ky()
 * ------------------------------------------------------------------ */
const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const keyOf = (u) => String(u).slice(String(u).lastIndexOf('/') + 1).split('.')[0];

async function ensureWbi(force = false) {
  if (state.wbiMixin && !force) return;
  const j = await bili('https://api.bilibili.com/x/web-interface/nav');
  const img = keyOf(j.data.wbi_img.img_url);
  const sub = keyOf(j.data.wbi_img.sub_url);
  const raw = img + sub;
  state.wbiMixin = MIXIN_TAB.map((i) => raw[i]).join('').slice(0, 32);
  state.wbiKeys = { img, sub };
}

function wbiSign(params) {
  const withTs = { ...params, wts: Math.floor(Date.now() / 1000) };
  const query = Object.keys(withTs).sort().map((k) => {
    const v = String(withTs[k]).replace(/[!'()*]/g, '');
    return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  }).join('&');
  return `${query}&w_rid=${md5(query + state.wbiMixin)}`;
}

/** 带 WBI 的 GET；-403/-352 时刷新一次 key 重试 */
async function wbiGet(base, params) {
  await ensureWbi();
  let j = await bili(`${base}?${wbiSign(params)}`);
  if (j.code === -403) {
    await ensureWbi(true);
    j = await bili(`${base}?${wbiSign(params)}`);
  }
  return j;
}

const fixCover = (u) => {
  if (!u) return '';
  let s = String(u);
  if (s.startsWith('//')) s = 'https:' + s;
  if (s.startsWith('http://')) s = 'https://' + s.slice(7);
  return s;
};
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');

/* ------------------------------------------------------------------ *
 * 会话持久化：重启不用再扫码；/api/reset 会删除
 * ------------------------------------------------------------------ */
function saveSession() {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({
      savedAt: new Date().toISOString(),
      cookies: state.cookies,
      refreshToken: state.refreshToken,
    }, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('[session] save failed:', e.message);
  }
}

function loadSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return;
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    state.cookies = s.cookies || {};
    state.refreshToken = s.refreshToken || '';
    if (state.cookies.SESSDATA) console.log('[session] 已从 session.json 恢复登录态，保存于 ' + s.savedAt);
  } catch (e) {
    console.error('[session] load failed:', e.message);
  }
}

/* ------------------------------------------------------------------ *
 * 指纹 / 会话 / 用户
 * ------------------------------------------------------------------ */
async function ensureBuvid() {
  if (state.cookies.buvid3 && state.cookies.buvid4) return true;
  const spi = await bili('https://api.bilibili.com/x/frontend/finger/spi');
  if (spi.code === 0 && spi.data) {
    state.cookies.buvid3 = spi.data.b_3;
    state.cookies.buvid4 = spi.data.b_4;
    return true;
  }
  return false;
}

async function enrichSession() {
  const buvid = await ensureBuvid();
  const ts = Math.floor(Date.now() / 1000);
  const hexsign = crypto.createHmac('sha256', 'XgwSnGZ1p').update('ts' + ts).digest('hex');
  const ticket = await bili(
    `https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=${hexsign}&context[ts]=${ts}&csrf=${state.cookies.bili_jct || ''}`,
    { method: 'POST' }
  );
  if (ticket.code === 0 && ticket.data) {
    state.cookies.bili_ticket = ticket.data.ticket;
    state.cookies.bili_ticket_expires = String(ts + 259200);
  }
  return { buvid, ticket: ticket.code === 0 };
}

async function fetchUser() {
  const j = await bili('https://api.bilibili.com/x/web-interface/nav');
  if (j.code !== 0) return { ok: false, code: j.code, message: j.message };
  const d = j.data;
  return {
    ok: true,
    user: {
      uname: d.uname,
      mid: d.mid,
      face: fixCover(d.face),
      level: d.level_info && d.level_info.current_level,
      vip: d.vipStatus === 1 ? (d.vip_label && d.vip_label.text) || '大会员' : '普通用户',
      coins: d.money,
      sign: d.sign,
      isLogin: d.isLogin,
    },
  };
}

const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
};

/* ------------------------------------------------------------------ *
 * 视频 BGM 识别流水线
 *   playurl 拿音频 → 下载 m4s → audio-separator 分离(人声/伴奏)
 *   → shazamio 识别伴奏(BGM) + 人声(原曲/翻唱) → 返回结构化结果
 * ------------------------------------------------------------------ */
function run(cmd, args, { onLine, timeoutMs = 240000 } = {}) {
  return new Promise((resolve) => {
    // 把自带的 ffmpeg/ffprobe 目录塞进 PATH；Python 强制 UTF-8，否则中文曲名会乱码
    const env = {
      ...process.env,
      PATH: path.join(__dirname, 'bin') + ';' + (process.env.PATH || ''),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };
    let cp;
    try {
      cp = spawn(cmd, args, { windowsHide: true, env });
    } catch (e) {
      return resolve({ code: -1, out: '', err: String(e && e.message) });
    }
    let out = '';
    let err = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { cp.kill('SIGKILL'); } catch { /* ignore */ }
    }, timeoutMs);
    const feed = (buf, isErr) => {
      const s = buf.toString('utf8');
      if (isErr) err += s;
      else out += s;
      if (onLine) s.split(/\r?\n/).filter(Boolean).forEach((l) => onLine(l.trim(), isErr));
    };
    cp.stdout.on('data', (b) => feed(b, false));
    cp.stderr.on('data', (b) => feed(b, true));
    cp.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: err + '\n' + e.message, timedOut });
    });
    cp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? -9 : code, out, err, timedOut });
    });
  });
}

function pickAudio(dash) {
  const list = ((dash && dash.audio) || []).filter((a) => a && (a.baseUrl || a.base_url));
  list.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
  return list[0] || null;
}

/** bilibili dash 清晰度 id → 名称 */
const QUALITY_NAME = {
  127: '8K', 126: '杜比视界', 125: 'HDR', 120: '4K', 116: '1080P60',
  112: '1080P+', 80: '1080P', 74: '720P60', 64: '720P', 32: '480P', 16: '360P',
};

/**
 * 选视频流：优先 H.264(avc1)，因为 <video> 兼容性最好；没有再退回当前编码
 * @param {number|string} q 目标清晰度 id，0/空 = 最高
 */
function pickVideo(dash, q) {
  const list = ((dash && dash.video) || []).filter((v) => v && (v.baseUrl || v.base_url));
  if (!list.length) return null;
  const want = Number(q) || 0;
  let pool = list;
  if (want) {
    const exact = list.filter((v) => v.id === want);
    if (exact.length) {
      pool = exact;
    } else {
      // 没有该档就取「不高于它」的最高档，再不行取最低档
      const lower = list.filter((v) => v.id <= want).sort((a, b) => b.id - a.id);
      pool = lower.length ? lower.filter((v) => v.id === lower[0].id) : list.filter((v) => v.id === Math.min(...list.map((x) => x.id)));
    }
  }
  const avc = pool.filter((v) => v.codecid === 7 || /^avc/.test(v.codecs || ''));
  const base = avc.length ? avc : pool;
  base.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
  return base[0];
}

/** dash 里可选的清晰度列表（同一 id 只留一条，优先 avc） */
function listQualities(dash) {
  const seen = new Map();
  for (const v of ((dash && dash.video) || [])) {
    if (!v || !(v.baseUrl || v.base_url)) continue;
    const cur = seen.get(v.id);
    const isAvc = v.codecid === 7 || /^avc/.test(v.codecs || '');
    if (!cur || (isAvc && !cur.avc) || ((isAvc === cur.avc) && (v.bandwidth || 0) > cur.bandwidth)) {
      seen.set(v.id, { id: v.id, name: QUALITY_NAME[v.id] || String(v.id), bandwidth: v.bandwidth || 0, avc: isAvc, width: v.width, height: v.height });
    }
  }
  return [...seen.values()].sort((a, b) => b.id - a.id);
}

/** 合流产物目录：cache/dl */
const DL_DIR = path.join(CACHE, 'dl');
if (!fs.existsSync(DL_DIR)) fs.mkdirSync(DL_DIR, { recursive: true });
/** 正在合流中的任务，避免同一视频并发跑多次 ffmpeg */
const muxJobs = new Map();
/** 合流进度（key = bvid|q → {percent, outTime, duration, speed, at}） */
const muxProgress = new Map();

/**
 * 跑 ffmpeg 并把 `-progress pipe:1` 的 out_time 解析成百分比
 * @param {string[]} args ffmpeg 参数（调用方已带 -progress pipe:1 -nostats）
 */
function runMux(args, duration, progressKey) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: path.join(__dirname, 'bin') + ';' + (process.env.PATH || '') };
    const cp = spawn(FFMPEG, args, { windowsHide: true, env });
    let errBuf = '';
    let outBuf = '';
    let speed = 1;
    const timer = setTimeout(() => {
      try { cp.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error('合流超时'));
    }, 15 * 60 * 1000);

    cp.stdout.on('data', (b) => {
      outBuf += b.toString('utf8');
      const lines = outBuf.split('\n');
      outBuf = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        const mt = /^out_time=(\d+):(\d+):([\d.]+)/.exec(line);
        if (mt) {
          const sec = Number(mt[1]) * 3600 + Number(mt[2]) * 60 + parseFloat(mt[3]);
          const percent = duration ? Math.min(99, Math.max(0, Math.round((sec / duration) * 100))) : 0;
          muxProgress.set(progressKey, {
            percent, outTime: sec, duration, speed, at: Date.now(), done: false,
          });
        }
        const ms = /^speed=\s*([\d.]+)x/.exec(line);
        if (ms) {
          const cur = parseFloat(ms[1]) || 1;
          // 指数平滑：前几秒 ffmpeg 的 speed 抖动大，eta 会乱跳
          speed = speed ? speed * 0.7 + cur * 0.3 : cur;
        }
      }
    });
    cp.stderr.on('data', (b) => { errBuf += b.toString('utf8'); });
    cp.on('error', (e) => { clearTimeout(timer); reject(e); });
    cp.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('合流失败：' + (errBuf || '').trim().split(/\r?\n/).pop()));
    });
  });
}

/**
 * 把 video+audio 合流成完整 mp4 落到 cache/dl（同一 bvid+q 复用 30 分钟）
 * 落盘而不是 pipe：fragmented mp4 浏览器拿不到 duration，进度条/拖动都会失效
 */
async function ensureVideoFile(bvid, q) {
  const meta = await getDash(bvid);
  if (!meta.ok) throw new Error(meta.message || '取播放地址失败');
  const v = pickVideo(meta.dash, q);
  const a = pickAudio(meta.dash);
  if (!v) throw new Error('没有可用视频流');
  const name = String(meta.title || bvid).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 80);
  const file = path.join(DL_DIR, `${bvid}-${v.id}-${a ? a.id : 'na'}.mp4`);
  const progressKey = `${bvid}|${q || 0}`;

  if (fs.existsSync(file)) {
    const st = fs.statSync(file);
    if (st.size > 1024 && Date.now() - st.mtimeMs < 30 * 60 * 1000) {
      return { file, name, size: st.size, duration: meta.duration, quality: v.id, ms: 0 };
    }
  }
  const key = path.basename(file);
  if (muxJobs.has(key)) return muxJobs.get(key);

  const job = (async () => {
    const t0 = Date.now();
    const hdr = 'Referer: https://www.bilibili.com/\r\nUser-Agent: ' + UA + '\r\n';
    const tmp = file + '.part';
    const args = [
      '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', '-y',
      '-headers', hdr, '-i', v.baseUrl || v.base_url,
    ];
    if (a) args.push('-headers', hdr, '-i', a.baseUrl || a.base_url);
    args.push('-c', 'copy');
    if (a) args.push('-map', '0:v:0', '-map', '1:a:0');
    args.push('-movflags', '+faststart', '-f', 'mp4', tmp);

    muxProgress.set(progressKey, { percent: 0, outTime: 0, duration: meta.duration, speed: 1, at: Date.now(), done: false });
    await runMux(args, meta.duration || 0, progressKey);
    if (!fs.existsSync(tmp)) throw new Error('合流失败：输出文件不存在');
    fs.renameSync(tmp, file);
    const st = fs.statSync(file);
    muxProgress.set(progressKey, {
      percent: 100, outTime: meta.duration || 0, duration: meta.duration || 0, speed: 1, at: Date.now(), done: true,
    });
    console.log(`[mux] ${bvid} q=${v.id} ${(st.size / 1048576).toFixed(1)}MB ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { file, name, size: st.size, duration: meta.duration, quality: v.id, ms: Date.now() - t0 };
  })();

  muxJobs.set(key, job);
  try {
    return await job;
  } finally {
    muxJobs.delete(key);
  }
}

async function downloadBinary(urls, dest) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  let lastErr = null;
  for (const url of list) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', origin: 'https://www.bilibili.com' },
      });
      if (!res.ok) {
        lastErr = new Error('音频下载失败 HTTP ' + res.status);
        continue; // 换备用 CDN 节点重试
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('音频下载失败');
}

function startAnalyze(bvid, { force = false, mode = 'full' } = {}) {
  const id = 'job_' + crypto.randomBytes(4).toString('hex');
  const job = {
    id,
    bvid,
    force,
    mode,
    state: 'queued',
    stage: 'queued',
    log: ['任务已入队：' + bvid + (force ? '（忽略缓存）' : '')],
    result: null,
    error: null,
    startedAt: Date.now(),
    title: '',
  };
  jobs.set(id, job);
  analyzeQueue.push(job);
  pumpAnalyze();
  return job;
}

async function pumpAnalyze() {
  if (analyzeBusy) return;
  const job = analyzeQueue.shift();
  if (!job) return;
  analyzeBusy = true;
  // 看门狗：任何任务超过 15 分钟直接判失败并放锁，避免队列被一个卡死的子进程拖死
  const watchdog = setTimeout(() => {
    if (analyzeBusy) {
      job.state = 'error';
      job.error = '任务超时（15 分钟），已强制结束';
      analyzeBusy = false;
      pumpAnalyze();
    }
  }, 15 * 60 * 1000);
  job.state = 'running';
  try {
    await analyzePipeline(job);
    job.state = 'done';
    job.stage = 'done';
  } catch (e) {
    job.state = 'error';
    job.error = String((e && e.message) || e);
    job.log.push('失败：' + job.error);
  } finally {
    clearTimeout(watchdog);
    analyzeBusy = false;
    setTimeout(pumpAnalyze, 50);
  }
}

async function analyzePipeline(job) {
  const { bvid } = job;
  const say = (m) => {
    job.log.push(m);
    if (job.log.length > 200) job.log.splice(0, job.log.length - 200);
  };

  // 1) 视频信息 + 音频流
  job.stage = 'resolve';
  say('GET /x/web-interface/view?bvid=' + bvid);
  const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  if (v.code !== 0) throw new Error('view 失败 ' + v.code + ' ' + v.message);
  job.title = v.data.title;
  const { cid } = v.data;

  const pu = await wbiGet('https://api.bilibili.com/x/player/wbi/playurl', {
    bvid, cid: String(cid), fnval: '4048', fnver: '0', fourk: '1',
  });
  if (pu.code !== 0) throw new Error('playurl 失败 ' + pu.code + ' ' + pu.message);
  const audio = pickAudio(pu.data && pu.data.dash);
  if (!audio) throw new Error('没有可用音频流');
  say(`音频流 id=${audio.id} ${Math.round((audio.bandwidth || 0) / 1000)}kbps`);

  // 2) 下载（识别模式只需要音频本身；完整模式才需要分离）
  job.stage = 'download';
  const dir = path.join(CACHE, bvid);
  fs.mkdirSync(dir, { recursive: true });

  /** 单文件识别（内部复用批量接口） */
  const recognize = async (file) => {
    if (!file) return null;
    const full = path.isAbsolute(file) ? file : path.join(dir, file);
    const arr = await recognizeMany([full]);
    return arr[0] || null;
  };

  /** 批量识别：分小批跑 python，带本地结果缓存（Shazam 免费接口会限流，命中过就别再打） */
  const shazamCacheFile = path.join(dir, 'shazam_cache.json');
  let shazamCache = {};
  try {
    if (fs.existsSync(shazamCacheFile)) shazamCache = JSON.parse(fs.readFileSync(shazamCacheFile, 'utf8'));
  } catch { /* ignore */ }
  const saveShazamCache = () => {
    try { fs.writeFileSync(shazamCacheFile, JSON.stringify(shazamCache, null, 1)); } catch { /* ignore */ }
  };

  const recognizeMany = async (files) => {
    if (!files.length) return [];
    const results = new Array(files.length).fill(null);
    const todo = [];
    files.forEach((f, i) => {
      const key = path.basename(f);
      if (!job.force && Object.prototype.hasOwnProperty.call(shazamCache, key)) {
        results[i] = shazamCache[key];
      } else {
        todo.push({ i, f, key });
      }
    });
    const cachedCount = files.length - todo.length;
    if (cachedCount) say(`${cachedCount} 段命中本地识别缓存，跳过请求`);

    const BATCH = 4;
    let consecutiveFail = 0;
    let throttled = false;
    for (let b = 0; b < todo.length; b += BATCH) {
      if (throttled) break;
      const chunk = todo.slice(b, b + BATCH);
      say(`识别第 ${b + 1}-${b + chunk.length} / ${todo.length} 段（shazamio 并发，注意公开接口有速率限制）…`);
      const r = await run(PY, [path.join(__dirname, 'py', 'recognize.py'), ...chunk.map((c) => c.f)], { timeoutMs: 90000 });
      const lastOut = (r.out || '').trim().split(/\r?\n/).filter(Boolean).pop();
      let arr = null;
      if (lastOut) {
        try {
          const parsed = JSON.parse(lastOut);
          arr = Array.isArray(parsed) ? parsed : [parsed];
        } catch { /* fallthrough */ }
      }
      if (!arr) {
        const why = r.timedOut ? '本批超时（已杀进程）' : (r.err || '').trim().split(/\r?\n/).pop() || '无输出';
        say('本批识别失败：' + why);
        arr = chunk.map((c) => ({ file: c.f, ok: false, error: why }));
      }
      chunk.forEach((c, k) => {
        const item = arr[k] || { ok: false, error: 'missing' };
        results[c.i] = item;
        if (item.ok) {
          shazamCache[c.key] = item;
          consecutiveFail = 0;
        } else if (/timeout/i.test(item.error || '')) {
          consecutiveFail += 1;
        }
      });
      saveShazamCache();
      if (consecutiveFail >= 4) {
        throttled = true;
        say('连续超时，判定被 Shazam 限流：停止剩余请求，先返回已命中的结果');
      }
      await new Promise((r2) => setTimeout(r2, 800)); // 轻微间隔，降低被限流概率
    }
    job.throttled = throttled;
    return results;
  };

  // 2.0) 不分离模式：recognize（快速命中）/ tracklist（全片扫描出曲目表）
  if (job.mode === 'recognize' || job.mode === 'tracklist') {
    const src0 = path.join(dir, 'audio.m4s');
    if (!fs.existsSync(src0)) {
      const n = await downloadBinary([audio.baseUrl || audio.base_url, audio.backupUrl, audio.backupUrl2], src0);
      say(`下载完成 ${(n / 1048576).toFixed(2)} MB`);
    } else {
      say('复用已下载的 audio.m4s');
    }
    job.stage = 'recognize';

    const dur = v.data.duration || 0;
    const maxScan = Math.max(60, parseInt(env.get('TRACKLIST_MAX_SECONDS', '600'), 10) || 600);
    const scanLen = Math.min(dur, maxScan);

    let windows = [];
    let clipSec = 0;
    if (job.mode === 'recognize') {
      clipSec = Math.min(90, Math.max(30, parseInt(env.get('RECOGNIZE_CLIP_SECONDS', '45'), 10) || 45));
      const ratios = [0.08, 0.3, 0.5, 0.7, 0.88];
      windows = dur > clipSec * 2 ? ratios.map((r) => Math.max(0, Math.round(dur * r))).filter((s) => s + clipSec <= dur) : [0];
      say(`只识别模式：扫 ${windows.length} 个窗口（每段 ${clipSec}s），命中即返回`);
    } else {
      // 全片扫描：12s 窗口 / 10s 步进，覆盖整片（上限 maxScan 秒）
      clipSec = 12;
      const step = 10;
      for (let s = 3; s + clipSec <= scanLen + 0.5; s += step) windows.push(Math.round(s));
      say(`全片扫描模式：${windows.length} 个窗口（${clipSec}s/窗，步进 ${step}s，覆盖 0~${Math.round(scanLen)}s）`);
    }

    // 切窗口
    const cuts = [];
    for (let i = 0; i < windows.length; i++) {
      const ss = windows[i];
      const mp3 = path.join(dir, `scan_${i}_${ss}.mp3`);
      if (fs.existsSync(mp3) && !job.force) {
        cuts.push({ ss, mp3 });
        continue;
      }
      const r0 = await run(FFMPEG, ['-hide_banner', '-y', '-f', 'mp4', '-i', src0, '-vn', '-ac', '2', '-ar', '44100', '-b:a', '192k', '-ss', String(ss), '-t', String(clipSec), mp3]);
      if (r0.code === 0) cuts.push({ ss, mp3 });
      else say(`窗口 ${ss}s 截取失败，跳过`);
    }
    if (!cuts.length) throw new Error('没有截出任何可识别片段');

    const results = await recognizeMany(cuts.map((c) => c.mp3));

    // 逐窗结果 → 时间轴上的曲目段
    const hits = [];
    for (let i = 0; i < cuts.length; i++) {
      const r = results[i] || {};
      const m = r.match;
      hits.push({ ss: cuts[i].ss, match: m || null });
      if (m) say(`  ${cuts[i].ss}s → ${m.title} - ${m.artist}`);
    }

    const keyOf = (m) => (m ? (m.title || '') + '|' + (m.artist || '') : null);
    const segments = [];
    for (const h of hits) {
      if (!h.match) continue;
      const k = keyOf(h.match);
      const last = segments[segments.length - 1];
      if (last && keyOf(last.match) === k) {
        last.to = h.ss + clipSec;
        last.hits += 1;
      } else {
        segments.push({ match: h.match, from: h.ss, to: h.ss + clipSec, hits: 1 });
      }
    }
    // 同一首多次出现时只保留第一次（并记下出现次数）
    const seen = new Map();
    for (const s of segments) {
      const k = keyOf(s.match);
      if (!seen.has(k)) seen.set(k, { ...s, appearances: 1 });
      else seen.get(k).appearances += 1;
    }
    const tracks = [...seen.values()].sort((a, b) => a.from - b.from);
    // 相邻曲目不要时间重叠：把 to 夹到下一首的 from
    for (let i = 0; i < tracks.length - 1; i++) {
      if (tracks[i].to > tracks[i + 1].from) tracks[i].to = tracks[i + 1].from;
      tracks[i].from = Math.round(tracks[i].from);
      tracks[i].to = Math.round(tracks[i].to);
    }
    if (tracks.length) {
      const lastT = tracks[tracks.length - 1];
      lastT.from = Math.round(lastT.from);
      lastT.to = Math.round(Math.min(lastT.to, scanLen));
    }

    const first = tracks[0] ? { ok: true, match: tracks[0].match } : hits.find((h) => h.match) || { ok: true, match: null };
    say(tracks.length ? `共识别出 ${tracks.length} 首曲目` : '没有识别出曲目');

    job.result = {
      bvid,
      title: job.title,
      duration: v.data.duration,
      analyzedSeconds: Math.round(scanLen),
      mode: job.mode === 'tracklist' ? 'tracklist' : 'recognize-only',
      audio: { id: audio.id, kbps: Math.round((audio.bandwidth || 0) / 1000), bytes: 0 },
      separator: null,
      recognizer: {
        provider: 'shazam',
        mode: 'cloud',
        input: 'original-mix',
        windows: cuts.length,
        matchedWindows: hits.filter((h) => h.match).length,
        throttled: !!job.throttled,
      },
      tracks,
      stems: {},
      bgm: first,
      vocal: null,
      model: null,
    };
    return;
  }

  const findStems = () => {
    const files = fs.readdirSync(dir);
    // 同一 kind 出现多份（本地 & 云端）时，cloud_ 前缀的优先
    const byKind = {};
    for (const f of files) {
      const k = stemKindOf(f);
      if (!k) continue;
      if (!byKind[k] || f.startsWith('cloud_')) byKind[k] = f;
    }
    return {
      all: files,
      map: byKind,
      inst: byKind.instrumental || null,
      voc: byKind.vocals || null,
    };
  };

  let stems = findStems();
  let size = 0;
  let separatorInfo = null;

  if (stems.inst && stems.voc && !job.force) {
    say('命中缓存：' + stems.inst + ' / ' + stems.voc + '（跳过下载与分离）');
    separatorInfo = { provider: 'cache', model: 'cached' };
  } else {
    const src = path.join(dir, 'audio.m4s');
    size = await downloadBinary([audio.baseUrl || audio.base_url, audio.backupUrl, audio.backupUrl2], src);
    say(`下载完成 ${(size / 1048576).toFixed(2)} MB → cache/${bvid}/audio.m4s`);

    const provider = (env.get('SEP_PROVIDER', 'replicate') || 'replicate').toLowerCase();
    const allowLocal = env.get('ALLOW_LOCAL_SEP') === '1';
    const token = env.get('REPLICATE_API_TOKEN');
    const repModel = env.get('REPLICATE_SEP_MODEL', 'cjwbw/demucs');

    if (provider === 'replicate') {
      if (!token) {
        throw new Error('分离服务未配置：请在上方「设置」里填 Replicate API Token（本地 CPU 推理已默认关闭）');
      }
      job.stage = 'separate';
      // 只做格式转换（轻量单线程）；长视频只取前 N 秒，控制上传体积与云端计费
      const maxSec = Math.max(30, parseInt(env.get('ANALYZE_MAX_SECONDS', '300'), 10) || 300);
      const clip = v.data.duration > maxSec ? maxSec : 0;
      const mp3 = path.join(dir, 'cloud_src.mp3');
      const convArgs = ['-hide_banner', '-y', '-f', 'mp4', '-i', src, '-vn', '-ac', '2', '-ar', '44100', '-b:a', '320k'];
      if (clip) convArgs.push('-t', String(clip));
      convArgs.push(mp3);
      const conv = await run(FFMPEG, convArgs);
      if (conv.code !== 0) throw new Error('ffmpeg 转 mp3 失败：' + (conv.err || '').slice(-200));
      job.analyzedSeconds = clip || v.data.duration;
      say(
        `轻量转码完成 → cloud_src.mp3（${(fs.statSync(mp3).size / 1048576).toFixed(1)}MB）` +
          (clip ? `；视频 ${v.data.duration}s，只取前 ${clip}s 分析` : '') +
          '，准备上传云端分离'
      );

      const r = await cloud.replicateSeparate({
        token,
        model: repModel,
        variant: env.get('REPLICATE_MODEL_VARIANT', ''),
        inputFile: mp3,
        outDir: dir,
        ffmpeg: FFMPEG,
        onLog: say,
      });
      separatorInfo = { provider: 'replicate', model: r.model, version: (r.version || '').slice(0, 10), predictionId: r.predictionId };
      say('云端分离完成：vocals=' + (r.vocalsPath ? path.basename(r.vocalsPath) : '无') + ' instrumental=' + (r.instPath ? path.basename(r.instPath) : '无'));
      stems = findStems();
    } else if (provider === 'local') {
      if (!allowLocal) {
        throw new Error('本地分离已被禁用（ALLOW_LOCAL_SEP!=1）。要跑 CPU 推理请在设置里显式打开。');
      }
      // .m4s 是分片 MP4，先显式转 44.1k 双声道 wav
      const wavPath = path.join(dir, 'audio.wav');
      let conv = await run(FFMPEG, ['-hide_banner', '-y', '-f', 'mp4', '-i', src, '-vn', '-ac', '2', '-ar', '44100', wavPath]);
      if (conv.code !== 0) {
        conv = await run(FFMPEG, ['-hide_banner', '-y', '-f', 'aac', '-i', src, '-vn', '-ac', '2', '-ar', '44100', wavPath]);
      }
      if (conv.code !== 0) throw new Error('ffmpeg 转码失败：' + (conv.err || '').slice(-200));
      say('ffmpeg 转码完成 → audio.wav');

      job.stage = 'separate';
      if (!fs.existsSync(SEP_EXE)) throw new Error('找不到 audio-separator: ' + SEP_EXE);
      say('本地 CPU 分离中：audio-separator → ' + SEP_MODEL + '（会很吃 CPU）');
      const modelDir = path.join(CACHE, 'models');
      fs.mkdirSync(modelDir, { recursive: true });
      const sep = await run(SEP_EXE, [wavPath, '-m', SEP_MODEL, '--output_dir', dir, '--model_file_dir', modelDir], {
        onLine: (l) => {
          if (/(\d+)%\|/.test(l)) return;
          if (/Saving|Vocals|Instrumental|Model|duration/i.test(l) && l.length < 160) say(l);
        },
      });
      if (sep.code !== 0) throw new Error('audio-separator 退出码 ' + sep.code + ' ' + (sep.err || '').slice(-200));
      separatorInfo = { provider: 'local', model: SEP_MODEL };
      stems = findStems();
    } else {
      throw new Error('未知的分离引擎：' + provider + '（可选 replicate / local）');
    }
  }

  const { inst: instFile, voc: vocFile } = stems;
  if (!instFile && !vocFile) throw new Error('分离产物里没有 wav/flac（目录：' + stems.all.join(', ') + '）');
  say('分离产物：' + stems.all.filter((f) => STEM_EXT.test(f)).join(', '));

  // 4) Shazam 识别（recognize() 在上面统一定义）
  job.stage = 'recognize';
  const bgm = await recognize(instFile);
  const vocal = await recognize(vocFile);
  if (bgm && bgm.match) say('BGM 命中：' + bgm.match.title + ' - ' + bgm.match.artist);
  if (vocal && vocal.match) say('人声轨命中：' + vocal.match.title + ' - ' + vocal.match.artist);

  // 所有分离出来的轨都暴露给前端（4-stem 会有 drums/bass/other）
  const stemUrls = {};
  for (const k of STEM_KINDS) {
    if (stems.map[k]) stemUrls[k] = `/api/analyze/stem?bvid=${bvid}&kind=${k}`;
  }
  if (Object.keys(stemUrls).length) say('可用音轨：' + Object.keys(stemUrls).join(', '));

  job.result = {
    bvid,
    title: job.title,
    duration: v.data.duration,
    analyzedSeconds: job.analyzedSeconds || v.data.duration,
    audio: { id: audio.id, kbps: Math.round((audio.bandwidth || 0) / 1000), bytes: size },
    separator: separatorInfo || { provider: 'cache', model: 'cached' },
    recognizer: { provider: 'shazam', mode: 'cloud' },
    stems: stemUrls,
    bgm: bgm || null,
    vocal: vocal || null,
    model: (separatorInfo && separatorInfo.model) || SEP_MODEL,
  };
}


const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    try { json(res, 500, { ok: false, message: 'server error: ' + (e && e.message) }); } catch { /* ignore */ }
  });
});

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('x-demo', 'bili-scan-login');

  // 身份探针
  if (req.method === 'GET' && url.pathname === '/api/ping') {
    return json(res, 200, { ok: true, demo: 'bili-scan-login', loggedIn: !!state.cookies.SESSDATA });
  }

  // 诊断
  if (req.method === 'GET' && url.pathname === '/api/debug') {
    return json(res, 200, {
      ok: true,
      jarNames: Object.keys(state.cookies),
      hasSessData: !!state.cookies.SESSDATA,
      hasJct: !!state.cookies.bili_jct,
      hasRefreshToken: !!state.refreshToken,
      wbiKeys: state.wbiKeys,
      lastPoll: state.lastPoll,
    });
  }

  // 静态资源：/app 走新 React 产物，其余走旧 Vue 产物（两套并存）
  if (req.method === 'GET' && !url.pathname.startsWith('/api')) {
    const MIME = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
    };
    // 新前端（听影 / Figma Make 稿）：/ui 前缀 + SPA 回退
    if (url.pathname === '/ui' || url.pathname.startsWith('/ui/')) {
      const ROOT = path.join(__dirname, 'ui', 'dist');
      const rel = url.pathname.replace(/^\/ui\/?/, '') || 'index.html';
      let file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) file = path.join(ROOT, 'index.html');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(ROOT, 'index.html');
      const ext = path.extname(file);
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      });
      return res.end(fs.readFileSync(file));
    }

    // 新前端（React 18 + Vite）：/app 前缀 + SPA 回退
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      const ROOT = path.join(__dirname, 'app', 'dist');
      const rel = url.pathname.replace(/^\/app\/?/, '') || 'index.html';
      let file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) file = path.join(ROOT, 'index.html');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(ROOT, 'index.html');
      const ext = path.extname(file);
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      });
      return res.end(fs.readFileSync(file));
    }

    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const candidates = [path.join(DIST, rel), path.join(DIST, 'index.html'), path.join(__dirname, 'index.html')];
    for (const file of candidates) {
      if (file.startsWith(DIST) === false && file !== path.join(__dirname, 'index.html')) continue;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        return res.end(fs.readFileSync(file));
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }

  // 1. 申请二维码
  if (req.method === 'POST' && url.pathname === '/api/qr') {
    await ensureBuvid();
    const g = await bili('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
    if (g.code !== 0 || !g.data) return json(res, 200, { ok: false, step: 'generate', resp: g });
    const png = await QR.toDataURL(g.data.url, { margin: 1, width: 260, errorCorrectionLevel: 'M' });
    return json(res, 200, {
      ok: true,
      url: g.data.url,
      qrcodeKey: g.data.qrcode_key,
      png,
      ttlSeconds: 180,
      buvid: !!(state.cookies.buvid3 && state.cookies.buvid4),
    });
  }

  // 2. 轮询状态
  if (req.method === 'POST' && url.pathname === '/api/poll') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let payload = {};
    try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }
    const qrcodeKey = payload.qrcodeKey;
    if (!qrcodeKey) return json(res, 400, { ok: false, message: 'missing qrcodeKey' });

    const p = await bili(
      `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}&source=main-fe-header`
    );
    const inner = (p.data && p.data.code) ?? -1;
    if (p.code !== 0) return json(res, 200, { ok: false, pollCode: inner, message: p.message });

    if (inner === 0) {
      const fromHeader = cookiesFromSetCookie(p._setCookie);
      const fromUrl = cookiesFromUrl(p.data && p.data.url);
      const merged = { ...state.cookies, ...fromHeader, ...fromUrl };

      state.cookies = merged;
      state.refreshToken = (p.data && p.data.refresh_token) || '';
      state.lastPoll = {
        at: new Date().toISOString(),
        urlLen: ((p.data && p.data.url) || '').length,
        setCookieNames: Object.keys(fromHeader),
        urlCookieNames: Object.keys(fromUrl),
        jarNames: Object.keys(merged),
        hasSessData: !!merged.SESSDATA,
        refreshTokenLen: state.refreshToken.length,
      };

      const extra = await enrichSession();
      let me = await fetchUser();
      if (!me.ok) {
        await new Promise((r) => setTimeout(r, 400));
        me = await fetchUser();
      }
      state.lastPoll.navCode = me.ok ? 0 : me.code;
      if (me.ok) saveSession();

      return json(res, 200, {
        ok: true,
        done: true,
        pollCode: 0,
        message: me.ok ? '登录成功' : '扫码成功，但 nav 复验失败',
        user: me.ok ? me.user : null,
        nav: me.ok ? { code: 0 } : { code: me.code, message: me.message },
        extra,
        cookieList: Object.entries(state.cookies).map(([k, v]) => ({ name: k, value: mask(v) })),
        hasRefreshToken: !!state.refreshToken,
      });
    }

    const labels = { 86101: '未扫码', 86090: '已扫码，等待手机确认', 86038: '二维码已失效' };
    return json(res, 200, { ok: true, done: false, pollCode: inner, message: labels[inner] || `状态 ${inner}` });
  }

  // 3. 复验登录态
  if (req.method === 'GET' && url.pathname === '/api/me') {
    if (!state.cookies.SESSDATA) return json(res, 200, { ok: false, message: '尚未登录' });
    return json(res, 200, await fetchUser());
  }

  // 3.5 个人资料（自己）：nav + 关系数 + 收藏夹数
  if (req.method === 'GET' && url.pathname === '/api/user') {
    if (!state.cookies.SESSDATA) return json(res, 200, { ok: false, needLogin: true, message: '尚未登录' });
    const nav = await fetchUser();
    if (!nav.ok) return json(res, 200, nav);
    const mid = nav.user.mid;
    let fans = null;
    let following = null;
    try {
      const rel = await bili(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`);
      if (rel.code === 0 && rel.data) {
        fans = rel.data.follower;
        following = rel.data.following;
      }
    } catch { /* ignore */ }
    let favCount = null;
    try {
      const f = await bili(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${mid}&web_location=333.1387`);
      if (f.code === 0 && f.data) favCount = (f.data.list || []).length;
    } catch { /* ignore */ }
    return json(res, 200, {
      ok: true,
      user: { ...nav.user, fans, following, favCount, mid, loggedAt: state.savedAt || '' },
    });
  }

  // 4. 退出
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    state.cookies = {}; state.refreshToken = ''; state.lastPoll = null;
    try { fs.unlinkSync(SESSION_FILE); } catch { /* ignore */ }
    return json(res, 200, { ok: true });
  }

  // 5. 图片代理：hdslb CDN 会 403 掉 Referer 为 127.0.0.1 的请求（已实测）
  if (req.method === 'GET' && url.pathname === '/api/img') {
    const raw = url.searchParams.get('u') || '';
    let target;
    try { target = new URL(raw.startsWith('//') ? 'https:' + raw : raw); } catch { return json(res, 400, { ok: false, message: 'bad url' }); }
    if (!/(^|\.)(hdslb\.com|bilibili\.com|bilivideo\.com)$/.test(target.hostname)) {
      return json(res, 400, { ok: false, message: 'host not allowed' });
    }
    const hit = imgCache.get(target.href);
    if (hit && Date.now() - hit.at < 60 * 60 * 1000) {
      res.writeHead(200, { 'content-type': hit.type, 'cache-control': 'public, max-age=3600' });
      return res.end(hit.buf);
    }
    const r = await bili(target.href, { binary: true });
    if (r._status !== 200) { res.writeHead(r._status || 502); return res.end(); }
    if (imgCache.size > 300) imgCache.delete(imgCache.keys().next().value);
    imgCache.set(target.href, { buf: r._buf, type: 'image/jpeg', at: Date.now() });
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' });
    return res.end(r._buf);
  }

  // 6. 收藏夹列表（需登录）
  if (req.method === 'GET' && url.pathname === '/api/fav') {
    if (!state.cookies.SESSDATA) return json(res, 200, { ok: false, needLogin: true, message: '需登录' });
    const mid = state.cookies.DedeUserID;
    const [created, collected] = await Promise.all([
      bili(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${mid}&web_location=333.1387`),
      bili(`https://api.bilibili.com/x/v3/fav/folder/collected/list?up_mid=${mid}&pn=1&ps=20&platform=web`),
    ]);
    const folders = [];
    for (const f of (created.data && created.data.list) || []) {
      folders.push({ id: f.id, title: f.title, count: f.media_count, cover: fixCover(f.cover), kind: '我创建的' });
    }
    for (const f of (collected.data && collected.data.list) || []) {
      folders.push({ id: f.id, title: f.title, count: f.media_count, cover: fixCover(f.cover), kind: '我收藏的' });
    }
    return json(res, 200, {
      ok: created.code === 0 || collected.code === 0,
      code: created.code,
      message: created.message,
      folders,
    });
  }

  // 7. 收藏夹内容
  if (req.method === 'GET' && url.pathname === '/api/fav/items') {
    if (!state.cookies.SESSDATA) return json(res, 200, { ok: false, needLogin: true, message: '需登录' });
    const mediaId = url.searchParams.get('media_id');
    const pn = url.searchParams.get('pn') || '1';
    if (!mediaId) return json(res, 400, { ok: false, message: 'missing media_id' });
    const j = await bili(
      `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${pn}&ps=20&keyword=&order=mtime&type=0&tid=0&platform=web`
    );
    const info = j.data && j.data.info;
    const items = ((j.data && j.data.medias) || []).map((m) => ({
      title: m.title,
      cover: fixCover(m.cover),
      up: m.upper && m.upper.name,
      play: (m.cnt_info && m.cnt_info.play) || 0,
      bvid: m.bvid,
      meta: `时长 ${m.duration} · 收藏于 ${new Date(m.fav_time * 1000).toLocaleDateString('zh-CN')}`,
    }));
    return json(res, 200, {
      ok: j.code === 0, code: j.code, message: j.message,
      folder: info ? { title: info.title, count: info.media_count } : null,
      hasMore: !!(j.data && j.data.has_more), items,
    });
  }

  // 8. 热门
  if (req.method === 'GET' && url.pathname === '/api/popular') {
    const pn = url.searchParams.get('pn') || '1';
    const j = await bili(`https://api.bilibili.com/x/web-interface/popular?ps=20&pn=${pn}`);
    const items = ((j.data && j.data.list) || []).map((v) => ({
      title: v.title, cover: fixCover(v.pic), up: v.owner && v.owner.name,
      play: v.stat && v.stat.view, bvid: v.bvid,
      meta: `${v.tname || ''} · 弹幕 ${(v.stat && v.stat.danmaku) || 0}`,
      // 卡片直接用，省掉每个视频再查一次详情
      aid: v.aid,
      duration: v.duration,
      pubdate: v.pubdate,
      tname: v.tname || '',
      like: (v.stat && v.stat.like) || 0,
      reply: (v.stat && v.stat.reply) || 0,
      danmaku: (v.stat && v.stat.danmaku) || 0,
      favorite: (v.stat && v.stat.favorite) || 0,
      owner: { mid: v.owner && v.owner.mid, name: v.owner && v.owner.name, face: fixCover(v.owner && v.owner.face) },
    }));
    return json(res, 200, { ok: j.code === 0, code: j.code, items, noMore: !!(j.data && j.data.no_more) });
  }

  // 8.5 推荐流「换一批」：/x/web-interface/wbi/index/top/feed/rcmd
  //     热门榜是固定一期，刷新不会变；这个接口每次给新内容
  if (req.method === 'GET' && url.pathname === '/api/feed/recommend') {
    const brush = Number(url.searchParams.get('refresh') || 0) || 0;
    const ps = 20;
    const params = {
      web_location: 1430650,
      y_num: 5,
      fresh_type: 4,
      feed_version: 'V8',
      fresh_idx: brush + 1,
      fresh_idx_1h: brush + 1,
      fetch_row: 1,
      fresh_type_: 4,
      ps,
      brush: brush,
      homepage_ver: 1,
      last_y_num: 5,
      screen: '1920-1080',
      seo_info: '',
      last_showlist: '',
    };
    const j = await wbiGet('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd', params);
    if (j.code !== 0 || !j.data) {
      return json(res, 200, { ok: false, code: j.code, message: j.message || '推荐流不可用', items: [] });
    }
    const list = j.data.item || j.data.items || [];
    const items = list
      .map((x) => (x.bvid ? x : x && x.card ? x.card : null))
      .filter(Boolean)
      .map((v) => {
        const st = v.stat || {};
        const owner = v.owner || {};
        return {
          title: v.title,
          cover: fixCover(v.pic),
          up: owner.name,
          play: st.view,
          bvid: v.bvid,
          aid: v.aid,
          duration: v.duration,
          pubdate: v.pubdate,
          tname: v.tname || '',
          like: st.like || 0,
          reply: st.reply || 0,
          danmaku: st.danmaku || 0,
          favorite: st.favorite || 0,
          owner: { mid: owner.mid, name: owner.name, face: fixCover(owner.face) },
          meta: `${v.tname || ''} · 推荐`,
        };
      });
    return json(res, 200, { ok: true, code: 0, items, noMore: false });
  }

  // 9. 排行榜
  if (req.method === 'GET' && url.pathname === '/api/ranking') {
    const rid = url.searchParams.get('rid') || '0';
    const j = await bili(`https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`);
    const items = ((j.data && j.data.list) || []).slice(0, 20).map((v) => ({
      title: v.title, cover: fixCover(v.pic), up: v.owner && v.owner.name,
      play: v.stat && v.stat.view, bvid: v.bvid, meta: v.tname || '',
    }));
    return json(res, 200, { ok: j.code === 0, code: j.code, items });
  }

  // 10. 搜索：BV 号直查详情，其余走 WBI 搜索
  if (req.method === 'GET' && url.pathname === '/api/search') {
    const keyword = url.searchParams.get('keyword') || '';
    const page = url.searchParams.get('page') || '1';
    if (!keyword) return json(res, 400, { ok: false, message: 'missing keyword' });

    if (/^BV[0-9A-Za-z]{10}$/.test(keyword)) {
      const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(keyword)}`);
      if (v.code !== 0 || !v.data) {
        return json(res, 200, { ok: false, code: v.code, message: v.message, items: [] });
      }
      const d = v.data;
      return json(res, 200, {
        ok: true, code: 0, byBv: true, numResults: 1,
        items: [{
          title: d.title,
          cover: fixCover(d.pic),
          up: d.owner && d.owner.name,
          play: d.stat && d.stat.view,
          bvid: d.bvid,
          meta: `${d.tname || ''} · ${d.duration}s · ${d.pubdate ? new Date(d.pubdate * 1000).toLocaleDateString('zh-CN') : ''}`,
        }],
      });
    }

    const j = await wbiGet('https://api.bilibili.com/x/web-interface/wbi/search/type', {
      search_type: 'video', keyword, page,
    });
    const items = ((j.data && j.data.result) || []).map((v) => ({
      title: stripTags(v.title), cover: fixCover(v.pic), up: v.author,
      play: v.play, bvid: v.bvid,
      meta: `${v.duration || ''} · ${v.pubdate ? new Date(v.pubdate * 1000).toLocaleDateString('zh-CN') : ''}`,
    }));
    return json(res, 200, {
      ok: j.code === 0, code: j.code, message: j.message,
      numResults: j.data && j.data.numResults, items,
    });
  }

  // ---------- 11. 视频 BGM 识别：下载音频 → 分离人声/伴奏 → Shazam 识别 ----------
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let payload = {};
    try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }
    const bvid = payload.bvid;
    if (!bvid || !/^BV[0-9A-Za-z]{10}$/.test(bvid)) {
      return json(res, 400, { ok: false, message: '需要合法 bvid' });
    }
    const job = startAnalyze(bvid, {
      force: !!payload.force,
      mode: ['recognize', 'tracklist'].includes(payload.mode) ? payload.mode : 'full',
    });
    return json(res, 200, { ok: true, jobId: job.id, state: job.state, stage: job.stage });
  }

  if (req.method === 'GET' && url.pathname === '/api/analyze/status') {
    const job = jobs.get(url.searchParams.get('jobId'));
    if (!job) return json(res, 404, { ok: false, message: 'job not found' });
    return json(res, 200, {
      ok: true,
      state: job.state,
      stage: job.stage,
      title: job.title,
      log: job.log.slice(-24),
      result: job.result,
      error: job.error,
      elapsedMs: Date.now() - job.startedAt,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/analyze/stem') {
    const bvid = url.searchParams.get('bvid') || '';
    const kind = String(url.searchParams.get('kind') || 'instrumental').toLowerCase();
    const wantDownload = url.searchParams.get('dl') === '1';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    if (!STEM_KINDS.includes(kind)) return json(res, 400, { ok: false, message: 'bad kind' });
    const dir = path.join(CACHE, bvid);
    if (!fs.existsSync(dir)) return json(res, 404, { ok: false });
    const candidates = fs.readdirSync(dir).filter((f) => stemKindOf(f) === kind);
    if (!candidates.length) return json(res, 404, { ok: false, message: 'stem not found' });
    const file = candidates.find((f) => f.startsWith('cloud_')) || candidates[0];
    const full = path.join(dir, file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const buf = fs.readFileSync(full);
    const headers = {
      'content-type': ext === 'flac' ? 'audio/flac' : 'audio/wav',
      'content-length': buf.length,
      'accept-ranges': 'none',
    };
    if (wantDownload) {
      headers['content-disposition'] = `attachment; filename="${bvid}_${kind}.${ext}"`;
    }
    res.writeHead(200, headers);
    return res.end(buf);
  }

  // ---------- 12. 运行时配置：分离引擎 / 云端 token ----------
  if (req.method === 'GET' && url.pathname === '/api/config') {
    const provider = (env.get('SEP_PROVIDER', 'replicate') || 'replicate').toLowerCase();
    const token = env.get('REPLICATE_API_TOKEN');
    const allowLocal = env.get('ALLOW_LOCAL_SEP') === '1';
    return json(res, 200, {
      ok: true,
      separator: {
        provider,
        allowLocal,
        replicateModel: env.get('REPLICATE_SEP_MODEL', 'cjwbw/demucs'),
        replicateToken: env.masked(token),
        hasToken: !!token,
        ready: provider === 'replicate' ? !!token : allowLocal,
      },
      recognizer: { provider: 'shazam', mode: 'cloud', ready: true },
      options: {
        providers: [
          { id: 'replicate', label: '云端 Replicate（推荐，零本地算力）', needsToken: true },
          { id: 'local', label: '本地 CPU（UVR onnx，会吃 CPU）', needsToken: false },
        ],
        replicateModels: ['cjwbw/demucs', 'ryan5453/demucs'],
      },
      envFile: path.relative(__dirname, env.FILE),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch { /* ignore */ }
    if (p.sepProvider) env.set('SEP_PROVIDER', String(p.sepProvider));
    if (p.replicateModel) env.set('REPLICATE_SEP_MODEL', String(p.replicateModel));
    if (typeof p.allowLocal === 'boolean') env.set('ALLOW_LOCAL_SEP', p.allowLocal ? '1' : '');
    if (typeof p.replicateToken === 'string' && p.replicateToken.trim()) {
      env.set('REPLICATE_API_TOKEN', p.replicateToken.trim());
    }
    if (p.clearReplicateToken) env.set('REPLICATE_API_TOKEN', '');
    return json(res, 200, { ok: true, savedTo: path.relative(__dirname, env.FILE) });
  }

  // ---------- 13. 短信登录：极验点选抛给用户，结果回传后服务端发短信/登录 ----------
  if (req.method === 'GET' && url.pathname === '/api/sms/status') {
    return json(res, 200, sms.snapshot());
  }

  if (req.method === 'POST' && url.pathname === '/api/sms/start') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch { /* ignore */ }
    try {
      return json(res, 200, await sms.start(String(p.phone || '').trim()));
    } catch (e) {
      return json(res, 200, { ok: false, message: e.message, stage: 'error' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/sms/login') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch { /* ignore */ }
    try {
      const snap = await sms.loginWithCode(String(p.code || '').trim());
      // 登录成功立刻热加载到内存会话
      loadSession();
      return json(res, 200, snap);
    } catch (e) {
      return json(res, 200, { ok: false, message: e.message, stage: sms.SESSION.stage });
    }
  }

  // 极验点选：把面板截出来给前端，用户点完把坐标转发回真页面
  if (req.method === 'GET' && url.pathname === '/api/sms/geetest') {
    try {
      return json(res, 200, await sms.captureGeetest());
    } catch (e) {
      return json(res, 200, { ok: false, active: false, message: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/sms/geetest/click') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch { /* ignore */ }
    try {
      const r = await sms.clickGeetest(Array.isArray(p.points) ? p.points : []);
      return json(res, 200, r);
    } catch (e) {
      return json(res, 200, { ok: false, message: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/sms/reset') {
    return json(res, 200, sms.reset());
  }

  // ---------- 14. 视频详情：点赞/播放/UP主/粉丝数 ----------
  if (req.method === 'GET' && url.pathname === '/api/video') {
    const bvid = url.searchParams.get('bvid') || '';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    const cached = videoCache.get(bvid);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
      return json(res, 200, { ok: true, cached: true, video: cached.video });
    }
    const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    if (v.code !== 0 || !v.data) return json(res, 200, { ok: false, code: v.code, message: v.message });
    const d = v.data;
    const mid = d.owner && d.owner.mid;
    let follower = null;
    if (mid) {
      const rel = await bili(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`);
      if (rel.code === 0 && rel.data) follower = rel.data.follower;
    }
    const video = {
      bvid: d.bvid,
      aid: d.aid,
      cid: d.cid,
      title: d.title,
      pic: fixCover(d.pic),
      desc: (d.desc || '').slice(0, 500),
      duration: d.duration,
      pubdate: d.pubdate,
      tname: d.tname,
      stat: {
        view: d.stat && d.stat.view,
        like: d.stat && d.stat.like,
        danmaku: d.stat && d.stat.danmaku,
        reply: d.stat && d.stat.reply,
        favorite: d.stat && d.stat.favorite,
        coin: d.stat && d.stat.coin,
        share: d.stat && d.stat.share,
      },
      owner: {
        mid,
        name: d.owner && d.owner.name,
        face: fixCover(d.owner && d.owner.face),
        follower,
      },
    };
    if (videoCache.size > 400) videoCache.delete(videoCache.keys().next().value);
    videoCache.set(bvid, { video, at: Date.now() });
    return json(res, 200, { ok: true, video });
  }

  // ---------- 15. 仅播放音频：返回音频流元信息 ----------
  if (req.method === 'GET' && url.pathname === '/api/audio') {
    const bvid = url.searchParams.get('bvid') || '';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    if (v.code !== 0) return json(res, 200, { ok: false, code: v.code, message: v.message });
    const pu = await wbiGet('https://api.bilibili.com/x/player/wbi/playurl', {
      bvid, cid: String(v.data.cid), fnval: '4048', fnver: '0', fourk: '1',
    });
    if (pu.code !== 0) return json(res, 200, { ok: false, code: pu.code, message: pu.message });
    const audio = pickAudio(pu.data && pu.data.dash);
    if (!audio) return json(res, 200, { ok: false, message: '没有可用音频流' });
    // 不把 CDN 直链给前端（会被 Referer 拦），走本地代理
    audioCache.set(bvid, { url: audio.baseUrl || audio.base_url, at: Date.now() });
    return json(res, 200, {
      ok: true,
      stream: `/api/audio/stream?bvid=${bvid}`,
      kbps: Math.round((audio.bandwidth || 0) / 1000),
      format: 'm4a',
      duration: v.data.duration,
    });
  }

  // 音频流代理（支持 Range，浏览器可拖动进度）
  if (req.method === 'GET' && url.pathname === '/api/audio/stream') {
    const bvid = url.searchParams.get('bvid') || '';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false });
    let hit = audioCache.get(bvid);
    if (!hit || Date.now() - hit.at > 30 * 60 * 1000) {
      const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
      if (v.code !== 0) return json(res, 502, { ok: false });
      const pu = await wbiGet('https://api.bilibili.com/x/player/wbi/playurl', {
        bvid, cid: String(v.data.cid), fnval: '4048', fnver: '0', fourk: '1',
      });
      const audio = pickAudio(pu.data && pu.data.dash);
      if (!audio) return json(res, 502, { ok: false });
      hit = { url: audio.baseUrl || audio.base_url, at: Date.now() };
      audioCache.set(bvid, hit);
    }
    const headers = { 'user-agent': UA, referer: 'https://www.bilibili.com/', origin: 'https://www.bilibili.com' };
    if (req.headers.range) headers.range = req.headers.range;
    const upstream = await fetch(hit.url, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      // 直链过期 → 清缓存，让前端重试
      audioCache.delete(bvid);
      res.writeHead(502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, message: 'audio stream ' + upstream.status }));
    }
    const outHeaders = {
      'content-type': 'audio/mp4',
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    };
    for (const k of ['content-length', 'content-range']) {
      const v2 = upstream.headers.get(k);
      if (v2) outHeaders[k] = v2;
    }
    res.writeHead(upstream.status, outHeaders);
    Readable.fromWeb(upstream.body).pipe(res);
    return;
  }

  // ---------- 15b. 视频流（<video> 直接播，只到画面，无音轨） ----------
  if (req.method === 'GET' && url.pathname === '/api/video/stream') {
    const bvid = url.searchParams.get('bvid') || '';
    const q = url.searchParams.get('q') || '0';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    const meta = await getDash(bvid);
    if (!meta.ok) return json(res, 502, meta);
    const v = pickVideo(meta.dash, q);
    if (!v) return json(res, 502, { ok: false, message: '没有可用视频流' });
    const headers = { 'user-agent': UA, referer: 'https://www.bilibili.com/', origin: 'https://www.bilibili.com' };
    if (req.headers.range) headers.range = req.headers.range;
    const upstream = await fetch(v.baseUrl || v.base_url, { headers }).catch((e) => ({ ok: false, status: 0, _e: e }));
    if (!upstream.ok && upstream.status !== 206) {
      return json(res, 502, { ok: false, message: 'video stream ' + (upstream.status || upstream._e) });
    }
    const outHeaders = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
    for (const k of ['content-length', 'content-range']) {
      const val = upstream.headers.get(k);
      if (val) outHeaders[k] = val;
    }
    res.writeHead(upstream.status, outHeaders);
    Readable.fromWeb(upstream.body).pipe(res);
    return;
  }

  // ---------- 15c-0. 合流进度（大文件时前端轮询这个显示百分比） ----------
  if (req.method === 'GET' && url.pathname === '/api/video/progress') {
    const bvid = url.searchParams.get('bvid') || '';
    const q = url.searchParams.get('q') || '0';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    const p = muxProgress.get(`${bvid}|${q}`);
    if (!p) return json(res, 200, { ok: true, running: false, percent: 0 });
    const stale = Date.now() - p.at > 8000;
    const eta = p.duration && p.speed ? Math.max(0, Math.round((p.duration - p.outTime) / p.speed)) : null;
    return json(res, 200, {
      ok: true,
      running: !p.done && !stale,
      done: !!p.done,
      percent: p.percent,
      outTime: Math.round(p.outTime * 10) / 10,
      duration: Math.round(p.duration || 0),
      speed: p.speed,
      eta,
    });
  }

  // ---------- 15c. 视频播放/下载：ffmpeg 合流成完整 mp4 落盘，再按 Range 提供 ----------
  // 先落盘而不是 pipe：fragmented mp4 在浏览器里没有 duration，进度条和拖动都会坏
  if (req.method === 'GET' && url.pathname === '/api/video/prepare') {
    const bvid = url.searchParams.get('bvid') || '';
    const q = url.searchParams.get('q') || '0';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    try {
      const out = await ensureVideoFile(bvid, q);
      return json(res, 200, {
        ok: true,
        url: `/api/video/file?bvid=${bvid}&q=${q}`,
        download: `/api/video/download?bvid=${bvid}&q=${q}`,
        size: out.size,
        duration: out.duration,
        quality: out.quality,
        ms: out.ms,
      });
    } catch (e) {
      return json(res, 200, { ok: false, message: e.message });
    }
  }

  if (req.method === 'GET' && (url.pathname === '/api/video/file' || url.pathname === '/api/video/download')) {
    const download = url.pathname.endsWith('download');
    const bvid = url.searchParams.get('bvid') || '';
    const q = url.searchParams.get('q') || '0';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    let out;
    try {
      out = await ensureVideoFile(bvid, q);
    } catch (e) {
      return json(res, 502, { ok: false, message: e.message });
    }
    const stat = fs.statSync(out.file);
    const total = stat.size;
    const range = req.headers.range;
    const head = {
      'content-type': 'video/mp4',
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    };
    if (download) head['content-disposition'] = `attachment; filename="${encodeURIComponent(out.name)}.mp4"`;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      if (start > end || start >= total) {
        res.writeHead(416, { 'content-range': `bytes */${total}` });
        return res.end();
      }
      res.writeHead(206, { ...head, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${total}` });
      return fs.createReadStream(out.file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, 'content-length': total });
    return fs.createReadStream(out.file).pipe(res);
  }

  // 旧的实时合流端点保留，供不支持落盘的环境兜底
  if (req.method === 'GET' && url.pathname === '/api/video/play') {
    const bvid = url.searchParams.get('bvid') || '';
    const q = url.searchParams.get('q') || '0';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    const out = await ensureVideoFile(bvid, q).catch((e) => ({ error: e.message }));
    if (out.error) return json(res, 502, { ok: false, message: out.error });
    return json(res, 200, { ok: true, url: `/api/video/file?bvid=${bvid}&q=${q}`, size: out.size });
  }

  // ---------- 16. 评论列表 ----------
  if (req.method === 'GET' && url.pathname === '/api/comments') {
    const bvid = url.searchParams.get('bvid') || '';
    const pn = url.searchParams.get('pn') || '1';
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, message: 'bad bvid' });
    const v = await bili(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    if (v.code !== 0) return json(res, 200, { ok: false, code: v.code, message: v.message });
    const aid = v.data.aid;
    const r = await wbiGet('https://api.bilibili.com/x/v2/reply/wbi/main', {
      oid: String(aid), type: '1', mode: '3', plat: '1', web_location: '1315875', pn: String(pn),
    });
    let replies = [];
    if (r.code === 0 && r.data) {
      replies = (r.data.replies || []).map((c) => ({
        rpid: c.rpid,
        uname: c.member && c.member.uname,
        avatar: fixCover(c.member && c.member.avatar),
        content: (c.content && c.content.message) || '',
        like: c.like || 0,
        rcount: c.rcount || 0,
        ctime: c.ctime,
        location: (c.reply_control && c.reply_control.location) || '',
      }));
    } else {
      // 兜底：老接口
      const r2 = await bili(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&pn=${pn}&ps=20&sort=2`);
      if (r2.code === 0 && r2.data) {
        replies = (r2.data.replies || []).map((c) => ({
          rpid: c.rpid,
          uname: c.member && c.member.uname,
          avatar: fixCover(c.member && c.member.avatar),
          content: (c.content && c.content.message) || '',
          like: c.like || 0,
          rcount: c.rcount || 0,
          ctime: c.ctime,
          location: '',
        }));
      }
    }
    const total = (r.data && r.data.cursor && r.data.cursor.all_count) || (r.data && r.data.page && r.data.page.count) || replies.length;
    return json(res, 200, { ok: replies.length > 0 || r.code === 0, code: r.code, total, page: Number(pn), replies });
  }

  json(res, 404, { ok: false, message: 'not found' });
}

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.message));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e && e.message));

/** 端口被占用时自动往后找一个空闲端口 */
function listen(port, tries = 0) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries < 10) {
      listen(port + 1, tries + 1);
    } else {
      console.error('启动失败:', e.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`\n验证台已启动 →  http://127.0.0.1:${port}\n`);
    if (!state.cookies.SESSDATA) console.log('提示：尚未登录，页面点「生成二维码」用 B 站 App 扫码。');
  });
}

env.load();
loadSession();
listen(PORT);
