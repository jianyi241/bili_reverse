# 项目路线图（AuraVideo · bilibili 逆向验证台 2.0）

参考设计：Google Stitch 项目 `2455056082913390562`（暗色视频站：顶部导航 + 大播放区 + 右侧推荐 + 评论流 + 卡片网格）。

## 现状盘点（v1）

已有能力全部在 `login-demo/server.js`（Node，零依赖）：

| 能力 | 接口 |
|---|---|
| 扫码 / 短信登录（含极验镜像点选） | `/api/qr` `/api/qr/poll` `/api/sms/*` |
| 搜索（WBI）/ 热门 / 排行 / 收藏夹 | `/api/search` `/api/popular` `/api/ranking` `/api/fav*` |
| 视频详情（播放/点赞/UP/粉丝） | `/api/video` |
| 评论 | `/api/comments` |
| 仅音频 | `/api/audio` `/api/audio/stream` |
| 视频播放/下载（ffmpeg 合流落盘 + Range） | `/api/video/prepare|file|download|stream` |
| BGM 分离/识别（Replicate + Shazam） | `/api/analyze*` |

前端 v1 是 Vue 3 + Tailwind（`login-demo/web`），功能齐但视觉是「工具型」布局。

## 目标技术栈

- **前端**：React 18 + Vite + Tailwind CSS（暗色优先）
- **桌面壳**：Electron（第三期，复用同一份 React 产物 + 内嵌 Node 服务）
- **图标**：全部自绘 SVG（不引图标库，保证风格统一）
- **播放器**：先用原生 `<video>` + 自绘控制条（数据源是我们自己的 mp4，无 HLS 需求）；第二期评估 `plyr` / `vidstack`

## 分期

### Phase 1 — 暗色 Web 版骨架（本次）
- [x] `doc/` 计划、`changelog/` 变更记录、`aura-dark-style` skill（设计 token + 组件配方）
- [x] 新建 React 应用 `login-demo/app`（Vite + Tailwind，仅暗色）
- [x] 顶栏：SVG Logo、导航（首页/筛选/动态/排行）、搜索框、上传、通知、头像
- [x] 首页：Hero 大卡 + 分类 chips + 响应式卡片网格（2/3/4 列）
- [x] 观看页：大播放器（自绘控制条：进度/音量/倍速/全屏/画中画）+ 右侧推荐 + 信息区 + 评论流
- [x] 搜索页：结果网格 + 关键词高亮
- [ ] 上传/通知/个人中心：仅占位（后端没有对应接口）

### Phase 2 — 播放器与交互完善
- [x] 播放页：清晰度切换（80/64/32/16）
- [x] 合流进度条（ffmpeg `-progress` 解析 + `/api/video/progress`）
- [x] 断点续播（localStorage `aura:pos:<bvid>`）
- 评论：楼中楼展开、按热度/时间排序、发评论（需要 csrf + wbi，已在服务端具备）
- 播放器：快捷键（空格/←→/F/M）、播放列表连播、迷你播放器（切页不中断）
- 可选：接入 `plyr` 或 `vidstack` 替换自绘控制条

### Phase 3 — Electron 桌面端
- `electron/main.js`：拉起 `server.js`（子进程）→ BrowserWindow 加载 `app://` 或本地 http
- 托盘：后台保持登录态、下载任务完成通知
- 下载管理：任务列表 + 并发限制 + 断点续传（服务端已支持 Range）
- 自动更新：electron-updater（可选）

### Phase 4 — 高级能力
- BGM 识别结果并入 watch 页（曲目表时间轴可点击跳转）
- 收藏夹/稍后再看 批量下载
- 弹幕渲染（`/x/v1/dm/list.so` 已可解，需自绘 canvas 弹幕层）
- 多账号切换（session 隔离）

### Phase 5 — 听影 UI（用户 Figma 稿）接入真实接口（进行中）
- [x] 原稿样式零改动，只改数据层（`ui/src/api.ts` + `ui/src/App.tsx`）
- [x] 首页 / 播放页 / 识别歌曲 / 人声分离 / 评论 / 我的 / 扫码登录 全部接真实接口
- [x] 删除「投稿」入口
- [ ] 音视频识别（ASR）后端
- [ ] 发评论、点赞、投币、收藏、关注（需要 csrf + 副作用确认）

## 目录约定

```
doc/            计划、设计决策、阻塞项
changelog/      每次变更记录（Keep a Changelog 风格）
login-demo/     后端（server.js + lib/*）
login-demo/web  旧 Vue 前端（保留，作为功能参照）
login-demo/app  暗色 React 前端（/app，早期试验版，保留）
login-demo/ui   听影 UI（/ui，用户提供稿，当前主用）
```

## 验收标准（每期）

1. `npm run build` 通过，产物由 `server.js` 在 `/app` 下提供
2. 关键路径可点通：首页 → 卡片 → 播放页 → 播放/下载/评论
3. 暗色下对比度达标（正文 ≥ 4.5:1），无硬编码颜色
4. 变更写入 `changelog/`
