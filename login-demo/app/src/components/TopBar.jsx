import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Icon, Logo } from './Icons.jsx'
import { api } from '../api.js'
import { useUser } from '../context/UserContext.jsx'

const NAV = [
  { to: '/', label: '首页', icon: Icon.Home, end: true },
  { to: '/search', label: '发现', icon: Icon.Compass },
  { to: '/search?tab=rank', label: '排行', icon: Icon.Trending },
]

export default function TopBar() {
  const { user, openLogin } = useUser()
  const [kw, setKw] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const nav = useNavigate()
  const inputRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const q = kw.trim()
    if (q) nav('/search?q=' + encodeURIComponent(q))
  }

  return (
    <header
      className={
        'sticky top-0 z-40 h-16 border-b transition-colors ' +
        (scrolled ? 'border-line bg-bg-1/90 backdrop-blur-xl' : 'border-transparent bg-bg-0')
      }
    >
      <div className="mx-auto flex h-full max-w-shell items-center gap-4 px-4 lg:gap-6 lg:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" title="AuraVideo 首页">
          <Logo size={34} />
          <span className="hidden text-[17px] font-semibold tracking-tight text-fg-1 sm:block">AuraVideo</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(({ to, label, icon: Ico, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                'inline-flex h-9 items-center gap-1.5 rounded px-3 text-[13px] transition ' +
                (isActive ? 'bg-bg-3 text-fg-1' : 'text-fg-2 hover:bg-bg-3 hover:text-fg-1')
              }
            >
              <Ico size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <form onSubmit={submit} className="relative ml-auto hidden w-[240px] shrink-0 sm:block lg:w-[360px]">
          <Icon.Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            ref={inputRef}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="field pl-10 pr-10"
            placeholder="搜索视频、番剧、UP 主"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[11px] text-fg-3">
            /
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          {/* 收藏（右上角） */}
          <Link
            to="/fav"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-fg-2 transition hover:bg-bg-3 hover:text-fg-1"
            title="我的收藏"
          >
            <Icon.Star size={17} />
            <span className="hidden lg:inline">收藏</span>
          </Link>

          <button className="btn-primary hidden xl:inline-flex" title="投稿（未接入）">
            <Icon.Upload size={16} />
            投稿
          </button>
          <button className="icon-btn" title="通知（未接入）">
            <Icon.Bell size={18} />
          </button>

          {user ? (
            <div className="relative ml-1" ref={menuRef}>
              <button
                className="flex items-center gap-2 rounded-full border border-line bg-bg-2 py-1 pl-1 pr-2.5 transition hover:border-line-2"
                onClick={() => setMenu((v) => !v)}
              >
                <img
                  src={api.img(user.face)}
                  referrerPolicy="no-referrer"
                  alt=""
                  className="h-7 w-7 rounded-full bg-bg-3 object-cover"
                />
                <span className="hidden max-w-[88px] truncate text-[12px] text-fg-2 lg:block">{user.uname}</span>
              </button>
              {menu && (
                <div className="absolute right-0 top-11 w-44 overflow-hidden rounded-lg border border-line bg-bg-2 py-1 shadow-float">
                  <Link to="/me" className="flex items-center gap-2 px-3 py-2 text-[13px] text-fg-2 hover:bg-bg-3 hover:text-fg-1" onClick={() => setMenu(false)}>
                    <Icon.User size={15} />
                    个人中心
                  </Link>
                  <Link to="/fav" className="flex items-center gap-2 px-3 py-2 text-[13px] text-fg-2 hover:bg-bg-3 hover:text-fg-1" onClick={() => setMenu(false)}>
                    <Icon.Star size={15} />
                    我的收藏
                  </Link>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-fg-3 hover:bg-bg-3 hover:text-fg-1"
                    onClick={() => {
                      setMenu(false)
                      openLogin()
                    }}
                  >
                    <Icon.Sparkles size={15} />
                    切换账号
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn-primary ml-1 !h-8 !px-3 !text-[12px]" onClick={openLogin}>
              <Icon.User size={15} />
              登录
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
