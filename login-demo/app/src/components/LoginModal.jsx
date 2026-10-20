import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useUser } from '../context/UserContext.jsx'
import { Icon } from './Icons.jsx'

/** 扫码登录弹窗：/api/qr 拿二维码 → 轮询 /api/poll → 成功刷新用户 */
export default function LoginModal() {
  const { loginOpen, setLoginOpen, refresh } = useUser()
  const [qr, setQr] = useState(null)
  const [status, setStatus] = useState('loading') // loading | waiting | scanned | done | error
  const [msg, setMsg] = useState('')
  const timer = useRef(null)

  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }

  const start = async () => {
    setStatus('loading')
    setMsg('')
    const j = await api.qr()
    if (!j.ok || !j.png) {
      setStatus('error')
      setMsg(j.message || '二维码获取失败')
      return
    }
    setQr(j)
    setStatus('waiting')
    stop()
    timer.current = setInterval(async () => {
      const p = await api.poll(j.qrcodeKey)
      if (p.code === 0) {
        stop()
        setStatus('done')
        setMsg('登录成功')
        const u = await refresh()
        setTimeout(() => setLoginOpen(false), 800)
        if (u) setMsg('欢迎，' + u.uname)
      } else if (p.code === 86190) {
        setStatus('scanned')
        setMsg('已扫码，请在手机上确认')
      } else if (p.code === 86038) {
        stop()
        setStatus('error')
        setMsg('二维码已过期，点下面重新获取')
      }
    }, 2000)
  }

  useEffect(() => {
    if (loginOpen) start()
    else stop()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginOpen])

  if (!loginOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setLoginOpen(false)}
    >
      <div
        className="w-[360px] overflow-hidden rounded-xl border border-line bg-bg-2 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h3 className="text-[15px] font-medium text-fg-1">扫码登录</h3>
            <p className="mt-0.5 text-[12px] text-fg-3">用哔哩哔哩手机客户端扫描</p>
          </div>
          <button className="icon-btn" onClick={() => setLoginOpen(false)}>
            <Icon.ChevronLeft size={18} />
          </button>
        </div>

        <div className="grid place-items-center px-5 py-6">
          <div className="relative grid h-[220px] w-[220px] place-items-center rounded-lg border border-line bg-white">
            {status === 'loading' && (
              <span className="text-[12px] text-black/50">二维码生成中…</span>
            )}
            {qr?.png && status !== 'loading' ? (
              <img src={qr.png} alt="登录二维码" className="h-[204px] w-[204px]" />
            ) : null}
            {(status === 'scanned' || status === 'done') && (
              <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/75 text-[13px] text-white">
                {status === 'done' ? '登录成功' : '已扫码，请确认'}
              </div>
            )}
          </div>

          <p
            className={
              'mt-3 text-center text-[12px] ' +
              (status === 'error' ? 'text-danger' : status === 'done' ? 'text-ok' : 'text-fg-3')
            }
          >
            {msg || '打开 B 站 App → 我的 → 扫一扫'}
          </p>

          <button className="btn-ghost mt-4 w-full" onClick={start}>
            <Icon.Sparkles size={15} />
            重新获取二维码
          </button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-fg-3">
            Cookie 只保存在本机 <code className="text-fg-2">session.json</code>，
            由本地服务代发请求，不经过任何第三方
          </p>
        </div>
      </div>
    </div>
  )
}
