/**
 * 短信登录状态机（把「极验点选」抛给用户，结果回传后由服务端完成发短信/登录）
 *
 * 流程：
 *   start(phone)   → 打开/复用 bilibili 登录页，切「短信登录」，填手机号，点「获取验证码」
 *                  → 极验弹窗出现（用户点选）→ 页面自己调 sms/send
 *   [CDP 监听]      → 抓到 sms/send 的请求体(token/validate/challenge/seccode) 与响应(captcha_key)
 *   login(code)    → 服务端调 login/sms，写 session.json
 *
 * 为什么必须用 CDP：极验的 validate 只能由 passport.bilibili.com 页面里的极验 JS 生成，
 * 跨域页面既拿不到 challenge，也读不到别的窗口的网络。
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const cdp = require('./cdp');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
];
const PROFILE = path.join(__dirname, '..', '..', 'profile-cdp2');

const SESSION = {
  stage: 'idle', // idle | opening | geetest | sent | logging | done | error
  phone: '',
  hint: '',
  error: '',
  captchaKey: '',
  geetest: null, // { token, validate, challenge, seccode }
  user: null,
  startedAt: 0,
  cookieList: null,
};

let conn = null;
let chromeProc = null;

const mask = (p) => (p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '');

function snapshot() {
  return {
    ok: true,
    stage: SESSION.stage,
    phone: mask(SESSION.phone),
    hint: SESSION.hint,
    error: SESSION.error,
    hasCaptchaKey: !!SESSION.captchaKey,
    geetest: SESSION.geetest
      ? {
          token: SESSION.geetest.token.slice(0, 8) + '…',
          challenge: SESSION.geetest.challenge.slice(0, 8) + '…',
          validate: SESSION.geetest.validate.slice(0, 8) + '…',
          seccodeSuffix: '|jordan',
        }
      : null,
    user: SESSION.user,
    elapsedMs: SESSION.startedAt ? Date.now() - SESSION.startedAt : 0,
  };
}

async function ensureChrome() {
  try {
    await cdp.version();
    return;
  } catch {
    /* 需要拉起 Chrome */
  }
  const exe = CHROME_CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!exe) throw new Error('找不到 Chrome，请手动启动并加 --remote-debugging-port=9222');
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  chromeProc = spawn(
    exe,
    ['--remote-debugging-port=9222', '--user-data-dir=' + PROFILE, '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', 'https://passport.bilibili.com/login'],
    { detached: true, stdio: 'ignore' }
  );
  chromeProc.unref();
  for (let i = 0; i < 40; i++) {
    await cdp.sleep(500);
    try {
      await cdp.version();
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error('Chrome 启动超时（9222 未就绪）');
}

/** 监听 sms/send 与 login/sms */
function hookNetwork(page) {
  const pending = new Map();
  page.on('Network.requestWillBeSent', (p) => {
    const r = p.request;
    if (!/passport-login\/web\/(sms\/send|login\/sms)/.test(r.url)) return;
    pending.set(p.requestId, { url: r.url, post: r.postData || '' });
  });
  page.on('Network.responseReceived', (p) => {
    if (!/passport-login\/web\/sms\/send/.test(p.response.url)) return;
    SESSION.hint = '极验已通过，正在发送短信…';
  });
  page.on('Network.loadingFinished', async (p) => {
    const info = pending.get(p.requestId);
    if (!info) return;
    pending.delete(p.requestId);
    try {
      const body = await page.send('Network.getResponseBody', { requestId: p.requestId });
      const json = JSON.parse(body.body);
      if (/sms\/send/.test(info.url)) {
        const params = new URLSearchParams(info.post);
        SESSION.geetest = {
          token: params.get('token') || '',
          validate: params.get('validate') || '',
          challenge: params.get('challenge') || '',
          seccode: params.get('seccode') || '',
        };
        if (json.code === 0 && json.data && json.data.captcha_key) {
          SESSION.captchaKey = json.data.captcha_key;
          SESSION.stage = 'sent';
          SESSION.hint = '验证码已发送，请在 10 分钟内填写（有效期内可重复提交）';
        } else {
          SESSION.stage = 'error';
          SESSION.error = `短信发送失败：${json.code} ${json.message}（极验没过就再点一次）`;
        }
      }
    } catch (e) {
      SESSION.error = '读取响应失败: ' + e.message;
    }
  });
}

/** 打开登录页 → 切短信 tab → 填手机号 → 点「获取验证码」 */
async function driveToGeetest(page, phone) {
  await page.send('Page.enable');
  await page.send('Network.enable');
  hookNetwork(page);

  // 已登录状态下打开 /login 会被重定向到首页，短信 tab 就不存在了 → 先清掉 bilibili 的 cookie
  try {
    await page.send('Network.clearBrowserCookies');
    SESSION.hint = '已清理浏览器登录态，打开登录页…';
  } catch { /* ignore */ }

  await page.send('Page.navigate', { url: 'https://passport.bilibili.com/login' });
  for (let i = 0; i < 30; i++) {
    await cdp.sleep(500);
    const ready = await page.evaluate(`!!document.querySelector('input[placeholder="请输入手机号"], input[placeholder="请输入账号"]')`);
    if (ready) break;
  }

  // 切「短信登录」
  await page.evaluate(`(()=>{
    const t=[...document.querySelectorAll('div,span')].find(e=>e.textContent.trim()==='短信登录' && e.children.length===0);
    if (t) t.click();
    return !!t;
  })()`);
  await cdp.sleep(600);

  // 填手机号（React 受控组件需要 native setter + input 事件）
  const filled = await page.evaluate(`(()=>{
    const i=document.querySelector('input[placeholder="请输入手机号"]');
    if(!i) return false;
    const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    s.call(i, ${JSON.stringify(phone)});
    i.dispatchEvent(new Event('input',{bubbles:true}));
    i.dispatchEvent(new Event('change',{bubbles:true}));
    return i.value === ${JSON.stringify(phone)};
  })()`);
  if (!filled) throw new Error('手机号输入框没找到或填不进去（页面结构可能变了）');

  // 点「获取验证码」/「重新发送」
  const clicked = await page.evaluate(`(()=>{
    const e=[...document.querySelectorAll('div.clickable')].find(x=>/获取验证码|重新发送/.test(x.textContent.trim()));
    if(!e) return false;
    e.click();
    return true;
  })()`);
  if (!clicked) throw new Error('找不到「获取验证码」按钮');

  await page.send('Page.bringToFront').catch(() => {});
}

/** 截取极验面板（用户在我们的面板里点，坐标再转发回真页面） */
async function captureGeetest() {
  if (!conn) return { ok: false, active: false, message: '还没有建立 CDP 连接（先点发送验证码）' };
  const rect = await conn.evaluate(`(()=>{
    const b = document.querySelector('.geetest_panel_box') || document.querySelector('.geetest_widget');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return null;
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  })()`);
  if (!rect) return { ok: true, active: false, message: '极验面板没打开（可能已通过或已关闭）' };
  const shot = await conn.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
    captureBeyondViewport: false,
  });
  const tip = await conn.evaluate(`(()=>{
    const t = document.querySelector('.geetest_tip, .geetest_tips');
    return (t && t.textContent.trim()) || (document.body.innerText.match(/请在下图[^\\n]*/) || [''])[0];
  })()`);
  return {
    ok: true,
    active: true,
    png: 'data:image/png;base64,' + shot.data,
    rect,
    tip,
    stage: SESSION.stage,
  };
}

/**
 * 把用户在我们面板上的点击，转发成真页面里的受信任鼠标事件
 * @param {{x:number,y:number}[]} points 相对截图的坐标（截图左上角为原点）
 */
async function clickGeetest(points) {
  if (!conn) throw new Error('CDP 未连接');
  const cap = await captureGeetest();
  if (!cap.active) throw new Error('极验面板已经关闭了');
  const { rect } = cap;
  const used = [];
  for (const p of points.slice(0, 12)) {
    const x = rect.x + Math.max(0, Math.min(rect.width - 1, Math.round(p.x)));
    const y = rect.y + Math.max(0, Math.min(rect.height - 1, Math.round(p.y)));
    // 真实用户是「移动 → 按下 → 抬起」，这里照做，让极验的轨迹采样有数据
    await conn.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 });
    await cdp.sleep(60);
    await conn.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
    await cdp.sleep(50);
    await conn.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
    used.push({ x, y });
    await cdp.sleep(220);
  }
  SESSION.hint = `已转发 ${used.length} 次点击，等待极验校验…`;
  return { ok: true, forwarded: used, rect };
}

/** 把承载极验的窗口挪到屏幕外：用户全程只在我们的页面操作，看不到 B 站窗口 */
async function parkWindow(page) {
  try {
    const { windowId } = await page.send('Browser.getWindowForTarget', { targetId: page.targetId });
    await page.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: -3200, top: 0, width: 1280, height: 900, windowState: 'normal' },
    });
    SESSION.hint = '已把验证窗口移到屏幕外，所有操作都在本页面完成';
  } catch (e) {
    /* 部分平台不支持 setWindowBounds，忽略 */
  }
}

async function start(phone) {
  if (!/^1\d{10}$/.test(phone)) throw new Error('手机号格式不对（需要 11 位）');
  Object.assign(SESSION, {
    stage: 'opening',
    phone,
    hint: '正在打开 B 站登录页…',
    error: '',
    captchaKey: '',
    geetest: null,
    user: null,
    startedAt: Date.now(),
  });

  await ensureChrome();
  if (conn) {
    try { conn.close(); } catch { /* ignore */ }
  }
  conn = await cdp.connectPage((t) => /passport\.bilibili\.com\/login/.test(t.url), 'https://passport.bilibili.com/login');
  try {
    await driveToGeetest(conn, phone);
    await parkWindow(conn);
    SESSION.stage = 'geetest';
    SESSION.hint = '极验面板已镜像到本页面，直接在这里点选（B 站窗口已移到屏幕外）';
  } catch (e) {
    SESSION.stage = 'error';
    SESSION.error = e.message;
    throw e;
  }
  return snapshot();
}

/** 用验证码完成登录，写 session.json */
async function loginWithCode(code) {
  if (!/^\d{6}$/.test(code)) throw new Error('验证码应为 6 位数字');
  if (!SESSION.captchaKey) throw new Error('还没有拿到 captcha_key：请先发短信并通过极验');
  SESSION.stage = 'logging';
  SESSION.hint = '正在登录…';

  const body = new URLSearchParams({
    cid: '86',
    tel: SESSION.phone,
    code,
    source: 'main_web',
    captcha_key: SESSION.captchaKey,
    go_url: '',
  });
  const res = await fetch('https://passport.bilibili.com/x/passport-login/web/login/sms', {
    method: 'POST',
    headers: {
      'user-agent': UA,
      referer: 'https://passport.bilibili.com/login',
      origin: 'https://passport.bilibili.com',
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json, text/plain, */*',
    },
    body,
  });
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  let json = {};
  try { json = JSON.parse(await res.text()); } catch { /* ignore */ }

  if (json.code !== 0 || !setCookie.length) {
    SESSION.stage = 'sent';
    SESSION.error = `登录失败：${json.code} ${json.message || ''}`;
    throw new Error(SESSION.error);
  }

  const cookies = {};
  for (const line of setCookie) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i > 0) cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  fs.writeFileSync(
    path.join(__dirname, '..', 'session.json'),
    JSON.stringify({ savedAt: new Date().toISOString(), cookies, refreshToken: (json.data && json.data.refresh_token) || '' }, null, 2),
    { mode: 0o600 }
  );

  // 同步到浏览器，页面也变成已登录
  try {
    if (conn) {
      await conn.send('Network.setCookies', {
        cookies: Object.entries(cookies).map(([name, value]) => ({
          name, value, domain: '.bilibili.com', path: '/', secure: true, sameSite: 'Lax',
        })),
      });
    }
  } catch { /* ignore */ }

  SESSION.stage = 'done';
  SESSION.hint = '登录成功，session.json 已更新';
  SESSION.error = '';
  SESSION.user = { mid: cookies.DedeUserID, hint: json.data && json.data.hint };
  SESSION.cookieList = Object.keys(cookies);
  return snapshot();
}

function reset() {
  Object.assign(SESSION, {
    stage: 'idle', phone: '', hint: '', error: '', captchaKey: '', geetest: null, user: null, startedAt: 0, cookieList: null,
  });
  try { if (conn) { conn.close(); conn = null; } } catch { /* ignore */ }
  return snapshot();
}

module.exports = { start, loginWithCode, snapshot, reset, captureGeetest, clickGeetest, SESSION };
