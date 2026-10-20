# 极验（geetest）逆向 spike 记录

目标：让「点选验证 + w 生成」完全跑在我们自己的页面/服务里，不依赖 bilibili 页面。
结论：**官方 SDK 在第三方域跑不起来；自己算 w 需要先破自定义编码，成本显著高于预估。**

## 1. bilibili 侧的真实初始化代码（从 `630.88d25301.js` 提取）

bilibili 的验证码组件有两条路径：

```js
// v3（本次短信登录命中的就是这条：sms/send 收到 validate/seccode/challenge/token）
initGeeCode(){
  X.A({ config:{ gt, challenge, offline:false, lang }, onSuccess:t=>{
    const { data:e } = t;
    resolve({ captcha_type:type, validate: e.geetest_validate,
              seccode: e.geetest_seccode, challenge: e.geetest_challenge,
              token: pre_info.token });
  }});
}

// v4
initGeeCode4(){
  E.A({ config:{ captchaId: gt, language }, onSuccess:t=>{
    const e = t.data;
    require(e.lot_number && e.captcha_output && e.pass_token && e.gen_time);
    resolve({ captcha_type:type, token, lot_number, captcha_output, pass_token, gen_time });
  }});
}
```

`seccode = validate + "|jordan"` 就是 v3 路径的固定后缀（已在真实抓包里验证）。

## 2. gettype.php 返回的脚本清单

```json
{"status":"success","data":{"type":"fullpage",
 "static_servers":["static.geetest.com/","static.geevisit.com/"],
 "click":"/static/js/click.3.1.2.js",
 "fullpage":"/static/js/fullpage.9.2.0-guwyxh.js",
 "geetest":"/static/js/geetest.6.0.9.js"}}
```

## 3. 在 127.0.0.1 页面加载官方 SDK 的实验

| 尝试 | 结果 |
|---|---|
| `new window.Geetest({gt, challenge, offline:false, lang:'zh-cn'})` | `TypeError: $[e[$_DADP(...)]] is not a constructor` |
| 先加载 `fullpage.9.2.0-guwyxh.js` 再 `click.3.1.2.js`，同上 | 同样抛错（`Geetest` 只有 `type/noConflict/fullpage/click` 静态成员） |
| `initGeetest4({captchaId, product:'bind'})`（官方 `v4/gt4.js`） | 回调**不触发**，且没有任何到 `api.geetest.com` 的请求（静默失败） |
| `cap.showCaptcha()` | 同上，`window.__cap4` 始终 undefined |

⇒ 官方 SDK 依赖 bilibili 页面上下文（类型模块注册/域名校验），脱离后无法工作。

## 4. w 能不能自己算？

抓到的真实 w（URL 解码后）：

| 请求 | w 长度 | base64 解出字节 | 是否 16 的倍数 |
|---|---|---|---|
| `get.php?...&w=` | 1472 | 1078 | ❌（1078 % 16 = 6） |
| `ajax.php?...&w=` | 1304 | 954 | ❌（954 % 16 = 10） |

不是 16 的倍数 ⇒ **不是裸 AES-CBC 密文**，而是自定义编码（很可能 base64 变体 + 自定义混淆头）。

用 5 组候选 key/iv 尝试 AES-128-CBC 解密，全部失败：

```
gt32 / iv=challenge[:16]       → Invalid key length
gt[:16] / iv=challenge[:16]    → bad decrypt
challenge[:16] / iv=gt[:16]    → bad decrypt
zeros / zeros                  → bad decrypt
md5(gt+challenge)[:16] / zeros → bad decrypt
```

## 5. 结论与成本

要真做到「本地算 w」，需要依次解决：

1. 解 `gct.js` 的字符串表（`decodeURI('%04%0D...')` 编码 + 控制流平坦化 + 函数名随机化）；
2. 找出 w 的自定义编码容器（非标准 AES 输出）；
3. 复刻轨迹打包（鼠标轨迹采样、时间戳压缩、设备指纹）；
4. 处理 `pow` 工作量证明（如果该 gt 开启）；
5. 重新对抗风控（同一 IP 高频会降级为更强验证）。

**乐观 1–2 天，悲观 3 天以上；且成功率长期受风控影响。**

## 6. 当前采用的替代方案（已实现）

- 镜像极验面板：`Page.captureScreenshot(clip=面板矩形)` → 我们的页面显示
- 用户在我们页面点选 → 坐标 → `Input.dispatchMouseEvent`（`isTrusted=true`）→ 真页面极验算 w
- 承载页面窗口移到屏幕外（`left:-3200`），用户全程只看到我们的应用
- 抓 `sms/send` 的 `token/challenge/validate/seccode` → 存 `captcha_key` → `login/sms` → 落 `session.json`
