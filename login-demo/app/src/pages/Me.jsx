import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmtNum } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import { Icon } from '../components/Icons.jsx'
import { useUser } from '../context/UserContext.jsx'

/** 个人中心：资料卡 + 数据 + 会话信息 + 退出 */
export default function Me() {
  const { user, loading, logout, openLogin } = useUser()
  const [info, setInfo] = useState(null)
  const [folders, setFolders] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const u = await api.user()
      if (u.ok) setInfo(u.user)
      const f = await api.fav()
      if (f.ok) setFolders(f.folders || [])
    })()
  }, [user])

  if (loading) {
    return (
      <>
        <TopBar />
        <div className="mx-auto max-w-shell px-6 py-24 text-center text-[13px] text-fg-3">加载中…</div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <TopBar />
        <div className="mx-auto max-w-shell px-6 py-24 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-bg-2 text-fg-3">
            <Icon.User size={26} />
          </div>
          <p className="text-[15px] font-medium text-fg-2">还没有登录</p>
          <p className="mt-1 text-[13px] text-fg-3">扫码登录后可查看个人资料与收藏夹</p>
          <button className="btn-primary mx-auto mt-5" onClick={openLogin}>
            <Icon.User size={16} />
            扫码登录
          </button>
        </div>
      </>
    )
  }

  const u = info || user

  return (
    <div className="min-h-full">
      <TopBar />
      <div className="mx-auto max-w-shell px-4 pb-16 pt-5 lg:px-6">
      <h1 className="text-[20px] font-semibold text-fg-1">个人中心</h1>

      {/* 资料卡 */}
      <section className="mt-4 overflow-hidden rounded-xl border border-line bg-bg-2">
        <div className="h-24 bg-gradient-to-r from-brand/30 via-indigo-600/20 to-transparent" />
        <div className="-mt-10 flex flex-wrap items-end gap-4 px-6 pb-5">
          <img
            src={api.img(u.face)}
            alt=""
            referrerPolicy="no-referrer"
            className="h-20 w-20 rounded-full border-4 border-bg-2 bg-bg-3 object-cover"
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-semibold text-fg-1">{u.uname}</h2>
              <span className="rounded bg-bg-3 px-1.5 py-0.5 text-[11px] text-brand">Lv{u.level}</span>
              <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-fg-3">{u.vip}</span>
            </div>
            <p className="mt-1 font-mono text-[12px] text-fg-3">UID {u.mid}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/fav" className="btn-ghost">
              <Icon.Star size={15} />
              我的收藏
            </Link>
            <button
              className="btn-ghost"
              onClick={async () => {
                await logout()
                nav('/')
              }}
            >
              <Icon.ChevronLeft size={15} />
              退出登录
            </button>
          </div>
        </div>

        {/* 数据 */}
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-4">
          {[
            { k: '粉丝', v: info?.fans },
            { k: '关注', v: info?.following },
            { k: '收藏夹', v: info?.favCount },
            { k: '硬币', v: u.coins },
          ].map((it) => (
            <div key={it.k} className="px-6 py-4">
              <div className="num text-[18px] font-semibold text-fg-1">{fmtNum(it.v)}</div>
              <div className="mt-0.5 text-[12px] text-fg-3">{it.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 收藏夹快捷入口 */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-fg-1">收藏夹</h2>
          <Link to="/fav" className="text-[12px] text-brand">
            全部 {folders.length} 个 ↗
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.slice(0, 8).map((f) => (
            <Link
              key={f.id}
              to="/fav"
              className="flex items-center gap-3 rounded-lg border border-line bg-bg-2 p-3 transition hover:border-line-2 hover:bg-white/[0.04]"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-brand/15 text-brand">
                <Icon.Star size={17} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-fg-1">{f.title}</p>
                <p className="num text-[11px] text-fg-3">{f.count} 个视频</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 会话信息 */}
      <section className="mt-6 rounded-lg border border-line bg-white/[0.03] p-5">
        <h2 className="text-[14px] font-medium text-fg-1">会话</h2>
        <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
          {[
            ['登录方式', '扫码 / 短信（极验镜像点选）'],
            ['Cookie 存储', 'login-demo/session.json（0600）'],
            ['会话标识', u.mid ? 'DedeUserID ' + u.mid : '—'],
            ['数据来源', 'bilibili 公开接口，本地服务代发'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded border border-line bg-bg-2 px-3 py-2">
              <dt className="text-fg-3">{k}</dt>
              <dd className="truncate text-fg-2">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      </div>
    </div>
  )
}
