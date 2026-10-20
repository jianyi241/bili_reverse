/**
 * 云端能力：把「分离」搬到 Replicate，本地只做下载/转码/播放（不做模型推理）
 *  - replicateSeparate(): 取模型版本 → 上传文件 → POST /v1/predictions(version) → 轮询
 *                        → 下载 stems → ffmpeg amix 合成 instrumental
 *
 * 注意：Replicate 的 `POST /v1/models/{owner}/{name}/predictions` 只对官方模型可用，
 * 社区模型（cjwbw/demucs、ryan5453/demucs 都是社区的）会 404。必须显式带 version。
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPLICATE = 'https://api.replicate.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(token, pathname, opt = {}) {
  const res = await fetch(REPLICATE + pathname, {
    ...opt,
    headers: { authorization: `Bearer ${token}`, ...(opt.headers || {}) },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    throw new Error(`replicate ${pathname} → HTTP ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

/** 取模型最新版本 + 输入字段（社区模型必须用 version 建预测） */
async function modelMeta(token, model) {
  const j = await api(token, `/v1/models/${model}`);
  const v = j.latest_version || {};
  const props = ((((v.openapi_schema || {}).components || {}).schemas || {}).Input || {}).properties || {};
  return { version: v.id, fields: Object.keys(props), props };
}

/** 上传本地文件，返回 Replicate 可引用的 URL */
async function uploadFile(token, filePath) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('content', new Blob([buf]), path.basename(filePath));
  const j = await api(token, '/v1/files', { method: 'POST', body: fd });
  const url = (j.urls && j.urls.get) || j.url;
  if (!url) throw new Error('上传成功但没拿到文件 URL: ' + JSON.stringify(j).slice(0, 200));
  return url;
}

/** 输出可能是 {vocals,drums,bass,other} / {vocals,instrumental} / 数组，统一成 map */
function stemsFromOutput(out) {
  const map = {};
  const put = (key, val) => {
    if (typeof val === 'string' && /^https?:/.test(val)) map[key] = val;
    else if (val && typeof val === 'object' && typeof val.url === 'string') map[key] = val.url;
  };
  if (Array.isArray(out)) out.forEach((v, i) => put(`stem${i}`, v));
  else if (out && typeof out === 'object') for (const [k, v] of Object.entries(out)) put(k.toLowerCase(), v);
  return map;
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载 stem 失败 HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    let cp;
    try {
      cp = spawn(cmd, args, { windowsHide: true, env });
    } catch (e) {
      return resolve({ code: -1, err: String(e && e.message) });
    }
    let err = '';
    cp.stderr.on('data', (b) => (err += b.toString('utf8')));
    cp.on('error', (e) => resolve({ code: -1, err: err + e.message }));
    cp.on('close', (code) => resolve({ code, err }));
  });
}

/**
 * 云端分离
 * @returns {{vocalsPath, instPath, stems, model, version, predictionId}}
 */
async function replicateSeparate({ token, model, variant, inputFile, outDir, ffmpeg, onLog = () => {}, timeoutMs = 900000 }) {
  const m = model || 'cjwbw/demucs';

  const meta = await modelMeta(token, m);
  if (!meta.version) throw new Error('模型 ' + m + ' 没有可用版本');
  onLog('模型 ' + m + ' @ ' + meta.version.slice(0, 10) + '，输入字段：' + meta.fields.join(', '));

  const audioField = meta.fields.includes('audio') ? 'audio' : 'audio_path';
  onLog('上传音频（' + (fs.statSync(inputFile).size / 1048576).toFixed(1) + 'MB）…');
  const audioUrl = await uploadFile(token, inputFile);

  const input = { [audioField]: audioUrl };

  // 变体字段：cjwbw 用 model_name，ryan5453 用 model
  const variantField = meta.fields.includes('model_name') ? 'model_name' : meta.fields.includes('model') ? 'model' : null;
  if (variant && variantField) {
    input[variantField] = variant;
    onLog('变体：' + variantField + '=' + variant);
  } else if (variant && !variantField) {
    onLog('注意：' + m + ' 没有变体字段，已忽略 ' + variant);
  }
  if (meta.fields.includes('output_format')) input.output_format = 'wav';

  onLog('创建云端预测（version 模式）…');
  const created = await api(token, '/v1/predictions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: meta.version, input }),
  });
  const predId = created.id;
  if (!predId) throw new Error('创建预测失败：' + JSON.stringify(created).slice(0, 240));
  onLog('prediction=' + predId + ' 已提交，轮询（云端 GPU 推理，本地不跑模型）…');

  const t0 = Date.now();
  let cur = created;
  while (cur.status === 'starting' || cur.status === 'processing') {
    if (Date.now() - t0 > timeoutMs) throw new Error('Replicate 超时（' + Math.round(timeoutMs / 1000) + 's）');
    await sleep(4000);
    cur = await api(token, '/v1/predictions/' + predId);
    const last = String(cur.logs || '').trim().split('\n').filter(Boolean).pop();
    onLog('[' + cur.status + ' ' + Math.round((Date.now() - t0) / 1000) + 's] ' + (last || '').slice(0, 120));
  }
  if (cur.status !== 'succeeded') {
    throw new Error('Replicate ' + cur.status + '：' + (cur.error || JSON.stringify(cur).slice(0, 240)));
  }

  const stems = stemsFromOutput(cur.output);
  const keys = Object.keys(stems);
  onLog('云端返回 stems：' + keys.join(', '));
  if (!keys.length) throw new Error('预测成功但没有输出 stem：' + JSON.stringify(cur.output).slice(0, 240));

  const local = {};
  for (const k of keys) {
    const dest = path.join(outDir, `cloud_${k}.wav`);
    await downloadTo(stems[k], dest);
    local[k] = dest;
  }

  const env = { ...process.env, PATH: path.dirname(ffmpeg) + ';' + (process.env.PATH || '') };
  const vocalsPath = local.vocals || null;

  // 伴奏：优先直接给的 instrumental/accompaniment，否则把非人声轨 amix 起来
  let instPath = local.instrumental || local.accompaniment || null;
  if (!instPath) {
    const others = ['drums', 'bass', 'other', 'piano', 'guitar'].map((k) => local[k]).filter(Boolean);
    if (others.length === 1) instPath = others[0];
    else if (others.length > 1) {
      const dest = path.join(outDir, 'cloud_instrumental.wav');
      const args = ['-hide_banner', '-y'];
      others.forEach((f) => args.push('-i', f));
      args.push(
        '-filter_complex',
        `${others.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${others.length}:duration=longest:normalize=0[out]`,
        '-map',
        '[out]',
        dest
      );
      onLog('ffmpeg 合成伴奏（' + others.length + ' 轨 amix）…');
      const r = await run(ffmpeg, args, env);
      if (r.code !== 0) throw new Error('amix 失败：' + (r.err || '').slice(-200));
      instPath = dest;
    }
  }

  return { vocalsPath, instPath, stems: local, model: m, version: meta.version, predictionId: predId };
}

module.exports = { replicateSeparate, uploadFile, stemsFromOutput, modelMeta };
