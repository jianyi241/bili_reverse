<script setup>
defineProps({
  user: { type: Object, default: null },
  theme: { type: String, default: 'light' },
})
defineEmits(['login', 'logout', 'toggle-theme', 'settings', 'sms-login'])
</script>

<template>
  <header class="sticky top-0 z-30 h-topbar border-b border-stroke bg-bg-3/90 backdrop-blur">
    <div class="mx-auto flex h-full max-w-content items-center gap-3 px-4 sm:px-6">
      <!-- 品牌：耳机 + 小电视 -->
      <a href="/" class="flex flex-none items-center" title="首页">
        <span class="grid h-9 w-9 place-items-center rounded-m bg-brand-5 text-white shadow-sm">
          <svg viewBox="0 0 40 40" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <!-- 耳机头梁 -->
            <path d="M8.5 21v-4.5a11.5 11.5 0 0 1 23 0V21" />
            <!-- 左右耳罩 -->
            <rect x="4.5" y="19" width="5.5" height="9.5" rx="2.75" fill="currentColor" stroke="none" />
            <rect x="30" y="19" width="5.5" height="9.5" rx="2.75" fill="currentColor" stroke="none" />
            <!-- 小电视 -->
            <rect x="11" y="20" width="18" height="13" rx="3.6" />
            <!-- 天线 -->
            <path d="M15.5 20 13 15.6M24.5 20 27 15.6" />
            <!-- 眼睛 -->
            <circle cx="16.6" cy="26.4" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="23.4" cy="26.4" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </span>
      </a>

      <div class="flex-1" />

      <!-- 引擎设置 -->
      <button class="btn-ghost" title="分析引擎设置（云端/本地）" @click="$emit('settings')">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        <span class="hidden sm:inline">引擎</span>
      </button>

      <!-- 主题切换 -->
      <button class="btn-ghost" :title="theme === 'dark' ? '切换到亮色' : '切换到暗色'" @click="$emit('toggle-theme')">
        <svg v-if="theme === 'dark'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
        <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" />
        </svg>
        <span class="hidden sm:inline">{{ theme === 'dark' ? '亮色' : '暗色' }}</span>
      </button>

      <!-- 右上角：登录 / 用户 -->
      <!-- 短信登录入口：登录后也保留，方便换号 -->
      <button class="btn-ghost flex-none" title="手机号 + 极验点选 + 验证码登录" @click="$emit('sms-login')">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="6" y="2.5" width="12" height="19" rx="3" />
          <path d="M10.5 18.5h3" />
        </svg>
        <span class="hidden sm:inline">短信登录</span>
      </button>

      <div v-if="user" class="flex flex-none items-center gap-2 rounded-ultra border border-stroke bg-bg-1 py-1 pl-1 pr-1 sm:gap-2.5 sm:pr-2">
        <img
          :src="'/api/img?u=' + encodeURIComponent(user.face)"
          referrerpolicy="no-referrer"
          class="h-7 w-7 rounded-full object-cover"
          alt=""
        />
        <div class="hidden leading-tight sm:block">
          <div class="max-w-[120px] truncate text-lg font-medium text-fg-3">{{ user.uname }}</div>
          <div class="text-mini text-fg-1">Lv{{ user.level }} · {{ user.vip }}</div>
        </div>
        <button class="btn-ghost !h-7 !w-7 !justify-center !px-0" title="退出登录" @click="$emit('logout')">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-5-4 5-4M4 12h11" />
          </svg>
        </button>
      </div>
      <button v-else class="btn-primary !h-9 flex-none" @click="$emit('login')">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
        </svg>
        <span class="hidden sm:inline">扫码登录</span>
      </button>
    </div>
  </header>
</template>
