import { ref } from 'vue'

const KEY = 'coze-theme'
const initial = localStorage.getItem(KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
const theme = ref(initial)
document.documentElement.classList.toggle('dark', theme.value === 'dark')

export function useTheme() {
  function set(next) {
    theme.value = next
    localStorage.setItem(KEY, next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }
  const toggle = () => set(theme.value === 'dark' ? 'light' : 'dark')
  return { theme, set, toggle }
}
