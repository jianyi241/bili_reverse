# 设计决策（AuraVideo 暗色版）

## 1. 参考稿拆解（Stitch 稿）

| 区域 | 参考稿做法 | 本项目落地 |
|---|---|---|
| 顶栏 | 56–64px，左 Logo + 一级导航，中搜索框，右 上传/通知/头像 | 64px，同一结构；搜索框 320–480px 自适应 |
| 主播放区 | 16:9 大播放器占 2/3，右侧是可滚动的「推荐」列 | `grid-cols-[minmax(0,1fr)_320px]`，右侧 sticky |
| 视频信息 | 标题 20–24px + 一排数据（播放/评论/收藏/分享）+ 操作按钮（点赞/投币/收藏/分享） | 同左；操作按钮做视觉，点赞数取真实 stat |
| UP 主条 | 头像 + 名称 + 粉丝 + 关注按钮 + 简介 | 同左，粉丝数来自 `relation/stat` |
| 评论 | 独立大卡，含输入框 + 排列表 + 分页 | 输入框占位（后端未做发评论），列表真实数据 |
| 卡片网格 | 4 列（宽屏）/ 3 列 / 2 列；卡片含封面时长、标题 2 行、UP+播放量 | 同左 |
| 分类 chips | 胶囊，选中态为品牌色填充 | 同左 |
| 底部 | 极简 footer，一行版权 + 链接 | 同左 |

## 2. 配色（暗色 only，第一期）

```
--bg-0    #08080B   页面底
--bg-1    #0E0E13   区块
--bg-2    #14141B   卡片
--bg-3    #1B1B24   悬浮/输入
--line    rgba(255,255,255,.07)
--line-2  rgba(255,255,255,.12)
--fg-1    #F4F5F8   主文本
--fg-2    #A8ACBB   次文本
--fg-3    #6E7285   弱文本
--brand   #7C5CFF   品牌（紫色，沿用 coze 品牌色系）
--brand-2 #22D3EE   强调（数据高亮/在线点）
--danger  #FF4D4F
--ok      #22C55E
```

渐变：`linear-gradient(135deg,#7C5CFF,#4F46E5)` 用于主按钮与选中 chip。

> 用 CSS 变量 + Tailwind `theme.extend.colors` 映射（`bg-bg-2` / `text-fg-2`），
> 第二期加亮色只需补一套变量，不动组件。

## 3. 字体与字号

- 字体：`Inter, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
- 字号：12 / 13 / 14（正文）/ 16 / 20（区块标题）/ 24（页面标题）
- 字重：400 / 500 / 600，不超过 600
- 数字用 `font-variant-numeric: tabular-nums`（播放量对齐）

## 4. 圆角 / 阴影

| token | 值 | 用途 |
|---|---|---|
| `rounded-sm` | 6px | 小标签 |
| `rounded` | 8px | 按钮/输入 |
| `rounded-lg` | 12px | 卡片 |
| `rounded-xl` | 16px | 大容器/播放器 |
| `rounded-full` | 9999px | 头像/chips |

阴影只在 hover 与弹层用：`0 8px 30px rgba(0,0,0,.45)`；卡片本身靠边框分层，不堆阴影。

## 5. 图标

全部自绘 SVG，统一 `viewBox="0 0 24 24"`、`stroke="currentColor"`、`stroke-width=1.8`、圆角端点。
放在 `app/src/components/Icons.jsx`，一个组件导出全部图标，禁止引入 icon 库。

需要的图标：Home / Compass / Grid / TrendingUp / Search / Upload / Bell / User / Play / Pause /
Volume / VolumeOff / Maximize / Minimize / Settings / Download / Heart / Star / Share / Message /
ChevronLeft / ChevronRight / Music / Film / Sparkles / Check。

## 6. 播放器

自研（`components/Player.jsx`）：

- 数据源：`/api/video/file?bvid=&q=`（服务端 ffmpeg 合流后的 mp4，支持 Range）
- 控制条：进度（可拖动 + hover 预览时间）、播放/暂停、时间、音量、倍速（0.75/1/1.25/1.5/2）、画中画、全屏
- 自动隐藏控制条（2.5s 无操作），鼠标移动恢复
- 键盘：空格播放/暂停，←/→ 5s，F 全屏，M 静音
- 状态：`loading`（合流中）→ `ready` → `playing`

选型记录：暂不引 `plyr`/`vidstack`——我们只有单一 mp4 源，自绘 400 行内可控且样式统一；
第二期若要做 HLS/DRM 再评估 `vidstack`（React 友好、支持自定义 layout）。

## 7. 路由

`react-router-dom`，三条路由：

```
/            首页（热门 + 分类）
/search      搜索结果
/watch/:bvid 观看页
```

## 8. 与后端集成

Vite dev 用 `server.proxy` 把 `/api` 转到 `127.0.0.1:18787`；
生产构建产物放 `login-demo/app/dist`，由 `server.js` 在 `/app` 前缀下静态提供（SPA fallback）。
