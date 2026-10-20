# 听影 UI（用户提供的 Figma Make 稿，已接真实接口）

原稿：React 19 + Vite 8 + Tailwind v4。**样式一行没改**，只把假数据换成 `login-demo/server.js` 的真实接口。

## 运行

```bash
# 1) 后端（必须，端口 18787）
cd login-demo && node server.js

# 2) 开发（18790，/api 代理到 18787）
cd login-demo/ui && npm run dev
#   → http://127.0.0.1:18790/ui/

# 3) 生产（构建后由后端在 /ui 提供）
cd login-demo/ui && npm run build
#   → http://127.0.0.1:18787/ui/
```

## 接口映射

| 页面/区域 | 接口 | 说明 |
|---|---|---|
| 首页卡片 | `GET /api/popular?pn=1` | 标题/封面/UP/播放/点赞/评论/时长/分类/时间，一次拿全 |
| 播放器 | `GET /api/video/prepare?bvid=` → `GET /api/video/file?bvid=&q=` | 服务端 ffmpeg 合流落盘，支持 Range 拖动 |
| 合流进度 | `GET /api/video/progress?bvid=&q=` | 百分比 + 剩余时间，盖在播放器上的遮罩 |
| 听视频 | `GET /api/audio/stream?bvid=` | 纯音频流，画面切换成转盘 + 均衡器 |
| 识别歌曲 | `POST /api/analyze {mode:'tracklist'}` + `GET /api/analyze/status?jobId=` | 12s 窗全片扫描，输出曲目时间轴 |
| 人声分离 | `POST /api/analyze {mode:'full'}` | stems：`vocals` / `instrumental`，可试听下载 |
| 评论 | `GET /api/comments?bvid=&pn=` | 分页、点赞数、IP 属地 |
| 我的 | `GET /api/user`、`GET /api/fav` | 昵称/等级/大会员/粉丝/收藏夹列表 |
| 扫码登录 | `POST /api/qr` + `POST /api/poll` | 登录成功后头部换成真实头像 |
| 下载 | `GET /api/video/download?bvid=&q=80` | 直接下载 mp4 |

## 没接的（不伪装）

- **音视频识别（ASR）**：没有语音识别后端，页面直接写明
- **人声分离工具页（上传）**：需要本地 GPU 或云端额度，未开放；视频详情页里的分离是真实可用的
- **发评论 / 点赞 / 投币 / 收藏 / 关注**：需要 csrf，且会改真实账号数据，保持视觉态

详细原因见 `../doc/BLOCKERS.md`（B1/B2/B3/B11/B12）。
