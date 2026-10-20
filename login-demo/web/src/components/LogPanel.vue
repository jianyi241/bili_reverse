<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  open: { type: Boolean, default: true },
})
defineEmits(['toggle', 'clear'])

const box = ref(null)
watch(
  () => props.lines.length,
  async () => {
    await nextTick()
    if (box.value) box.value.scrollTop = box.value.scrollHeight
  }
)

const color = {
  info: 'text-fg-2',
  success: 'text-success',
  error: 'text-danger',
  warn: 'text-warn',
}
</script>

<template>
  <section class="card overflow-hidden">
    <div class="flex items-center gap-2 border-b border-stroke px-4 py-2.5">
      <span class="text-xxl font-semibold text-fg-4">Log</span>
      <span class="rounded-full border border-stroke bg-bg-1 px-2 text-mini leading-5 text-fg-1">{{ lines.length }}</span>
      <div class="flex-1" />
      <button class="btn-ghost !h-7 !px-2 text-base" @click="$emit('toggle')">{{ open ? '收起' : '展开' }}</button>
      <button class="btn-ghost !h-7 !px-2 text-base" @click="$emit('clear')">清空</button>
    </div>

    <div v-show="open" ref="box" class="h-[200px] overflow-auto bg-bg-0 px-4 py-2 font-mono text-base leading-relaxed">
      <div v-if="!lines.length" class="py-8 text-center font-sans text-base text-fg-1">暂无日志，登录或搜索后这里会打印请求记录</div>
      <div v-for="l in lines" :key="l.id" class="flex gap-2">
        <span class="flex-none text-fg-1">[{{ l.time }}]</span>
        <span :class="color[l.level] || 'text-fg-2'">{{ l.text }}</span>
      </div>
    </div>
  </section>
</template>
