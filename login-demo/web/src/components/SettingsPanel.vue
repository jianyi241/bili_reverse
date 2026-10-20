<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api.js'
import { useLog } from '../composables/useLog.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'saved'])

const { push } = useLog()

const cfg = ref(null)
const provider = ref('replicate')
const allowLocal = ref(false)
const model = ref('cjwbw/demucs')
const token = ref('')
const saving = ref(false)
const msg = ref('')

async function load() {
  const j = await api.getConfig()
  if (!j.ok) return
  cfg.value = j
  provider.value = j.separator.provider
  allowLocal.value = j.separator.allowLocal
  model.value = j.separator.replicateModel
  token.value = ''
}

async function save() {
  saving.value = true
  msg.value = ''
  const patch = { sepProvider: provider.value, allowLocal: allowLocal.value, replicateModel: model.value }
  if (token.value.trim()) patch.replicateToken = token.value.trim()
  const j = await api.saveConfig(patch)
  saving.value = false
  if (j.ok) {
    msg.value = '已保存到 ' + j.savedTo
    push('配置已更新：separator=' + provider.value + (token.value.trim() ? '，已写入 Replicate token' : ''), 'success')
    token.value = ''
    await load()
    emit('saved')
  } else {
    msg.value = '保存失败'
  }
}

onMounted(load)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="card w-[520px] rounded-xxl p-6">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <div class="text-xxl font-semibold text-fg-4">分析引擎设置</div>
          <div class="text-base text-fg-1">分离放云端、识别本来就在云端，本地不做模型推理</div>
        </div>
        <button class="btn-ghost !h-7 !px-2" @click="$emit('close')">✕</button>
      </div>

      <!-- 分离引擎 -->
      <div class="rounded-m border border-stroke bg-bg-0 p-3">
        <div class="mb-2 text-base font-medium text-fg-2">人声 / 伴奏分离</div>
        <label
          v-for="p in (cfg && cfg.options.providers) || []"
          :key="p.id"
          class="mb-1.5 flex cursor-pointer items-start gap-2 rounded-small px-1 py-1 last:mb-0 hover:bg-bg-1"
        >
          <input v-model="provider" type="radio" :value="p.id" class="mt-0.5 accent-[rgb(81_71_255)]" />
          <span class="text-lg text-fg-3">{{ p.label }}</span>
        </label>

        <div v-if="provider === 'replicate'" class="mt-2 space-y-2">
          <div class="flex items-center gap-2">
            <input v-model="token" type="password" class="field" placeholder="粘贴 r8_ 开头的 Replicate API Token" />
            <span v-if="cfg && cfg.separator.hasToken" class="chip chip-on flex-none">已配置 {{ cfg.separator.replicateToken }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-20 flex-none text-base text-fg-1">模型</span>
            <select v-model="model" class="field">
              <option v-for="m in (cfg && cfg.options.replicateModels) || []" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="text-mini text-fg-1">
            token 只写进本地 <code class="font-mono">.env</code>，不回传页面；Replicate 按秒计费，3 分钟视频约 $0.01–0.03。
          </div>
        </div>

        <div v-if="provider === 'local'" class="mt-2 space-y-2 rounded-small border border-warn/30 bg-warn/5 p-2">
          <label class="flex cursor-pointer items-center gap-2 text-base text-fg-2">
            <input v-model="allowLocal" type="checkbox" class="accent-[rgb(81_71_255)]" />
            我确认要用本地 CPU 跑 UVR 推理（会长时间占满 CPU）
          </label>
          <div class="text-mini text-fg-1">默认关闭，防止误触发把整机 CPU 吃满。</div>
        </div>
      </div>

      <!-- 识别 -->
      <div class="mt-3 rounded-m border border-stroke bg-bg-0 p-3">
        <div class="mb-1 flex items-center gap-2 text-base font-medium text-fg-2">
          歌曲识别
          <span class="rounded-full border border-success/30 bg-success/10 px-2 text-mini leading-5 text-success">云端</span>
        </div>
        <div class="text-base text-fg-1">
          Shazam（<code class="font-mono">shazamio</code>）在线指纹匹配，不占本地算力；识别率来自 Apple 曲库。
        </div>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <button class="btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        <button class="btn-secondary" @click="$emit('close')">关闭</button>
        <span class="text-base text-fg-1">{{ msg }}</span>
      </div>
    </div>
  </div>
</template>
