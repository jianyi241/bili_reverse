#!/usr/bin/env node
/**
 * bili.js —— bilibili Web 端接口逆向复现客户端（Node >= 22，零依赖）
 *
 * 复现的三块核心机制：
 *   1) WBI 签名      —— /x/web-interface/wbi/* 系列接口的 w_rid + wts
 *   2) 扫码登录      —— /x/passport-login/web/qrcode/generate + /poll → Set/Cookie 落在 data.url 里
 *   3) 风控指纹       —— buvid3/buvid4(/x/frontend/finger/spi)、bili_ticket(GenWebTicket)、dm_* 参数
 *
 * 用法：
 *   node bili.js qr                    扫码登录并保存 cookies.json（终端打印二维码链接）
 *   node bili.js me                    当前登录态 /x/web-interface/nav
 *   node bili.js feed [ps]             首页推荐（wbi）
 *   node bili.js view BV1xx            视频详情 /x/web-interface/view
 *   node bili.js playurl BV1xx         取 DASH 音视频地址（wbi）
 *   node bili.js reply BV1xx           评论区（wbi）
 *   node bili.js search 关键词          综合搜索（wbi）
 *   node bili.js popular               热门
 *   node bili.js ranking               排行榜
 *   node bili.js dynamic <mid>         用户动态（wbi + dm_* 风控参数）
 *   node bili.js history               观看历史（需登录）
 */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const COOKIE_FILE = path.join(__dirname, 'cookies.json');

/* ------------------------------------------------------------------ *
 * WBI：从线上 JS 里挖出来的混排表（index-9ec3abf3.js 中的 ky() 函数）
 * ------------------------------------------------------------------ */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const keyFromUrl = (u) => u.slice(u.lastIndexOf('/') + 1).split('.')[0]; // .../7cd0....png -> 7cd0...

/* ------------------------------------------------------------------ */

class Bili {
  constructor() {
    this.cookies = {};           // name -> value（只保留 name/value，够用）
    this.wbi = null;             // { imgKey, subKey }
    this.mixinKey = null;
  }

  /* ---------------- cookie ---------------- */
  load() {
    if (fs.existsSync(COOKIE_FILE)) {
      try { this.cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')); } catch { this.cookies = {}; }
    }
    return this;
  }
  save() { fs.writeFileSync(COOKIE_FILE, JSON.stringify(this.cookies, null, 2)); return this; }
  cookieHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }
  setCookie(name, value) { this.cookies[name] = value; }

  /* ---------------- 基础请求 ---------------- */
  headers(extra = {}) {
    const h = {
      'user-agent': UA,
      referer: 'https://www.bilibili.com/',
      origin: 'https://www.bilibili.com',
      accept: 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9',
      ...extra,
    };
    const ck = this.cookieHeader();
    if (ck) h.cookie = ck;
    return h;
  }

  async request(url, { method = 'GET', form, binary = false, headers } = {}) {
    const opt = { method, headers: this.headers(headers) };
    if (form) {
      opt.headers['content-type'] = 'application/x-www-form-urlencoded';
      opt.body = new URLSearchParams(form).toString();
    }
    const res = await fetch(url, opt);
    if (binary) return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { code: -1, raw: text.slice(0, 500), httpStatus: res.status }; }
  }

  /* ---------------- 设备指纹 ---------------- */
  // buvid3 / buvid4：未登录时也要有，否则大量接口 -352
  async ensureBuvid() {
    if (this.cookies.buvid3 && this.cookies.buvid4) return;
    const j = await this.request('https://api.bilibili.com/x/frontend/finger/spi');
    if (j.code === 0) {
      this.cookies.buvid3 = j.data.b_3;
      this.cookies.buvid4 = j.data.b_4;
    }
  }

  // bili_ticket：ts + HMAC-SHA256(key="XgwSnGZ1p") 签名后换 JWT
  async ensureTicket() {
    const ts = Math.floor(Date.now() / 1000);
    const hexsign = crypto.createHmac('sha256', 'XgwSnGZ1p').update('ts' + ts).digest('hex');
    const url = `https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=${hexsign}&context[ts]=${ts}&csrf=${this.cookies.bili_jct || ''}`;
    const j = await this.request(url, { method: 'POST' });
    if (j.code === 0) {
      this.cookies.bili_ticket = j.data.ticket;
      this.cookies.bili_ticket_expires = String(ts + 259200);
    }
    return j;
  }

  /* ---------------- WBI ---------------- */
  async ensureWbi() {
    if (this.mixinKey) return;
    await this.ensureBuvid();
    const j = await this.request('https://api.bilibili.com/x/web-interface/nav');
    const img = keyFromUrl(j.data.wbi_img.img_url);
    const sub = keyFromUrl(j.data.wbi_img.sub_url);
    this.wbi = { imgKey: img, subKey: sub };
    const raw = img + sub;
    this.mixinKey = MIXIN_KEY_ENC_TAB.map((i) => raw[i]).join('').slice(0, 32);
  }

  /** params 排序 → 去 !'()* → urlencode → 拼 wts → md5(query+mixinKey) */
  sign(params = {}) {
    const withTs = { ...params, wts: Math.floor(Date.now() / 1000) };
    const query = Object.keys(withTs)
      .sort()
      .map((k) => {
        const v = String(withTs[k]).replace(/[!'()*]/g, '');
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      })
      .join('&');
    return `${query}&w_rid=${md5(query + this.mixinKey)}`;
  }

  async wbiGet(base, params = {}) {
    await this.ensureWbi();
    return this.request(`${base}?${this.sign(params)}`);
  }

  /* ---------------- 登录：扫码 ---------------- */
  async qrGenerate() {
    await this.ensureBuvid();
    return this.request('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
  }

  /**
   * data.code: 0 成功 / 86101 未扫码 / 86090 已扫码未确认 / 86038 二维码失效
   * 成功时 data.url 形如
   *   https://passport.biligame.com/crossDomain?DedeUserID=..&DedeUserID__ckMd5=..&Expires=..&SESSDATA=..&bili_jct=..&gourl=..
   * 同时还返回 refresh_token（用于 /x/passport-login/web/cookie/refresh 续期）
   */
  async qrPoll(qrcodeKey) {
    return this.request(
      `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}&source=main-fe-header`
    );
  }

  static parseSetCookies(pollData) {
    const out = {};
    try {
      const u = new URL(pollData.url);
      for (const [k, v] of u.searchParams) {
        if (['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'].includes(k)) out[k] = v;
      }
    } catch { /* ignore */ }
    return out;
  }

  async qrLogin({ intervalMs = 2000, timeoutMs = 180000 } = {}) {
    const gen = await this.qrGenerate();
    if (gen.code !== 0) throw new Error('qrcode/generate failed: ' + JSON.stringify(gen));
    const { url, qrcode_key } = gen.data;
    console.log('\n扫码地址（用 B 站 App 扫，或用任意二维码工具把该 URL 转成图）：');
    console.log('  ' + url);
    console.log('  qrcode_key = ' + qrcode_key + '\n');

    const deadline = Date.now() + timeoutMs;
    let last = -1;
    while (Date.now() < deadline) {
      const p = await this.qrPoll(qrcode_key);
      const c = p.data && p.data.code;
      if (c !== last) {
        console.log({ 0: '登录成功', 86101: '未扫码', 86090: '已扫码，等待确认', 86038: '二维码已失效' }[c] || `状态 ${c}`);
        last = c;
      }
      if (c === 0) {
        Object.assign(this.cookies, Bili.parseSetCookies(p.data));
        this.cookies.bili_ticket = this.cookies.bili_ticket || '';
        await this.ensureBuvid();
        await this.ensureTicket();
        const me = await this.request('https://api.bilibili.com/x/web-interface/nav');
        if (me.code === 0) {
          this.cookies.DedeUserID = String(me.data.mid);
          console.log(`登录成功：${me.data.uname} (mid=${me.data.mid}, vip=${me.data.vipStatus})`);
        }
        this.save();
        console.log('已写入 ' + COOKIE_FILE);
        return me;
      }
      if (c === 86038) throw new Error('二维码失效，请重新执行 qr');
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('轮询超时');
  }

  /* ---------------- 业务接口 ---------------- */
  nav() { return this.request('https://api.bilibili.com/x/web-interface/nav'); }

  // 首页推荐流（必须 wbi；fresh_type/fresh_idx 决定"刷新"分页）
  feed({ ps = 12, freshIdx = 1 } = {}) {
    return this.wbiGet('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd', {
      web_location: '1430650',
      feed_version: 'V8',
      fresh_type: '3',
      ps: String(ps),
      fresh_idx: String(freshIdx),
      fresh_idx_1h: '1',
      brush: String(freshIdx),
    });
  }

  view(bvid) { return this.request(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`); }

  // fnval=4048 表示 DASH + 全部特性；qn/fourk 决定清晰度上限
  async playurl(bvid, { fnval = 4048, fourk = 1 } = {}) {
    const v = await this.view(bvid);
    if (v.code !== 0) throw new Error('view failed ' + JSON.stringify(v));
    const { cid, aid } = v.data;
    const j = await this.wbiGet('https://api.bilibili.com/x/player/wbi/playurl', {
      bvid, cid: String(cid), fnval: String(fnval), fnver: '0', fourk: String(fourk),
    });
    return { view: v.data, playurl: j };
  }

  // 评论区（wbi）：pagination_str 是 JSON 字符串，首屏 offset 为空串
  reply(oid, { type = 1, mode = 3, pn = 1, ps = 20 } = {}) {
    return this.wbiGet('https://api.bilibili.com/x/v2/reply/wbi/main', {
      oid: String(oid), type: String(type), mode: String(mode),
      pagination_str: JSON.stringify({ offset: '' }), plat: '1', seek_rpid: '', web_location: '1315875',
    });
  }

  // 弹幕：protobuf 二进制分段，segment_index 每 6 分钟一段
  danmaku({ cid, pid, type = 1, segment = 1 }) {
    return this.request(
      `https://api.bilibili.com/x/v2/dm/web/seg.so?type=${type}&oid=${cid}&pid=${pid}&segment_index=${segment}`,
      { binary: true }
    );
  }

  search(keyword, { searchType = 'video', page = 1 } = {}) {
    return this.wbiGet('https://api.bilibili.com/x/web-interface/wbi/search/type', {
      search_type: searchType, keyword, page: String(page),
    });
  }

  popular({ ps = 20, pn = 1 } = {}) {
    return this.request(`https://api.bilibili.com/x/web-interface/popular?ps=${ps}&pn=${pn}`);
  }

  ranking({ rid = 0, type = 'all' } = {}) {
    return this.request(`https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=${type}`);
  }

  // 用户动态：不带 dm_* 会 412（request was banned）
  // dm_img_str/dm_cover_img_str 是 WebGL 版本与显卡渲染串的 base64
  dynamic(mid, { offset = '' } = {}) {
    return this.wbiGet('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space', {
      host_mid: String(mid),
      offset,
      timezone_offset: '-480',
      platform: 'web',
      features: 'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,decorationCard',
      web_location: '333.1387',
      dm_img_list: '[]',
      dm_img_str: 'V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ',
      dm_cover_img_str: 'QU5HTEUgKE5WSURJQSwgTlZJRElBIEdlRm9yY2UgUlRYIDUwNjAgKDB4MDAwMDJEMDUpIERpcmVjdDNEMTEgdnNfNV8wIHBzXzVfMCwgRDNEMTEpR29vZ2xlIEluYy4gKE5WSURJQSk',
      dm_img_inter: '{"ds":[],"wh":[0,0,0],"of":[0,0,0]}',
    });
  }

  // 用户投稿：命中 -412 时需要 w_webid（浏览器里由 du_web_sdk 生成的加密指纹）
  spaceArc(mid, { pn = 1, ps = 5 } = {}) {
    return this.wbiGet('https://api.bilibili.com/x/space/wbi/arc/search', {
      mid: String(mid), ps: String(ps), pn: String(pn), order: 'pubdate', index: '0',
      platform: 'web', web_location: '1550101',
      dm_img_list: '[]',
      dm_img_str: 'V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ',
      dm_cover_img_str: 'QU5HTEUgKE5WSURJQSwgTlZJRElBIEdlRm9yY2UgUlRYIDUwNjAgKDB4MDAwMDJEMDUpIERpcmVjdDNEMTEgdnNfNV8wIHBzXzVfMCwgRDNEMTEpR29vZ2xlIEluYy4gKE5WSURJQSk',
      dm_img_inter: '{"ds":[],"wh":[0,0,0],"of":[0,0,0]}',
    });
  }

  /* 需登录 */
  history({ max = 0, viewAt = 0 } = {}) {
    return this.request(
      `https://api.bilibili.com/x/web-interface/history/cursor?max=${max}&view_at=${viewAt}&business=archive&ps=20`
    );
  }
  toview() { return this.request('https://api.bilibili.com/x/v2/history/toview/web'); }
  favFolders(upMid) {
    return this.request(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${upMid}`);
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */
const [, , cmd, ...args] = process.argv;
const b = new Bili().load();

const out = (label, v) => console.log(`${label}:`, typeof v === 'string' ? v : JSON.stringify(v, null, 2));

(async () => {
  switch (cmd) {
    case 'qr': {
      await b.qrLogin();
      break;
    }
    case 'nav':
    case 'me': {
      const j = await b.nav();
      if (j.code === 0) {
        out('用户', { uname: j.data.uname, mid: j.data.mid, level: j.data.level_info && j.data.level_info.current_level, vip: j.data.vipStatus, money: j.data.money, wbi: j.data.wbi_img });
      } else out(`未登录 code=${j.code}`, j.message);
      break;
    }
    case 'feed': {
      const j = await b.feed({ ps: Number(args[0] || 5) });
      console.log('code=' + j.code);
      (j.data.item || []).forEach((it, i) =>
        console.log(`${i + 1}. ${it.title}\n   ${it.bvid}  ${it.owner && it.owner.name}  ▶${it.stat && it.stat.view}`));
      break;
    }
    case 'view': {
      const j = await b.view(args[0]);
      if (j.code !== 0) return out('err', j);
      const d = j.data;
      out('视频', { bvid: d.bvid, aid: d.aid, cid: d.cid, title: d.title, up: d.owner.name, mid: d.owner.mid, tname: d.tname, duration: d.duration, 播放: d.stat.view, 点赞: d.stat.like, 弹幕: d.stat.danmaku, 分P: d.pages.length });
      break;
    }
    case 'playurl': {
      const { view, playurl } = await b.playurl(args[0]);
      console.log('code=' + playurl.code, '清晰度可选=' + JSON.stringify(playurl.data && playurl.data.accept_quality));
      if (playurl.data && playurl.data.dash) {
        const v = playurl.data.dash.video[0], a = playurl.data.dash.audio[0];
        console.log('视频流:', `${v.id} ${v.width}x${v.height} ${v.codecs} ${Math.round(v.bandwidth / 1000)}kbps`);
        console.log('  ' + (v.baseUrl || v.base_url).slice(0, 120) + '...');
        console.log('音频流:', `${a.id} ${a.codecs} ${Math.round(a.bandwidth / 1000)}kbps`);
      } else if (playurl.data && playurl.data.durl) {
        console.log('durl(FLV/MP4):', playurl.data.durl[0].url.slice(0, 120) + '...');
      }
      break;
    }
    case 'reply': {
      const v = await b.view(args[0]);
      const j = await b.reply(v.data.aid);
      console.log('code=' + j.code, 'replies=' + ((j.data && j.data.replies) || []).length);
      ((j.data && j.data.replies) || []).slice(0, 5).forEach((r) =>
        console.log(`- ${r.member.uname} (Lv${r.member.level_info.current_level}): ${String(r.content.message).slice(0, 60)} [赞${r.like}]`));
      break;
    }
    case 'search': {
      const j = await b.search(args.join(' ') || '原神');
      console.log('code=' + j.code, 'numResults=' + (j.data && j.data.numResults));
      ((j.data && j.data.result) || []).slice(0, 5).forEach((r) =>
        console.log(`- ${r.title.replace(/<[^>]+>/g, '')}  ${r.bvid}  ${r.author}`));
      break;
    }
    case 'popular': {
      const j = await b.popular({ ps: 5 });
      (j.data.list || []).forEach((it, i) => console.log(`${i + 1}. ${it.title} [${it.bvid}]`));
      break;
    }
    case 'ranking': {
      const j = await b.ranking();
      (j.data.list || []).slice(0, 5).forEach((it, i) => console.log(`${i + 1}. ${it.title} [${it.bvid}]`));
      break;
    }
    case 'dynamic': {
      const j = await b.dynamic(args[0] || '546195');
      console.log('code=' + j.code, 'items=' + ((j.data && j.data.items) || []).length);
      ((j.data && j.data.items) || []).slice(0, 5).forEach((it) =>
        console.log(`- ${it.type} ${JSON.stringify((it.modules && it.modules.module_dynamic && it.modules.module_dynamic.desc && it.modules.module_dynamic.desc.text) || '').slice(0, 80)}`));
      break;
    }
    case 'space': {
      const j = await b.spaceArc(args[0] || '546195');
      console.log('code=' + j.code, j.message || '');
      break;
    }
    case 'history': {
      const j = await b.history();
      console.log('code=' + j.code + ' ' + (j.message || ''));
      ((j.data && j.data.list) || []).slice(0, 5).forEach((it) => console.log('- ' + it.title));
      break;
    }
    case 'danmaku': {
      const v = await b.view(args[0]);
      const buf = await b.danmaku({ cid: v.data.cid, pid: v.data.aid });
      const f = path.join(__dirname, `${v.data.bvid}.seg1.bin`);
      fs.writeFileSync(f, buf);
      console.log(`弹幕 protobuf ${buf.length} 字节 → ${f}`);
      break;
    }
    default:
      console.log('用法: node bili.js <qr|me|feed|view BV..|playurl BV..|reply BV..|search 词|popular|ranking|dynamic mid|space mid|history|danmaku BV..>');
  }
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
