import { reactive } from 'vue'

/** 全局日志（登录流程 + 接口调用都往这里打，页面底部 Log 面板展示） */
const state = reactive({ lines: [] })
let seq = 0

const fmt = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function useLog() {
  function push(text, level = 'info') {
    state.lines.push({ id: ++seq, time: fmt(), text, level })
    if (state.lines.length > 300) state.lines.splice(0, state.lines.length - 300)
  }
  function clear() {
    state.lines = []
  }
  return { log: state, push, clear }
}
