/**
 * 极简 CDP 客户端：用来驱动/监听一个 Chrome 页面
 *  - connectPage(hint): 在 9222 端点里找页面（或新建），返回 {send, on, close, url}
 *  - 只用到 Network/Runtime/Page 三个域
 */
'use strict';

const EP = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';

async function listTargets() {
  const r = await fetch(EP + '/json/list');
  if (!r.ok) throw new Error('CDP 不可用：' + EP + ' HTTP ' + r.status);
  return r.json();
}

async function version() {
  const r = await fetch(EP + '/json/version');
  if (!r.ok) throw new Error('CDP 不可用：' + EP);
  return r.json();
}

/** 新建标签页并连上 */
async function newPage(url) {
  const r = await fetch(EP + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!r.ok) throw new Error('新建标签页失败 HTTP ' + r.status);
  return r.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 连上一个页面
 * @param {(t:{url:string,title:string})=>boolean} match 匹配已有标签
 * @param {string} fallbackUrl 没有匹配时打开的地址
 */
async function connectPage(match, fallbackUrl = 'https://passport.bilibili.com/login') {
  const targets = (await listTargets()).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  let target = targets.find((t) => match(t));
  if (!target) target = await newPage(fallbackUrl);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const handlers = new Map(); // method -> [fn]

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pend.has(msg.id)) {
      const { resolve, reject } = pend.get(msg.id);
      pend.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method && handlers.has(msg.method)) {
      for (const fn of handlers.get(msg.method)) {
        try { fn(msg.params); } catch { /* ignore */ }
      }
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pend.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => {
        if (pend.has(i)) { pend.delete(i); reject(new Error('CDP 超时: ' + method)); }
      }, 20000);
    });

  const on = (method, fn) => {
    if (!handlers.has(method)) handlers.set(method, []);
    handlers.get(method).push(fn);
  };

  const close = () => { try { ws.close(); } catch { /* ignore */ } };

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('页面脚本异常: ' + (r.exceptionDetails.text || ''));
    return r.result && r.result.value;
  };

  return { send, on, close, evaluate, url: target.url, targetId: target.id, sleep };
}

module.exports = { connectPage, listTargets, version, newPage, sleep };
