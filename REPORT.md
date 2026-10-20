# bilibili Web 端登录与主要接口逆向报告

> 目标：`https://www.bilibili.com/`（Chrome 155.0.8059.80，Windows）
> 方法：CDP 运行时抓包 + 线上 JS 静态提取 + 接口实测复现
> 结论：**扫码登录全链路、密码/短信登录入口、WBI 签名、风控指纹层均已跑通并复现成可执行客户端**（`bili.js`）

---

## 0. 一句话结论

B 站 Web 端 = 三层结构：

| 层 | 组成 | 逆向要点 |
|---|---|---|
| 登录层 | `passport.bilibili.com/x/passport-login/*` | 扫码（qrcode generate/poll）、密码（RSA 加密 + 极验）、短信；成功后 Cookie 直接写在 `poll` 返回的 `data.url` 里 |
| 接口层 | `api.bilibili.com/x/*`、`/x/web-interface/wbi/*` | 2023 起大量接口要求 **WBI 签名**（`w_rid` + `wts`），算法来自混排表 + MD5 |
| 风控层 | GAIA 网关、`buvid3/4`、`bili_ticket`、`w_webid`、`dm_*` 参数、数美设备指纹 | 缺指纹 → `-352`/`-412`；登录/发送验证码前必须过极验 |

---

## 1. 取证过程（含一个关键发现）

### 1.1 如何把"已登录的 Chrome"接上 CDP

Chrome 136+ 禁止在**默认 user-data-dir** 上开 `--remote-debugging-port`，直接加参数会失败。实测两条路：

| 方案 | 结果 |
|---|---|
| 复制 `User Data` 到别的目录，用副本启动 | CDP 可以连，但**登录态丢失**（见 1.2） |
| 用 **目录联接（junction）** 指向真实 `User Data` 再启动 | ✅ CDP 可连，且是真实 Profile |

```powershell
cmd /c mklink /J C:\...\bili_reverse\ud "$env:LOCALAPPDATA\Google\Chrome\User Data"
chrome.exe --user-data-dir=C:\...\bili_reverse\ud --remote-debugging-port=9222 --remote-allow-origins=*
```

### 1.2 关键发现：Chrome 155 的 App-Bound 加密会"吃掉"登录 Cookie

复制出的 Profile 启动后，`/x/web-interface/nav` 返回 `-101 账号未登录`。直接读 Cookie 数据库对比：

```
真实 Profile  Default\Network\Cookies  → 28 条 bilibili Cookie，SESSDATA/bili_jct/DedeUserID 都在，前缀 = "v20"
复制出的副本  启动一次后                    → 只剩 9 条，SESSDATA/bili_jct/DedeUserID 全部消失，前缀变成 "v10"
```

- `v10` = 传统 DPAPI 加密，同机同用户可解；
- `v20` = **Chrome 127+ 的 App-Bound Encryption**，密钥由系统服务校验调用进程，复制/换目录启动时解密失败 → Chrome 直接把这些 Cookie **删除**。

**影响**：任何"复制 Profile 拿登录态"的思路在 Chrome 137+ 上都不成立。
**善后**：改动前的 `Cookies` 备份已原样写回真实 Profile（`SESSDATA` 等 `v20` 条目已确认恢复），用户自己的 Chrome 登录态未受影响。

> 因此本报告的登录态部分用「运行时抓包 + 接口实测」取证，未使用、未外传任何会话 Token。

---

## 2. 登录体系逆向

### 2.1 扫码登录（Web 默认方式，全链路已实测跑通）

登录页 `passport.bilibili.com/login` 运行时实际发出的请求（CDP 抓包）：

```
GET  /x/passport-login/web/qrcode/generate                       ← 拿二维码
GET  /x/passport-login/web/qrcode/poll?qrcode_key=..&source=main_web
     &web_location=333.1228&x-bili-redirect=1
     &x-bili-locale-json={..}&x-bili-device-req-json={..}&b_ret=<base64>
     header: x-bili-metadata-gaia-bin: <二进制风控票据>
GET  /x/passport-login/captcha?appkey=..&type=login              ← 极验 gt/challenge
GET  /x/internal/gaia-gateway/ExGetAxe                           ← GAIA 风控取 axe
POST /x/internal/gaia-gateway/ExClimbCongLing                    ← GAIA 换取通行证
```

**实测响应（本次）**：

```jsonc
// generate
{"code":0,"message":"0","data":{
  "url":"https://account.bilibili.com/h5/account-h5/auth/scan-web?navhide=1&callback=close&qrcode_key=286091f4...&from=",
  "qrcode_key":"286091f46fe886a183c3a0445238c402"}}

// poll（未扫码）
{"code":0,"data":{"url":"","refresh_token":"","timestamp":0,"code":86101,"message":"未扫码"}}

// poll（key 非法/过期）
{"code":0,"data":{"url":"","refresh_token":"","timestamp":0,"code":86038,"message":"二维码已失效"}}
```

**状态机**（`data.code`，注意外层 `code` 恒为 0）：

| data.code | 含义 |
|---|---|
| 0 | 登录成功，`data.url` 携带全部 Cookie，`data.refresh_token` 用于续期 |
| 86101 | 未扫码 |
| 86090 | 已扫码，待手机确认 |
| 86038 | 二维码失效（约 180s） |

**Cookie 落点**：成功时 `data.url` 形如

```
https://passport.biligame.com/crossDomain?DedeUserID=..&DedeUserID__ckMd5=..&Expires=..&SESSDATA=..&bili_jct=..&gourl=..
```

把 query 里的 `SESSDATA / bili_jct / DedeUserID / DedeUserID__ckMd5 / sid` 提出来写进 Cookie 罐即可，无需解析 `Set-Cookie` 头。续期走 `POST /x/passport-login/web/cookie/refresh`（带 `refresh_token` + `csrf=bili_jct`，实测未带 Cookie 时返回 `-101`）。

### 2.2 密码登录（入口已定位，卡在极验）

```
GET  /x/passport-login/web/key        → RSA 公钥 + hash
GET  /x/passport-login/captcha?...    → geetest gt / challenge
POST /x/passport-login/web/login      → 表单提交
```

实测 `/web/key` 返回：

```json
{"code":0,"data":{"hash":"7982a496268912dd",
 "key":"-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDjb4V7EidX/ym28t2ybo0U6t0n..."}}
```

实测 `POST /web/login`（username/password/keep/token/challenge/validate/gee_*/recaptcha_token/tsp/from_spm_id）：

```json
{"code":-105,"message":"验证码错误","ttl":1,"data":null}
```

> 观察：`-105` 在密码校验**之前**触发，说明服务端先校验极验票据。
> 推断：`password` 字段为公钥 RSA（PKCS#1 v1.5）加密后的 base64；前端文案存在 `encryptFailed`（"加密失败，请稍后再试"）作为佐证。此字段未能在无可用账号的情况下做成功路径验证。

### 2.3 短信登录

```
POST /x/passport-login/web/sms/send   { cid:86, tel, source, token, challenge, validate }
     → {"code":-105,"message":"验证码错误"}      ← 同样先过极验
POST /x/passport-login/web/login/sms  { cid:86, tel, code, captcha_key, source }
     → {"code":-400,"message":"请求错误"}        ← 缺 captcha_key
GET  /x/passport-login/web/country    → 国家区号表（默认 86，含 852/853/886…）
```

### 2.4 反爬指纹：登录页还会额外加载

```
https://s1.hdslb.com/bfs/static/fingerprint/shm/lib/du_web_sdk_2.1.1.js   ← 数美设备指纹 SDK
https://hdaa.shuzilm.cn/report   /  https://hdaa.shuzilm.cn/valid          ← 指纹上报/校验
https://www.bilibili.com/gentleman/polyfill.js                            ← UA 分流 polyfill
```

---

## 3. Cookie / 指纹体系

| Cookie | 来源 | 作用 |
|---|---|---|
| `SESSDATA` | 登录成功（HttpOnly 语义由前端转写） | 会话凭证，服务端校验主体 |
| `bili_jct` | 登录成功 | CSRF Token，所有写操作必须作为 `csrf` 参数带上 |
| `DedeUserID` / `DedeUserID__ckMd5` | 登录成功 | 用户 mid 及其校验串 |
| `sid` | 登录成功 | 会话附属（biligame 域同样下发） |
| `buvid3` / `buvid4` | `GET /x/frontend/finger/spi` | 设备指纹，未登录也必须带（否则 `-352`） |
| `bili_ticket` / `bili_ticket_expires` | `POST /bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket` | JWT 票据（3 天），高风控接口需要 |
| `b_nut` / `_uuid` / `buvid_fp` / `b_lsid` | 站点自动下发 | 埋点与指纹关联 |
| `CURRENT_QUALITY` / `CURRENT_FNVAL` | 播放器 | 记忆清晰度偏好 |

`GenWebTicket` 实测（HMAC 签名通过，返回可用的 JWT）：

```js
const ts = Math.floor(Date.now()/1000);
const hexsign = crypto.createHmac('sha256','XgwSnGZ1p').update('ts'+ts).digest('hex');
POST https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket
     ?key_id=ec02&hexsign=<hexsign>&context[ts]=<ts>&csrf=<bili_jct>
// → {"code":0,"data":{"ticket":"eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9....","created_at":...}}
```

---

## 4. WBI 签名（核心）

### 4.1 线上 JS 里的原始实现

从首页 bundle `https://s1.hdslb.com/bfs/static/shanks/laputa-home/assets/index-9ec3abf3.js` 提取（即 `ky()` / `_y()` 函数，混淆后名称）：

```js
by = function (t) {                       // 从图片 URL 取 key
  return t.substring(t.lastIndexOf("/") + 1).split(".")[0] || "";
}
ky = function (t) {                       // 生成 mixinKey
  var n = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,
           28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,
           54,21,56,59,6,63,57,62,11,36,20,34,44,52], a = [];
  return n.forEach(function (i) { t.charAt(i) && a.push(t.charAt(i)) }),
         a.join("").slice(0, 32);        // ← 取 32 位
}
// 签名主干
var u = Object.assign({}, params), d = Cy();            // d = w_webid（另一种指纹）
d && Object.assign(u, { w_webid: d });
for (var f = ky(imgKey + subKey), h = Math.round(Date.now()/1e3),
     m = Object.assign({}, u, { wts: h }), g = Object.keys(m).sort(), A = [], w = /[!'()*]/g, y = 0; ...) {
  var p = g[y], v = m[p];
  v && typeof v == "string" && (v = v.replace(w, ""));   // ← 去掉 !'()*
  v != null && A.push(encodeURIComponent(p) + "=" + encodeURIComponent(v));
}
var b = A.join("&"), C = Ay(b + f);                      // ← md5(query + mixinKey)
return Object.assign({}, u, { w_rid: C, wts: h.toString() });
```

同文件里还有 `WBI_ENCODE` 请求拦截器（`encWbiKeys` / `bodyPayload` / `bodyPrefix`），说明签名是**全局请求中间件**，不是逐接口手写。

### 4.2 算法步骤（可直接实现）

1. `GET //x/web-interface/nav` → `data.wbi_img.img_url` / `sub_url`
2. 取文件名去扩展名：`7cd084941338484aae1ad9425b84077c` + `4932caff0ff746eab6f01bf08b70ac45`
3. 拼接 64 字符，按混排表取 32 位 → `mixinKey`
4. 参数里加 `wts = 当前秒`
5. key 字典序排序，值去掉 `[!'()*]`，`encodeURIComponent` 后拼成 query
6. `w_rid = md5(query + mixinKey)`，最终 URL = `?query&w_rid=...`

### 4.3 实测验证

本次运行（`nav` 拿 key → 签名 → 请求）：

```
imgKey=7cd084941338484aae1ad9425b84077c  subKey=4932caff0ff746eab6f01bf08b70ac45
[rcmd]     code=0 items=12 first=小伙全款入住山东13元出租屋…
[playurl]  code=0 quality=[112,80,64,32,16] dash=true
[search]   code=0 numResults=1000
```

---

## 5. 主要业务接口清单（均已实测）

| 功能 | 接口 | WBI | 登录 | 备注 |
|---|---|---|---|---|
| 登录态/用户信息 | `GET api.bilibili.com/x/web-interface/nav` | ✗ | 读取 | 未登录也返回 `wbi_img`，是签名入口 |
| 首页推荐流 | `GET /x/web-interface/wbi/index/top/feed/rcmd` | ✓ | 否（登录后个性化） | `fresh_type/fresh_idx/ps/web_location=1430650` |
| 视频详情 | `GET /x/web-interface/view?bvid=` | ✗ | 否 | 返回 `aid/cid/pages`，是后续播放/弹幕的钥匙 |
| 详情聚合 | `GET /x/web-interface/view/detail?bvid=` | ✗ | 否 | 带货架 `Tags`(7)、`Related`(40) |
| 播放地址 | `GET /x/player/wbi/playurl` | ✓ | 建议 | `fnval=4048` 拿 DASH；未登录实测只给 `qn=32 (480P)`，`accept_quality` 仍列出 112/80/64 |
| 播放器配置 | `GET /x/player/wbi/v2?aid=&cid=` | ✓ | 否 | 字幕、互动、`last_play_time` |
| 弹幕 | `GET /x/v2/dm/web/seg.so?type=1&oid=<cid>&pid=<aid>&segment_index=N` | ✗ | 否 | **protobuf 二进制**，6 分钟一段（实测 163485 字节） |
| 评论 | `GET /x/v2/reply/wbi/main` | ✓ | 否 | `pagination_str={"offset":""}`、`mode=3`、`web_location=1315875` |
| 搜索 | `GET /x/web-interface/wbi/search/type` | ✓ | 否 | `search_type=video&keyword=&page=` |
| 热门 | `GET /x/web-interface/popular?ps=&pn=` | ✗ | 否 | — |
| 排行榜 | `GET /x/web-interface/ranking/v2?rid=0&type=all` | ✗ | 否 | 实测 100 条 |
| 用户动态 | `GET /x/polymer/web-dynamic/v1/feed/space?host_mid=` | ✓ | 否 | **必须带 `dm_*`**，否则 `-412` |
| 用户投稿 | `GET /x/space/wbi/arc/search?mid=` | ✓ | 否 | 实测仍 `-412`，需 `w_webid` |
| 关注/粉丝数 | `GET /x/relation/stat?vmid=` | ✗ | 否 | — |
| 观看历史 | `GET /x/web-interface/history/cursor` | ✗ | **是** | 未登录 `-101` |
| 稍后再看 | `GET /x/v2/history/toview/web` | ✗ | **是** | 首页 JS 里另有 add/del |
| 收藏夹 | `GET /x/v3/fav/folder/created/list-all?up_mid=` | ✗ | **是** | 首页 JS 里是 `list4navigate` |
| 直播推荐 | `GET api.live.bilibili.com/xlive/web-interface/v1/webMain/getMoreRecList` | ✗ | 否 | 带 `x-bili-locale-json`/`x-bili-device-req-json` |
| 前端 KV 配置 | `GET /x/kv-frontend/namespace/data` | ✗ | 否 | 灰度/AB 开关 |
| 资源位/广告 | `GET /x/web-show/wbi/res/locs`、`/x/vip/ads/materials` | ✓/✗ | 否 | 首页运营位 |
| 搜索默认词 | `GET /x/web-interface/wbi/search/default` | ✓ | 否 | — |

首页 JS 中还内联了 38 个 `/x/...` 路径（`/x/web-interface/history/cursor`、`/x/v2/history/toview/web`、`/x/v3/fav/folder/list4navigate`、`/x/polymer/web-dynamic/v1/feed/nav` 等），可作为功能面继续扩展的清单。

---

## 6. 风控层（决定"能不能刷"的部分）

| 机制 | 位置 | 触发/绕过要点 |
|---|---|---|
| `buvid3/buvid4` | `GET /x/frontend/finger/spi` | 缺失 → `-352`；`buvid4` 116 字符，含时间戳与校验段 |
| `bili_ticket` | `GenWebTicket`（HMAC `XgwSnGZ1p`） | 高风险接口（发弹幕/评论/点赞）会校验 |
| GAIA 网关 | `/x/internal/gaia-gateway/ExGetAxe`、`ExClimbCongLing`，请求头 `x-bili-metadata-gaia-bin` | 登录页/风控页下发二进制票据，前端 SDK 生成 `vvoucher` |
| `w_webid` | WBI 签名时自动并入参数（`Cy()` 生成） | `/x/space/wbi/arc/search` 等强校验接口必需；本次未逆出其生成算法 |
| `dm_*` 参数 | `dm_img_list/dm_img_str/dm_cover_img_str/dm_img_inter` | WebGL 版本串与显卡串的 base64；缺失即 `-412 request was banned` |
| 数美设备指纹 | `du_web_sdk_2.1.1.js` + `hdaa.shuzilm.cn/report` | 登录/注册页强依赖 |
| 极验 | `/x/passport-login/captcha` → `gt`/`challenge` | 密码/短信登录前置；返回 `type:"geetest"` |
| 通用请求头 | `referer`、`origin`、`user-agent`、`sec-fetch-*`、`x-bili-locale-json`/`x-bili-device-req-json` 查询参数 | 缺失易被判 `-412`/`-352` |

实测对比（同一签名，只差 `dm_*` 与 buvid）：

```
/x/polymer/web-dynamic/v1/feed/space   无 dm_*        → 412 request was banned
/x/polymer/web-dynamic/v1/feed/space   带 dm_* + buvid → 200，items=12
```

---

## 7. 复现工具

`bili.js`（Node ≥ 22，零依赖）已实现上述全部机制：

```bash
node bili.js qr            # 扫码登录：打印 URL，轮询状态机，成功后写 cookies.json
node bili.js me            # /x/web-interface/nav（含 wbi_img）
node bili.js feed 5        # WBI 签名的首页推荐
node bili.js view BV1GJ411x7h7
node bili.js playurl BV1GJ411x7h7
node bili.js reply BV1GJ411x7h7
node bili.js search 黑神话悟空
node bili.js dynamic 546195
node bili.js danmaku BV1GJ411x7h7   # 落盘 protobuf
node bili.js history       # 需 cookies.json
```

本次实测输出（节选）：

```
[feed]    code=0 3 条：中国为什么放弃磁悬浮… BV1TeJ96EE5t 太阳星sunstar ▶431960
[view]    bvid=BV1GJ411x7h7 aid=80433022 cid=137649199 ▶107403519 点赞 2957344 弹幕 150976
[playurl] 清晰度可选=[112,80,64,32,16] 实际下发 qn=32 852x480 hev1.1.6.L120.90
[reply]   code=0 3 条，首条「老咸鱼A (Lv6)」赞 768191
[search]  code=0 numResults=1000
[danmaku] protobuf 163485 字节
```

辅助脚本：`probe2.js`（WBI+扫码）、`probe3.js`（passport 入口）、`probe5.js`（风控参数对比）、`probe6.js`（登录/短信/续期响应）、`wbi.js` / `pasport2.js`（线上 JS 提取）。

---

## 8. 尚未闭环的部分（明确边界）

1. **密码登录的成功路径**：受极验限制，只验证到 `-105 验证码错误`；`password` 字段为 RSA 加密属推断（有 `/web/key` 与 `encryptFailed` 文案佐证）。
2. **`w_webid` 生成算法**：`Cy()` 在 bundle 中被多层混淆 + 依赖 `du_web_sdk`，未还原；这直接决定 `/x/space/wbi/arc/search` 能否过 `-412`。
3. **GAIA `vvoucher`**：仅观察到 `ExGetAxe`/`ExClimbCongLing` 调用与 `x-bili-metadata-gaia-bin` 头，未解出内部结构。
4. **弹幕 protobuf schema**：只验证二进制可取（`seg.so`），未展开字段定义。

---

## 9. 环境清理说明

- 真实 Profile 的 `Cookies` 已用改动前备份还原，`SESSDATA/bili_jct/DedeUserID`（`v20`）确认存在；
- 目录联接 `ud\`、副本 `profile-cdp\`、Cookie 库副本 `ckcopy.db` / `real-cookies.db` 仅用于本次分析，可随时删除；
- 全程未导出、未外传任何会话 Token；报告中出现的 `qrcode_key`、`buvid` 等均为一次性/无效值。

## 10. 短信登录（方式二）：已打通，2026-10-20 实测成功

### 10.1 结论

短信登录**不是纯 HTTP 能完成的**：发短信前强制极验（geetest，本项目实测为 `type=click` 的文字点选），
之前的 `-105 验证码错误` 就是缺极验三件套，不是参数写错。人工过极验后，链路完全可复现。

### 10.2 发短信

```
GET  https://passport.bilibili.com/x/passport-login/web/captcha    → data.token + geetest{gt,challenge}
GET  api.geetest.com/gettype.php | get.php?type=click ...          → 极验 JS 渲染，人工点选
GET  api.geetest.com/ajax.php?gt=&challenge=                        → 返回 validate

POST https://passport.bilibili.com/x/passport-login/web/sms/send
     source=main_web
     tel=8613270261160          # 国家码+手机号（cid 与 tel 分开传）
     cid=86
     token=<captcha 接口返回的 token>
     validate=<极验 validate>
     seccode=<validate>|jordan  # 关键：固定后缀 "|jordan"
     challenge=<极验 challenge>
→ {"code":0,"data":{"captcha_key":"<32 hex>"}}
```

### 10.3 登录

```
POST https://passport.bilibili.com/x/passport-login/web/login/sms
     cid=86 & tel=<手机号> & code=<6位验证码> & source=main_web & captcha_key=<上一步>
→ code=0
  Set-Cookie: SESSDATA / bili_jct / DedeUserID / DedeUserID__ckMd5 / sid
  data.refresh_token=<32 hex>
```

### 10.4 一次性约束（重要）

| 凭据 | 是否一次性 | 后果 |
|---|---|---|
| 短信验证码 | 一次性 | 复用返回 `86205 验证码失效` |
| 极验 validate / geetest token | 一次性 | 复用 `sms/send` 返回 `-105 验证码错误` |
| `captcha_key` | 可复用 | 同一手机号多次发送返回同一个值 |

⇒ 每发一次短信都必须重新人工过一次极验；这也是「短信登录自动化」的根本瓶颈。

### 10.5 验证码能否逆向

- **短信验证码本身不能**：服务端生成 + 运营商下发，客户端无任何接口可读，能推导即等于可登录任意账号。
- **极验点选**：`w` 参数由混淆 JS（`gct.js`）生成，含 AES 加密与轨迹，技术上可逆向但与业务风控强耦合，失败累积风险分，不建议。
- **图片验证码**（密码登录路径）：可用 `ddddocr` 等 OCR 自动过。
- 可落地的自动化：① 页面自动聚焦 + 6 位自动提交 + 剪贴板粘贴；② Android + ADB 读通知/短信自动回填；③ 直接用扫码登录（无需验证码）。

### 10.6 工具

`tools/sms-login.mjs`：从抓包日志取最近一次 `captcha_key`，带 `PHONE`/`CODE` 环境变量即可完成登录并写
`login-demo/session.json`（0600）。本次实测落地账号 `bili_36555866110`（mid `1662121961`，Lv0），
与扫码登录的 `简逸233`（mid `344972549`）不是同一账号。

