/**
 * 短信登录一键脚本（逆向产物）
 *
 * 用法：
 *   set PHONE=132xxxx1160 & set CODE=123456 & node tools/sms-login.mjs
 *
 * 说明：
 *   - 短信登录必须过极验（geetest click），浏览器里人工点一次后，
 *     sms/send 会返回 captcha_key；本脚本从 sms-capture.log 里取最近一次 captcha_key。
 *   - login/sms 一次性：验证码用掉即失效（86205），失败要重新发短信 + 重新过极验。
 *   - 成功后把 Cookie 写入 login-demo/session.json（0600），不打印明文。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:\\Users\\chenhao\\Desktop\\bili_reverse';
const LOG = path.join(ROOT, 'sms-capture.log');
const SESSION = path.join(ROOT, 'login-demo', 'session.json');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

const PHONE = process.env.PHONE || '';
const CODE = process.env.CODE || '';
if (!PHONE || !CODE) {
  console.error('需要 PHONE 与 CODE 环境变量');
  process.exit(2);
}

/** 从监听日志里取最近一次 sms/send 返回的 captcha_key */
function latestCaptchaKey() {
  if (!fs.existsSync(LOG)) return null;
  const lines = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).reverse();
  for (const line of lines) {
    const m = line.match(/"captcha_key":"([0-9a-f]{32})"/);
    if (m) return m[1];
  }
  return null;
}

const ck = latestCaptchaKey();
if (!ck) {
  console.error('日志里没有 captcha_key：请先在浏览器完成极验，让短信发出去');
  process.exit(3);
}
console.log('captcha_key:', ck);

const body = new URLSearchParams({
  cid: '86',
  tel: PHONE,
  code: CODE,
  source: 'main_web',
  captcha_key: ck,
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
const text = await res.text();
let json = {};
try {
  json = JSON.parse(text);
} catch {
  /* ignore */
}

console.log('HTTP', res.status, '| code', json.code, '| msg', json.message, '| cookies', setCookie.length);
if (json.code !== 0 || !setCookie.length) {
  console.log('响应体:', text.slice(0, 300));
  process.exit(1);
}

const cookies = {};
for (const line of setCookie) {
  const [pair] = line.split(';');
  const i = pair.indexOf('=');
  if (i > 0) cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
}
fs.writeFileSync(
  SESSION,
  JSON.stringify({ savedAt: new Date().toISOString(), cookies, refreshToken: (json.data && json.data.refresh_token) || '' }, null, 2),
  { mode: 0o600 }
);
console.log('已写入 session.json →' , Object.keys(cookies).join(', '));
console.log('DedeUserID =', cookies.DedeUserID, '| SESSDATA 长度', String(cookies.SESSDATA).length);
if (json.data && json.data.hint) console.log('hint:', json.data.hint);
