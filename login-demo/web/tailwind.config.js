/**
 * Tailwind 配置（Vue 应用）
 * 设计 token 的唯一真源：C:\Users\chenhao\.agents\skills\coze-style\
 * 本目录下的 tailwind.preset.cjs 与 coze-tokens.css 是同步副本，改样式请先改 skill 再同步过来。
 */
module.exports = {
  presets: [require('./tailwind.preset.cjs')],
  content: ['./index.html', './src/**/*.{vue,js}'],
}
