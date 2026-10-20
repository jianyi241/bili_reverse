# AuraVideo · 新前端（React 18 + Vite + Tailwind）

暗色视频站界面（参考 Google Stitch 稿），数据全部来自 `login-demo/server.js` 的既有接口。

## 运行

```bash
# 1) 先起后端（端口 18787）
cd login-demo && node server.js

# 2a) 开发模式（Vite 18790，/api 代理到 18787）
cd login-demo/app && npm run dev
#   → http://127.0.0.1:18790/app/

# 2b) 生产模式（构建后由后端在 /app 下提供）
cd login-demo/app && npm run build
#   → http://127.0.0.1:18787/app/
```

## 目录

```
src/
  main.jsx           入口（BrowserRouter basename=/app）
  App.jsx            路由：/ 、/search 、/watch/:bvid
  api.js             接口封装 + 数字/时间格式化
  index.css          Tailwind + 暗色 token（CSS 变量）
  components/
    Icons.jsx        全部自绘 SVG 图标（禁止引图标库）
    TopBar.jsx       顶栏：Logo / 导航 / 搜索 / 投稿 / 通知 / 头像
    VideoCard.jsx    16:9 卡片：封面 + 时长 + 标题 + UP + 播放量
    Player.jsx       自研播放器：进度/音量/倍速/画中画/全屏/快捷键
    CommentList.jsx  评论流（只读，分页加载）
  pages/
    Home.jsx         Hero + 分类 chips + 4 列网格
    Search.jsx       搜索结果网格
    Watch.jsx        播放页：播放器 + 信息 + UP 主 + 评论 + 右侧推荐
```

## 约定

- 颜色只用 `bg-* / text-* / border-*` 的 token 类，不写十六进制
- 图标只用 `Icons.jsx`
- 数据源：`/api/popular`、`/api/search`、`/api/video`、`/api/video/prepare`、`/api/comments`
- 播放地址：`/api/video/file?bvid=&q=`（服务端 ffmpeg 合流后落盘，支持 Range 拖动）

## 已知限制

- 首次播放某个视频需要等服务端合流：1080P/50MB 约 1–2s，17 分钟/325MB 约 30–60s（见 `doc/BLOCKERS.md` B6）
- 点赞/投币/收藏/关注/发评论/投稿/通知：入口存在但未接后端（B1/B2/B3）
- 只做暗色；亮色二期补一套 CSS 变量即可，不动组件
