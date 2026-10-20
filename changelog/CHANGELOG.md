# Changelog

本项目所有值得记录的变更都写在这里。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [2.1.0] — 2026-10-20

### Added — 听影 UI（用户提供的 Figma Make 稿）接入真实接口
- 新建 `login-demo/ui`：React 19 + Vite 8 + Tailwind v4（原稿样式**未改动**，只改数据层）
- 新增 `ui/src/api.ts`：`feed / video / prepare / progress / comments / analyze / analyzeStatus / fav / user / qr / poll / reset`
- 首页：`/api/popular` 真实列表（标题/封面/UP/播放/点赞/评论/时长/分类/时间），分类 chips 由真实 `tname` 派生
- 播放页：真实 `<video>` 播放 `/api/video/file`（ffmpeg 合流 + Range），进度条/时间/静音/全屏绑定真实元素
- 「听视频」：切到 `/api/audio/stream` 纯音频流，画面变成转盘 + 均衡器（保留原设计）
- 识别歌曲：`/api/analyze mode=tracklist` 真实曲目表（时间轴 + 曲名 + 艺人 + Shazam 链接）
- 人声分离：`/api/analyze mode=full` 真实 stems（人声/伴奏可试听、可下载）
- 评论：`/api/comments` 真实评论流（分页加载、点赞数、IP 属地）
- 我的：`/api/user` + `/api/fav` 真实资料（昵称/等级/大会员/粉丝/收藏夹数与列表）
- 扫码登录：`/api/qr` + `/api/poll` 真实二维码，登录后头部显示头像，弹窗可重新获取
- 顶栏「投稿」按钮已删除（按需求）

### Changed
- `server.js` `/api/popular` 增加 `like/reply/danmaku/favorite/duration/pubdate/tname/owner{mid,name,face}`，卡片一次请求拿全
- `server.js` 新增 `/ui` 静态托管（`login-demo/ui/dist`，SPA 回退）

### Verified
- 首页 20 张卡片全部真实数据，40 张图片（封面+头像）全部加载
- 播放页 `BV1K6nE6nE2e`：`duration=619s`、`readyState=4`、可播放（1:48 画面实测）
- 未登录态：点「登录」弹窗显示真实二维码（`qrLoaded=true`）
- 登录态：我的页显示 `简逸233 · 年度大会员 · Lv6 · UID 344972549 · 39 粉丝 · 100 个收藏夹`

### Notes
- 「音视频识别」「人声分离」两个工具页仍是**未接入**状态（原本是假进度），现在直接写明原因，不伪装
- 发评论 / 点赞 / 投币 / 收藏 / 关注：仍为视觉态（需要 csrf 且会改真实账号数据）

## [2.0.0-phase2] — 2026-10-20

### Added — 合流进度（BLOCKERS B6 的解法）
- 服务端：ffmpeg 加 `-progress pipe:1 -nostats`，逐行解析 `out_time` → 百分比；
  `speed` 做指数平滑（0.7 旧 + 0.3 新），`eta` 不再乱跳
- 新接口 `GET /api/video/progress?bvid=&q=` → `{running, done, percent, outTime, duration, speed, eta}`
- 播放器 loading 态：环形 spinner + 进度条 + 百分比 + 已合流/总时长 + 倍速 + 剩余时间
- 实测 `BV1K6nE6nE2e`（10:20 / 620s）：1% → 39% 每秒推一次，`speed` 从 0.78× 收敛到 2.7×，
  `prepare` 总耗时 133s，进度与真实 out_time 一致

### Added — 断点续播
- `Player` 每 5s 把 `currentTime` 写入 `localStorage['aura:pos:<bvid>']`
- 再次打开同一视频，`loadedmetadata` 后自动 seek 回上次位置（距结尾 10s 内视为看完，从头播）
- 实测：预置 120s → 打开后 `currentTime=120.0`，`duration=619`

### Fixed
- 切换清晰度时残留上一条合流信息（"命中缓存/1080P"）→ 重置 `info`/`progress`

## [2.0.0-phase1] — 2026-10-20

### Added — 新前端 React（暗色）
- 新建 `login-demo/app`：React 18 + Vite 6 + Tailwind 3，仅暗色主题
- 路由：`/`（首页）、`/search`（搜索）、`/watch/:bvid`（观看页），`react-router-dom`
- 首页：Hero 大卡 + 分类 chips + 响应式卡片网格（2/3/4 列）
- 观看页：大播放器 + 右侧推荐列 + 视频信息区 + UP 主条 + 评论流
- 自研播放器 `Player.jsx`：进度/音量/倍速/画中画/全屏、控制条自动隐藏、键盘快捷键
- 自绘 SVG 图标集 `Icons.jsx`（24×24，stroke 1.8，无图标库依赖）

### Added — 文档与规范
- `doc/ROADMAP.md` 四阶段路线图
- `doc/DESIGN.md` 设计稿拆解、暗色 token、字体/圆角/阴影、播放器选型
- `doc/BLOCKERS.md` 10 项阻塞与取舍（上传/点赞/弹幕/Electron/防盗链等）
- `changelog/CHANGELOG.md` 本文件
- 新 skill `aura-dark-style`：暗色视频站 token + 组件配方（供后续页面统一）

### Changed
- `server.js` 增加 `/app` 静态托管（`login-demo/app/dist`，含 SPA fallback）
- 旧 Vue 前端（`login-demo/web`）保留在 `/`，作为功能参照，两套并存

### Notes
- 点赞/投币/收藏/关注/发评论/上传/通知：**入口存在但未接后端**（见 BLOCKERS B1/B2/B3）
- 播放器数据源为 `/api/video/file?bvid=&q=`（服务端 ffmpeg 合流落盘 + Range）

### 实测数据（2026-10-20，1600×1000 视口）
- 首页：21 张封面全部加载，4 列网格，Hero 420px
- 观看页：`BV1K6nE6nE2e`（17:00，325.5MB）→ 合流完成后 `<video>` `duration=619s readyState=4`，进度可拖动
- 评论：`515` 条总数，首页 20 条渲染正常
- 右侧推荐：10 条，来自 `/api/popular`

### 运行方式
- 开发：`cd login-demo/app && npm run dev` → http://127.0.0.1:18790/app/（`/api` 代理到 18787）
- 生产：`npm run build` → 后端在 http://127.0.0.1:18787/app/ 提供（`/app` 前缀 + SPA 回退）

### 已知问题
- 大文件首次合流慢（17 分钟视频约 30–60s），前端只有 loading 文案，没有百分比（见 BLOCKERS B6）

## [1.9.1] — 2026-10-20

### Added
- 视频播放与下载：`/api/video/prepare` / `file` / `download` / `stream`
- 服务端 ffmpeg 合流（video+audio → mp4），`+faststart` 落盘，支持 Range 拖动
- 清晰度选择（1080P/64/32/16），优先 H.264，缺档自动降档

### Fixed
- 合流不能 pipe：fragmented mp4 浏览器 `duration` 只有 5.1s → 改为落盘 + Range

## [1.9.0] — 2026-10-20

### Added
- 卡片式布局（响应式 1/2/3 列）、新 SVG Logo（耳机 + 小电视）、去掉页面标题文字
- 仅音频播放 `/api/audio` + `/api/audio/stream`（Range 转发）
- 评论 `/api/comments`（WBI，失败回落老接口）
- 视频详情 `/api/video`（播放/点赞/UP 主/粉丝数），10 分钟缓存
- 图片代理内存缓存（300 条）

## [1.8.0] — 2026-10-20

### Added
- 短信登录（方式二）：极验点选**镜像到本页面**，坐标经 CDP `Input.dispatchMouseEvent` 转发回真页面
- `/api/sms/start|status|login|reset`，`lib/sms.js` 状态机，`lib/cdp.js` 极简 CDP 客户端
- B 站窗口移至屏幕外，用户全程只面对本项目页面

### Fixed
- 已登录状态访问 `/login` 会被重定向 → 先 `Network.clearBrowserCookies`

## [1.7.0] — 2026-10-20

### Added
- 全片扫描 `mode=tracklist`：12s 窗 / 10s 步进 + 并发识别 + 相邻同曲合并 + 去重
- 识别结果本地缓存 `shazam_cache.json`，限流自动止损
- 修复 Windows Python stdout cp936 导致中文曲名乱码（`PYTHONIOENCODING=utf-8`）
