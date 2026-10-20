/**
 * 极简 .env 读写（不引入 dotenv）
 * 优先级：process.env > .env 文件
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '.env');
const store = {};

function load() {
  if (!fs.existsSync(FILE)) return;
  for (const line of fs.readFileSync(FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    store[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function get(key, fallback = '') {
  const fromEnv = process.env[key];
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return store[key] || fallback;
}

function set(key, value) {
  if (value === undefined || value === null || value === '') delete store[key];
  else store[key] = String(value);
  try {
    const body = Object.entries(store).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    fs.writeFileSync(FILE, body, { mode: 0o600 });
  } catch (e) {
    console.error('[env] 写入 .env 失败:', e.message);
  }
}

function all() {
  return { ...store };
}

/** 只暴露"是否配置过"和尾部 4 位，绝不回传完整 key */
function masked(value) {
  if (!value) return null;
  return value.length <= 8 ? '****' : `••••${value.slice(-4)}`;
}

module.exports = { load, get, set, all, masked, FILE };
