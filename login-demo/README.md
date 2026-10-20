# bilibili 逆向验证台

扫码登录 · 搜索 / 收藏夹 / 热门 · **视频 BGM 识别（人声/伴奏分离 + Shazam 识别）**
前端 Vue 3 + Tailwind（Coze Studio 风格），后端一个零框架 Node 服务做同源转发、Cookie 持有、WBI 签名与音视频流水线编排。

## 目录

```
login-demo/
├── server.js              # 本地服务：代理 / Cookie / WBI / 静态托管 / 分析流水线
├── py/recognize.py        # Shazam 识别（shazamio），stdout 输出 JSON
├── bin/ffmpeg.exe         # ffmpeg / ffprobe（便携版，PATH 注入给子进程）
├── bin/ffprobe.exe
├── cache/                 # 音频、分离产物、分离模型（可删）
│   ├── models/UVR-MDX-NET-Inst_HQ_3.onnx
│   └── BVxxxxxxx/audio.m4s|audio.wav|*_(Vocals|Instrumental)_*.flac
├── session.json           # 登录态（扫码后生成，/api/reset 删除）
└── web/                   # Vue 3 + Vite + Tailwind 前端
```

## 一键准备（新机器）

```powershell
# 1) Python 3.12（需要 3.10+）
winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements

# 2) Python 依赖（国内建议走清华源）
$py = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
& $py -m pip install "audio-separator[cpu]" shazamio audioread -i https://pypi.tuna.tsinghua.edu.cn/simple

# 3) ffmpeg / ffprobe（npmmirror 镜像，各 28MB gz，秒下）
#    也可自行把 ffmpeg.exe / ffprobe.exe 放进 login-demo/bin/
```

> 分离模型首次使用会自动下载 `UVR-MDX-NET-Inst_HQ_3.onnx`（66.8MB，约 30s），之后复用。

## 运行

```powershell
cd login-demo
node server.js          # 默认 18787，被占用自动 +1
# 前端开发模式（可选）：cd web && npm i && npm run dev
# 前端构建：cd web && npm run build   （server.js 直接托管 web/dist）
```

打开 `http://127.0.0.1:18787/`。

## 功能

| 功能 | 入口 | 后端 | 说明 |
|---|---|---|---|
| 扫码登录 | 右上角「登录」 | `/api/qr` → `/api/poll` | Cookie 来自 `Set-Cookie` + `data.url`；成功后写 `session.json` |
| 登录态复验 | 顶栏用户信息 | `/api/me` | 服务端带 Cookie 打 `nav` |
| 搜索（名称） | 搜索框 | `/api/search` | `wbi/search/type`，WBI 签名 |
| 搜索（BV 号） | 搜索框 | `/api/search` | `^BV[0-9A-Za-z]{10}$` 直查 `/x/web-interface/view` |
| 收藏夹 | 收藏夹 tab | `/api/fav`、`/api/fav/items` | 需登录 |
| 热门 | 热门 tab | `/api/popular` | — |
| **BGM 识别（分离+识别）** | 每条视频右侧「分离+识别」 | `/api/analyze`(+`mode=full`) + `/api/analyze/status` | 见下，需要 Replicate 额度 |
| **BGM 识别（只识别）** | 每条视频右侧「只识别」 | `/api/analyze`(+`mode=recognize`) | 不分离，多窗口扫描原音频直接送 Shazam，**零成本、3–10s** |
| **仅播放音频** | 卡片「听音频」 | `/api/audio` + `/api/audio/stream` | 服务端代理音频流（支持 Range），`<audio>` 直接播，不加载画面 |
| **查看评论** | 卡片「评论」 | `/api/comments?bvid=&pn=` | WBI `reply/wbi/main`，失败自动回落老接口 |
| **播放/点赞/UP主/粉丝数** | 卡片内展示 | `/api/video?bvid=` | `view` + `relation/stat`，服务端 10 分钟缓存 |
| 试听分离结果 | 结果卡片内播放器 | `/api/analyze/stem?bvid=&kind=` | 伴奏 / 人声各一条 |
| 图片代理 | 全站缩略图/头像 | `/api/img` | CDN 会 403 掉 `Referer: 127.0.0.1` |

## BGM 识别流水线

```
bvid
 └─ /x/web-interface/view                      拿 cid / 标题
 └─ /x/player/wbi/playurl (fnval=4048)         拿 DASH 音频流（选最高码率）
 └─ 下载 m4s → ffmpeg -f mp4 → audio.wav 44.1k 双声道
 └─ audio-separator -m UVR-MDX-NET-Inst_HQ_3.onnx --two-stems 风格输出
      ├─ *_ (Vocals)      .flac   人声
      └─ *_ (Instrumental).flac   伴奏 / BGM
 └─ shazamio 分别识别两条轨（py/recognize.py）
      └─ 标题 / 艺人 / 专辑 / 年份 / 流派 / 封面 / Shazam 链接
```

- 任务串行执行（CPU 密集），`POST /api/analyze` 返回 `jobId`，前端 2.5s 轮询 `/api/analyze/status` 拿 stage 与日志
- 同一 bvid 二次分析命中 `cache/<bvid>` 的 stem，跳过下载与分离，只剩识别（约 3–6s）
- 实测（RTX 5060 机器、纯 CPU 推理，视频 3:32）：下载 1s + 转码 1s + 分离 ~85s + 识别 ~5s

## 分离引擎：默认云端，本地推理默认关闭

| 引擎 | 需要 | 本地算力 | 说明 |
|---|---|---|---|
| `replicate`（默认） | `REPLICATE_API_TOKEN` | 只做下载 + ffmpeg 转 mp3（秒级、单线程） | 上传 → `cjwbw/demucs` 云端推理 → 下载 stems → ffmpeg amix 合成伴奏 |
| `local` | `ALLOW_LOCAL_SEP=1` | 满 CPU 跑 UVR onnx（约 85s/3.5min） | 留作离线兜底，默认**禁用**，防止误触发把 CPU 吃满 |

配置位置：页面右上角「引擎」按钮，或直接编辑 `.env`（见 `.env.example`）：

```ini
SEP_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_xxx
REPLICATE_SEP_MODEL=cjwbw/demucs
# ALLOW_LOCAL_SEP=1
```

- token 只写本地 `.env`（0600），`GET /api/config` 只回 `••••abcd` 这种掩码
- 识别（Shazam）本来就是云端，不占本地算力
- 成本参考：Replicate 的 demucs 按运行秒计费，3 分钟视频大约 $0.01–0.03
- 未配 token 时点「识别 BGM」会立刻报「分离服务未配置」，**不会**偷偷跑本地推理
- Replicate 账户需要有余量，否则建预测会返回 `402 Insufficient credit`（去 https://replicate.com/account/billing 充值）
- 社区模型（cjwbw/demucs、ryan5453/demucs）**必须用 version 建预测**：`POST /v1/predictions {version, input}`；
  走 `/v1/models/{owner}/{name}/predictions` 简写会 404

### 只识别模式（零成本）

`mode=recognize` 不做分离，直接对原音频扫 5 个窗口（8% / 30% / 50% / 70% / 88% 处各 45s）送 Shazam，
命中即返回；适合「快速判断这个视频用了什么曲子」，代价只有本地 ffmpeg 截取 + 几次 Shazam 请求。

实测（4/5 命中）：

| BV | 识别结果 |
|---|---|
| BV1Xj411P7n1 | Daylight — Seredris（Electronica） |
| BV15DAPeKEYv | Mystery of Love — Sufjan Stevens |
| BV1anZJBXE3U | Una Mattina — Ludovico Einaudi（Classical） |
| BV1bT411j7Po | Hard Year — Aaron Kellim |
| BV1cM4y1r7n1 | 该视频 CDN 节点 503（已加 backupUrl 重试） |

### 多轨输出

云端 `cjwbw/demucs` 默认出 **4 轨**（vocals / drums / bass / other），服务端会：

1. 把 vocals 单独存一条；
2. 用 `ffmpeg amix` 把 drums+bass+other 合成一条 `instrumental`（= 伴奏 / BGM）；
3. `result.stems` 返回 `{ vocals, instrumental, drums, bass, other }` 全部映射，页面自动列成 N 个播放器，每个都能单独试听 + 下载（`/api/analyze/stem?bvid=&kind=drums&dl=1`）。

想要 6 轨（多出 piano / guitar）时，在 `.env` 里加：

```ini
REPLICATE_MODEL_VARIANT=htdemucs_6s
```

代码会先探测模型的输入字段，只有模型确实支持 `model_name` / `model` 时才会带上，否则日志里会提示「已忽略 variant」而不报错。

## 样式系统

- 规范真源：`~/.agents/skills/coze-style/`（`SKILL.md` + `tokens.css` + `tailwind.preset.cjs`）
- token 取自 `coze-dev/coze-studio` 的 `frontend/config/tailwind-config/src/{light,dark}.js`，品牌色 `#5147FF`
- `web/tailwind.preset.cjs`、`web/src/styles/coze-tokens.css` 是同步副本：改样式先改 skill 再同步

## 已知限制

- 分离模型是 UVR MDX-Net（onnx/CPU）。要更高音质可换 `model_bs_roformer_*.ckpt`（需 torch，质量更好但更慢）
- Shazam 走非官方接口（`shazamio`），高频调用可能被限流；无版权/自制曲目识别不出来是正常的
- 首次分析约 2 分钟（含 67MB 模型下载 + CPU 推理）
- 收藏夹只取第 1 页；`space/wbi/arc/search` 仍需 `w_webid`
- `session.json` 内含 `SESSDATA`，仅本机使用

## 界面：小卡片布局

- 顶部只保留 SVG Logo（耳机 + 小电视），不再有标题文字；右上角是引擎设置 / 明暗切换 / 短信登录 / 账号。
- 每个视频一张卡片：封面（含时长角标）→ 标题 → UP 主头像 + 名称 + 粉丝数 → 播放量 / 点赞 / 评论数 → 操作行。
- 操作：`听音频`（仅音频流）、`评论`（抽屉展开，可加载更多）、`识别`、`全片`、`分离`。
- 响应式：手机 1 列 / ≥640px 2 列 / ≥1280px 3 列；卡片内按钮在窄屏自动变成两行等宽。
- 样式只走 Coze token（`bg-*` / `text-*` / `border-*`），**没有引入 Bootstrap**：加第二套色板和 reset 会破坏设计统一，Tailwind 已经覆盖 grid/断点/折叠。

| 新接口 | 说明 |
|---|---|
| `GET /api/video?bvid=` | 标题、封面、时长、播放/点赞/弹幕/评论/收藏/投币、UP 主 + 粉丝数（10 分钟内存缓存） |
| `GET /api/audio?bvid=` | 返回本地代理地址 + 码率 + 时长 |
| `GET /api/audio/stream?bvid=` | 反代音频流，转发 `Range` 支持拖动；直链 30 分钟缓存 |
| `GET /api/comments?bvid=&pn=` | 评论列表（WBI），含楼中楼计数与 IP 属地 |

## 视频播放与下载

卡片上 `播放` / `下载` / 清晰度（1080P / 720P / 480P / 360P）。

| 接口 | 说明 |
|---|---|
| `GET /api/video/prepare?bvid=&q=` | 用 ffmpeg 把 dash 的 video+audio **合流成完整 mp4** 落盘到 `cache/dl/`，返回 `{url,size,duration,quality}` |
| `GET /api/video/file?bvid=&q=` | 按 `Range` 提供本地 mp4（可拖动进度、可边播边缓冲） |
| `GET /api/video/download?bvid=&q=` | 同上但带 `Content-Disposition: attachment`，文件名取视频标题 |
| `GET /api/video/stream?bvid=&q=` | 只反代视频轨（无音轨，快，用于快速预览） |
| `GET /api/video/play?bvid=&q=` | 兼容入口：等价于 prepare，返回文件地址 |

关键取舍：**合流必须落盘，不能 pipe**。
`pipe` 出来的是 fragmented mp4（`empty_moov`），浏览器拿不到 `duration`（实测只报 5.1s），
进度条和拖动全废。改成先 `-movflags +faststart` 写完整文件再按 Range 提供，
实测 720P/49.6MB、1080P/71.7MB，时长 212s，h264+aac，拖动正常；ffmpeg 合流一次约 1–2s，
同一 `bvid+q` 30 分钟内复用。

清晰度选择：优先 H.264（`codecid=7`）保证 `<video>` 兼容；请求的档位不存在时自动降到「不高于它」的最高档。
合流需要登录态（1080P 及以上要大会员），未登录只能拿到 480P/360P。
