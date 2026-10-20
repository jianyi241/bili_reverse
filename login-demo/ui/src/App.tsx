import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Logo from './components/Logo'
import * as I from './components/Icons'
import { api, fmtDur, fmtNum, img, type Comment, type Track, type User, type Video } from './api'

type Page = 'home' | 'watch' | 'asr' | 'split' | 'me'

const nav: { id: Page; label: string; icon: typeof I.IHome }[] = [
  { id: 'home', label: '首页', icon: I.IHome },
  { id: 'asr', label: '音视频识别', icon: I.IWave },
  { id: 'split', label: '人声分离', icon: I.ILayers },
  { id: 'me', label: '我的', icon: I.IUser },
]

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [page, setPage] = useState<Page>('home')
  const [current, setCurrent] = useState<Video | null>(null)
  const [listen, setListen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const refreshUser = useCallback(async () => {
    const r = await api.me()
    setUser(r.ok && r.user ? r.user : null)
    return r.ok ? r.user ?? null : null
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const go = (p: Page) => { setPage(p); window.scrollTo({ top: 0 }) }
  const open = (v: Video, l = false) => { setCurrent(v); setListen(l); go('watch') }

  return (
    <div className="min-h-dvh bg-bg text-ink pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
          <button onClick={() => go('home')} className="flex shrink-0 items-center gap-2">
            <Logo size={38} />
            <span className="fb text-lg tracking-wide">听影</span>
          </button>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {nav.slice(0, 3).map((n) => (
              <button key={n.id} onClick={() => go(n.id)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${page === n.id ? 'fm bg-accent-soft text-ink' : 'text-muted hover:text-ink'}`}>
                {n.label}
              </button>
            ))}
          </nav>
          <label className="ml-auto hidden h-10 w-full max-w-xs items-center gap-2 rounded-full bg-sunken px-4 text-muted lg:flex">
            <I.ISearch size={18} />
            <input placeholder="搜索视频、音频、创作者" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
          </label>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <button className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-sunken lg:hidden" aria-label="搜索"><I.ISearch /></button>
            <button onClick={() => setDark(!dark)} aria-label="切换明暗"
              className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink">
              {dark ? <I.ISun /> : <I.IMoon />}
            </button>
            <button className="relative hidden h-10 w-10 place-items-center rounded-full text-muted hover:bg-sunken sm:grid" aria-label="通知">
              <I.IBell /><span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent" />
            </button>
            {user ? (
              <button onClick={() => go('me')} className="ml-2 hidden md:block" aria-label="我的">
                <img src={img(user.face)} alt="头像" className="h-9 w-9 rounded-full object-cover" />
              </button>
            ) : (
              <button onClick={() => setLoginOpen(true)} className="ml-1 flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-bg">
                <I.IUser size={16} />登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {page === 'home' && <Home onOpen={open} go={go} />}
        {page === 'watch' && current && <Watch key={current.bvid} v={current} listen={listen} setListen={setListen} onOpen={open} back={() => go('home')} authed={!!user} />}
        {page === 'watch' && !current && <div className="py-20 text-center text-sm text-muted">请先从首页选一个视频</div>}
        {page === 'asr' && <Asr />}
        {page === 'split' && <Split />}
        {page === 'me' && <Me dark={dark} setDark={setDark} user={user} onLogin={() => setLoginOpen(true)} onLogout={async () => { await api.reset(); setUser(null) }} />}
      </main>

      <footer className="mx-auto hidden max-w-7xl items-center justify-between border-t border-line px-8 py-8 text-sm text-muted md:flex">
        <div className="flex items-center gap-2"><Logo size={24} />听影 · 好好看，慢慢听</div>
        <div className="flex gap-6"><span>关于我们</span><span>创作者中心</span><span>隐私条款</span></div>
        <span>© 2025 听影</span>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {nav.map((n) => {
          const on = page === n.id || (n.id === 'home' && page === 'watch')
          return (
            <button key={n.id} onClick={() => go(n.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${on ? 'text-accent' : 'text-muted'}`}>
              <span className={`grid h-8 w-12 place-items-center rounded-full ${on ? 'bg-accent-soft' : ''}`}><n.icon size={20} /></span>
              {n.label}
            </button>
          )
        })}
      </nav>

      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onDone={async () => {
            await refreshUser()
            setLoginOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ---------------- 扫码登录 ---------------- */
function LoginModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [qr, setQr] = useState<{ png: string; key: string } | null>(null)
  const [state, setState] = useState<'loading' | 'waiting' | 'scanned' | 'error'>('loading')
  const [msg, setMsg] = useState('')
  const timer = useRef<number | null>(null)

  const stop = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null }

  const start = useCallback(async () => {
    stop()
    setState('loading')
    setMsg('')
    const r = await api.qr()
    if (!r.ok || !r.png || !r.qrcodeKey) {
      setState('error')
      setMsg(r.message || '二维码获取失败（后端未启动？）')
      return
    }
    setQr({ png: r.png, key: r.qrcodeKey })
    setState('waiting')
    timer.current = window.setInterval(async () => {
      const p = await api.poll(r.qrcodeKey!)
      if (p.code === 0) {
        stop()
        setMsg('登录成功')
        onDone()
      } else if (p.code === 86190) {
        setState('scanned')
        setMsg('已扫码，请在手机上确认')
      } else if (p.code === 86038) {
        stop()
        setState('error')
        setMsg('二维码已过期，点下面重新获取')
      }
    }, 2000)
  }, [onDone])

  useEffect(() => {
    start()
    return stop
  }, [start])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-sm rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="fb text-lg">扫码登录</p>
            <p className="mt-1 text-sm text-muted">用哔哩哔哩 App 扫描，Cookie 只存本机</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-sunken text-muted hover:text-ink" aria-label="关闭">
            <I.IBack size={18} />
          </button>
        </div>
        <div className="relative mx-auto grid h-[220px] w-[220px] place-items-center overflow-hidden rounded-2xl bg-white">
          {qr ? <img src={qr.png} alt="登录二维码" className="h-[204px] w-[204px]" /> : null}
          {state === 'loading' && <span className="absolute text-sm text-[#8a7f73]">二维码生成中…</span>}
          {state === 'scanned' && <span className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white">已扫码，请确认</span>}
        </div>
        <p className={`mt-3 text-center text-sm ${state === 'error' ? 'text-[#c06a5a]' : 'text-muted'}`}>
          {msg || '打开 B 站 App → 我的 → 扫一扫'}
        </p>
        <button onClick={start} className="mt-4 w-full rounded-full bg-sunken px-5 py-2 text-sm hover:text-ink">重新获取二维码</button>
      </div>
    </div>
  )
}

/* ---------------- 首页 ---------------- */
function Home({ onOpen, go }: { onOpen: (v: Video, l?: boolean) => void; go: (p: Page) => void }) {
  const [cat, setCat] = useState("全部")
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [mode, setMode] = useState<"hot" | "rec">("hot")
  const [pn, setPn] = useState(1)
  const [brush, setBrush] = useState(0)
  const [noMore, setNoMore] = useState(false)
  const [cats, setCats] = useState<string[]>(["全部"])

  const loadHot = async (page: number, append: boolean) => {
    setBusy(true)
    const r = await api.feed(page)
    setBusy(false)
    setLoading(false)
    if (!r.items.length) {
      setErr("热门列表为空，检查后端 /api/popular")
      return
    }
    setErr("")
    setVideos((prev) => (append ? [...prev, ...r.items] : r.items))
    setPn(page)
    setNoMore(r.noMore)
    setMode("hot")
  }

  const loadRec = async () => {
    setBusy(true)
    const next = brush + 1
    const list = await api.recommend(next)
    setBusy(false)
    setLoading(false)
    if (!list.length) {
      setErr("推荐流暂时不可用，先看热门")
      return
    }
    setErr("")
    setBrush(next)
    setVideos(list)
    setNoMore(true)
    setMode("rec")
    setCat("全部")
  }

  useEffect(() => {
    loadHot(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const set = Array.from(new Set(videos.map((v) => v.cat))).filter(Boolean).slice(0, 8)
    setCats(["全部", ...set])
  }, [videos])

  const list = cat === "全部" ? videos : videos.filter((v) => v.cat === cat)

  return (
    <>
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="card flex flex-col justify-between rounded-3xl p-6">
          <div>
            <p className="text-sm text-muted">晚上好</p>
            <h1 className="fb mt-1 text-2xl leading-snug">今天，想看看<br />还是听听？</h1>
          </div>
          <p className="mt-6 text-sm text-muted">每个视频都能切换为「听视频」模式，熄屏也能慢慢听。</p>
        </div>
        <ToolCard onClick={() => go("asr")} icon={I.IWave} tone="bg-sage-soft text-sage" title="音视频识别" desc="语音转文字、自动字幕，支持 20+ 种语言" />
        <ToolCard onClick={() => go("split")} icon={I.ILayers} tone="bg-blue-soft text-blue" title="人声分离" desc="一键拆分人声、伴奏、鼓点与贝斯" />
      </section>

      <div className="no-sb mb-6 flex items-center gap-2 overflow-x-auto">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${cat === c ? "bg-ink text-bg" : "bg-sunken text-muted hover:text-ink"}`}>
            {c}
          </button>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <span className="hidden font-mono text-xs text-muted sm:block">
            {mode === "rec" ? `推荐流 #${brush}` : `热门 第 ${pn} 页`} · {videos.length} 条
          </span>
          <button onClick={loadRec} disabled={busy}
            className="flex items-center gap-1 rounded-full bg-sunken px-4 py-1.5 text-sm text-muted transition hover:text-ink disabled:opacity-50">
            <I.ISpark size={15} />换一批
          </button>
        </div>
      </div>

      {err ? (
        <p className="mb-4 text-sm text-muted">
          {err}
          <button onClick={() => loadHot(1, false)} className="ml-2 underline">重试</button>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <article key={i} className="card overflow-hidden rounded-3xl">
                <div className="aspect-video w-full animate-pulse bg-sunken" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-sunken" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-sunken" />
                </div>
              </article>
            ))
          : list.map((v) => <VideoCard key={v.bvid} v={v} onOpen={onOpen} />)}
      </div>

      {!loading && list.length > 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          {mode === "hot" && !noMore ? (
            <button onClick={() => loadHot(pn + 1, true)} disabled={busy}
              className="rounded-full bg-sunken px-6 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-50">
              {busy ? "加载中…" : `加载更多（第 ${pn + 1} 页）`}
            </button>
          ) : (
            <button onClick={loadRec} disabled={busy}
              className="rounded-full bg-sunken px-6 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-50">
              {busy ? "加载中…" : mode === "rec" ? "再换一批" : "热门榜已到底，看看推荐流"}
            </button>
          )}
          <p className="text-xs text-muted">
            {mode === "hot"
              ? "热门榜是 bilibili 的固定一期，短时间刷新内容不变；要新内容点「换一批」"
              : "推荐流每次不同，来自 /x/web-interface/wbi/index/top/feed/rcmd"}
          </p>
        </div>
      ) : null}
    </>
  )
}

function ToolCard({ icon: Icon, title, desc, tone, onClick }: { icon: typeof I.IWave; title: string; desc: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card flex items-center gap-4 rounded-3xl p-6 text-left transition hover:-translate-y-0.5">
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon size={26} /></span>
      <span className="min-w-0">
        <span className="fm block">{title}</span>
        <span className="mt-1 block text-sm text-muted">{desc}</span>
      </span>
    </button>
  )
}

function VideoCard({ v, onOpen }: { v: Video; onOpen: (v: Video, l?: boolean) => void }) {
  const [f, setF] = useState(!!v.followed)
  return (
    <article className="card group overflow-hidden rounded-3xl">
      <div className="relative aspect-video cursor-pointer overflow-hidden" onClick={() => onOpen(v)}>
        <img src={img(v.cover)} alt={v.title} className="h-full w-full object-cover saturate-[.75] transition duration-500 group-hover:scale-[1.03]" />
        <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">{v.tag}</span>
        <span className="absolute bottom-3 right-3 rounded-full bg-black/35 px-2.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">{v.dur}</span>
        <button onClick={(e) => { e.stopPropagation(); onOpen(v, true) }}
          className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-xs text-[#3b332c] backdrop-blur transition hover:bg-white">
          <I.IHeadphones size={14} />听视频
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="text-accent">{v.cat}</span><span>{v.time}</span>
        </div>
        <h3 onClick={() => onOpen(v)} className="fm mt-1.5 line-clamp-2 cursor-pointer text-[15px] leading-relaxed">{v.title}</h3>
        <div className="mt-3 flex items-center gap-2">
          <img src={img(v.avatar)} alt="" className="h-6 w-6 rounded-full object-cover" />
          <span className="truncate text-sm text-muted">{v.author}</span>
          <button onClick={() => setF(!f)} className={`ml-auto shrink-0 rounded-full px-3 py-0.5 text-xs ${f ? 'bg-sunken text-muted' : 'bg-accent-soft text-accent'}`}>
            {f ? '已关注' : '+ 关注'}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-xs text-muted">
          <span className="flex items-center gap-1"><I.IPlay size={13} />{v.views}</span>
          <span className="flex items-center gap-1"><I.IHeart size={13} />{v.likes}</span>
          <span className="flex items-center gap-1"><I.IChat size={13} />{v.comments}</span>
        </div>
      </div>
    </article>
  )
}

/* ---------------- 播放页 ---------------- */
function Watch({ v, listen, setListen, onOpen, back }: { v: Video; listen: boolean; setListen: (b: boolean) => void; onOpen: (v: Video, l?: boolean) => void; back: () => void; authed: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [dur, setDur] = useState(v.duration || 0)
  const [src, setSrc] = useState('')
  const [prep, setPrep] = useState<{ running: boolean; percent: number; eta?: number } | null>(null)
  const [err, setErr] = useState('')
  const [liked, setLiked] = useState(false)
  const [tab, setTab] = useState<'sub' | 'song' | 'sep' | 'cmt'>('song')
  const [mix, setMix] = useState<string>('原声')
  const [detail, setDetail] = useState<{ stat: Record<string, number>; owner: { name: string; face: string; follower: number }; desc: string } | null>(null)
  const [related, setRelated] = useState<Video[]>([])

  /* 详情 + 合流 + 推荐 */
  useEffect(() => {
    let alive = true
    ;(async () => {
      setErr('')
      setPrep(null)
      const d = await api.video(v.bvid)
      if (!alive) return
      if (!d.ok || !d.video) { setErr(d.message || '视频信息获取失败'); return }
      setDetail({ stat: d.video.stat, owner: d.video.owner, desc: d.video.desc })
      setDur(d.video.duration)

      let polling = true
      const timer = window.setInterval(async () => {
        if (!polling) return
        const g = await api.progress(v.bvid, 80)
        if (alive && g.ok && g.running) setPrep({ running: true, percent: g.percent, eta: g.eta })
      }, 1000)
      setPrep({ running: true, percent: 0 })

      const p = await api.prepare(v.bvid, 80)
      polling = false
      window.clearInterval(timer)
      if (!alive) return
      setPrep(null)
      if (!p.ok || !p.url) { setErr(p.message || '合流失败'); return }
      setSrc(p.url)
    })()
    ;(async () => {
      const list = await api.feed(1)
      if (alive) setRelated(list.filter((x) => x.bvid !== v.bvid).slice(0, 6))
    })()
    return () => { alive = false }
  }, [v.bvid])

  /* 播放入口 */
  useEffect(() => {
    if (!src) return
    const el = listen ? audioRef.current : videoRef.current
    if (!el) return
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [src, listen])

  useEffect(() => {
    if (listen) { videoRef.current?.pause(); audioRef.current?.play().catch(() => {}) }
    else { audioRef.current?.pause(); videoRef.current?.play().catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen])

  const toggle = () => {
    const el = listen ? audioRef.current : videoRef.current
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setPlaying(true) } else { el.pause(); setPlaying(false) }
  }

  const seek = (pct: number) => {
    const el = listen ? audioRef.current : videoRef.current
    if (!el || !dur) return
    el.currentTime = (pct / 100) * dur
    setPos(pct)
  }

  const onChangeTime = () => {
    const el = listen ? audioRef.current : videoRef.current
    if (!el || !el.duration) return
    setPos((el.currentTime / el.duration) * 100)
    setDur(el.duration)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <button onClick={back} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-ink"><I.IBack size={18} />返回</button>
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-[#1f1c19]">
          <video
            ref={videoRef}
            src={src || undefined}
            poster={img(v.cover)}
            playsInline
            muted={false}
            className={`h-full w-full object-cover saturate-[.8] ${listen ? 'hidden' : ''}`}
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={onChangeTime}
            onLoadedMetadata={onChangeTime}
          />
          <audio ref={audioRef} src={api.audioUrl(v.bvid)} onTimeUpdate={onChangeTime} onLoadedMetadata={onChangeTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />

          {listen ? (
            <div className="absolute inset-0 flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#3d3029] to-[#1f1c19] pb-12 text-[#ede5da]">
              <img src={img(v.cover)} alt="" className={`h-24 w-24 rounded-full object-cover ring-8 ring-white/5 md:h-40 md:w-40 ${playing ? 'spin' : ''}`} />
              <div className="eq flex h-6 items-end gap-1 md:h-8">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className="w-1 rounded-full bg-[#d1a084]" style={{ height: '100%', animationDelay: `${i * 0.07}s`, animationPlayState: playing ? 'running' : 'paused' }} />
                ))}
              </div>
              <p className="px-6 text-center text-xs opacity-80 md:text-sm">{v.title} · 仅音频</p>
            </div>
          ) : null}

          {prep?.running ? (
            <div className="absolute inset-0 grid place-items-center bg-black/55 text-white">
              <div className="w-64 text-center">
                <p className="text-sm">正在合流音视频…</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-[#d1a084] transition-all" style={{ width: `${prep.percent}%` }} />
                </div>
                <p className="mt-1 font-mono text-xs opacity-70">
                  {prep.percent}%{prep.eta ? ` · 剩余约 ${fmtDur(prep.eta)}` : ''}
                </p>
              </div>
            </div>
          ) : null}

          {err ? <div className="absolute inset-0 grid place-items-center bg-black/60 px-6 text-center text-sm text-[#e5a79a]">{err}</div> : null}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10 text-white">
            <input type="range" min={0} max={100} step={0.1} value={pos} onChange={(e) => seek(+e.target.value)} className="w-full accent-[#d1a084]" aria-label="进度" />
            <div className="mt-1 flex items-center gap-3">
              <button onClick={toggle} aria-label="播放/暂停">{playing ? <I.IPause size={22} /> : <I.IPlay size={22} />}</button>
              <span className="font-mono text-xs opacity-80">
                {fmtDur((pos / 100) * dur)} / {fmtDur(dur)}
              </span>
              {mix !== '原声' && <span className="rounded-full bg-[#d1a084] px-2.5 py-0.5 text-xs text-[#1f1c19]">仅{mix}</span>}
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => setListen(!listen)} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs ${listen ? 'bg-[#d1a084] text-[#1f1c19]' : 'bg-white/15'}`}>
                  <I.IHeadphones size={14} />{listen ? '听视频中' : '听视频'}
                </button>
                <I.IVolume size={20} className="hidden sm:block" />
                <button onClick={() => videoRef.current?.requestFullscreen?.()} aria-label="全屏"><I.IExpand size={20} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">{v.cat}</span>
            <span className="rounded-full bg-sunken px-2.5 py-0.5 font-mono text-muted">{v.tag}</span>
          </div>
          <h1 className="fb mt-2 text-xl leading-snug md:text-2xl">{v.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {v.views} 次播放 · {v.time} · {v.bvid}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <img src={img(detail?.owner.face || v.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="mr-auto">
              <p className="fm text-sm">{detail?.owner.name || v.author}</p>
              <p className="text-xs text-muted">{fmtNum(detail?.owner.follower)} 关注</p>
            </div>
            <Pill on={liked} onClick={() => setLiked(!liked)} icon={I.IHeart}>{liked ? '已赞' : v.likes}</Pill>
            <Pill icon={I.IStar}>收藏</Pill>
            <a href={api.downloadUrl(v.bvid, 80)} className="flex items-center gap-1.5 rounded-full bg-sunken px-4 py-2 text-sm transition hover:text-accent">
              <I.IDownload size={16} />下载
            </a>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setTab('song')} className="flex items-center gap-3 rounded-2xl bg-accent-soft p-3 text-left text-accent transition hover:brightness-95">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface"><I.IMusic size={20} /></span>
              <span><span className="fm block text-sm">识别歌曲</span><span className="block text-xs opacity-75">听出视频里正在播放的音乐</span></span>
            </button>
            <button onClick={() => setTab('sep')} className="flex items-center gap-3 rounded-2xl bg-blue-soft p-3 text-left text-blue transition hover:brightness-95">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface"><I.ILayers size={20} /></span>
              <span><span className="fm block text-sm">分离人声</span><span className="block text-xs opacity-75">单独收听人声或伴奏</span></span>
            </button>
          </div>
        </div>

        <div className="card mt-6 rounded-3xl p-5">
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {(['sub', 'song', 'sep', 'cmt'] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-ink text-bg' : 'text-muted'}`}>
                {{ sub: '简介', song: '识别歌曲', sep: '人声分离', cmt: `评论 ${v.comments}` }[k]}
              </button>
            ))}
          </div>
          {tab === 'song' ? <SongPanel bvid={v.bvid} /> : tab === 'sep' ? <SepPanel bvid={v.bvid} mix={mix} setMix={setMix} /> : tab === 'sub' ? (
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap text-muted">{detail?.desc || '这个视频没有简介。'}</p>
              <p className="text-xs text-muted">AI 字幕需要 ASR 后端，本项目未接入（见 doc/BLOCKERS.md）。</p>
            </div>
          ) : (
            <Comments bvid={v.bvid} total={detail?.stat?.reply} />
          )}
        </div>
      </div>

      <aside>
        <h2 className="fm mb-3">接下来播放</h2>
        <div className="space-y-2">
          {related.map((x) => (
            <button key={x.bvid} onClick={() => onOpen(x, listen)} className="flex w-full gap-3 rounded-2xl p-1.5 text-left transition hover:bg-sunken">
              <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl">
                <img src={img(x.cover)} alt="" className="h-full w-full object-cover saturate-[.75]" />
                <span className="absolute bottom-1 right-1 rounded-full bg-black/40 px-1.5 font-mono text-[10px] text-white">{x.dur}</span>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm leading-snug">{x.title}</p>
                <p className="mt-1 text-xs text-muted">{x.author}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}

function Pill({ icon: Icon, children, on, onClick }: { icon: typeof I.IHeart; children: ReactNode; on?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition ${on ? 'bg-accent-soft text-accent' : 'bg-sunken hover:text-accent'}`}>
      <Icon size={16} />{children}
    </button>
  )
}

/* ---------------- 识别歌曲（真实 /api/analyze tracklist） ---------------- */
function SongPanel({ bvid }: { bvid: string }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [pct, setPct] = useState(0)
  const [label, setLabel] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [throttled, setThrottled] = useState(false)
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState<string[]>([])

  const run = async () => {
    setState('running')
    setPct(0)
    setLabel('正在提交识别任务…')
    const job = await api.analyze(bvid, 'tracklist', true)
    if (!job.ok || !job.jobId) {
      setState('error')
      setMsg(job.message || '任务启动失败')
      return
    }
    const tick = async () => {
      const s = await api.analyzeStatus(job.jobId!)
      if (!s.ok) { setState('error'); setMsg('任务丢失'); return }
      setLabel((s.log || []).slice(-1)[0] || s.stage || '')
      const w = s.result?.recognizer?.windows || 23
      const hit = s.result?.recognizer?.matchedWindows || 0
      setPct(s.state === 'done' ? 100 : Math.min(95, Math.round((hit / w) * 100)))
      if (s.state === 'done') {
        const list = (s.result?.tracks || [])
          .filter((t) => t.match)
          .map((t) => ({ from: t.from, to: t.to, title: t.match!.title, artist: t.match!.artist, cover: t.match!.cover, url: t.match!.url }))
        setTracks(list)
        setThrottled(!!s.result?.recognizer?.throttled)
        setState('done')
        return
      }
      if (s.state === 'error') { setState('error'); setMsg(s.error || '识别失败'); return }
      window.setTimeout(tick, 1800)
    }
    tick()
  }

  if (state === 'idle') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><I.IMusic size={28} /></span>
        <p className="fm">这首歌叫什么？</p>
        <p className="max-w-xs text-sm text-muted">扫描整片音轨，找出出现过的歌曲及其所在时间段。</p>
        <button onClick={run} className="mt-1 rounded-full bg-ink px-6 py-2 text-sm text-bg">开始识别</button>
      </div>
    )
  }
  if (state === 'running') {
    return (
      <div className="rounded-2xl bg-sunken p-4">
        <div className="flex justify-between text-sm"><span>{label || '正在聆听并匹配曲库…'}</span><span className="font-mono text-muted">{pct}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">识别失败：{msg}</p>
        <button onClick={run} className="text-sm text-muted hover:text-ink">重试</button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <I.ICheck size={16} className="text-sage" />在视频中识别到 {tracks.length} 首歌曲
        {throttled ? <span className="text-xs">（Shazam 限流，结果可能不完整）</span> : null}
      </p>
      {tracks.map((s, i) => (
        <div key={s.title + i} className="flex items-center gap-3 rounded-2xl bg-sunken p-3">
          {s.cover ? <img src={s.cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover saturate-[.75]" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface text-muted"><I.IMusic size={20} /></span>}
          <div className="min-w-0 flex-1">
            <p className="fm truncate">{s.title}</p>
            <p className="truncate text-xs text-muted">{s.artist}</p>
            <p className="mt-1 font-mono text-xs text-muted">{fmtDur(s.from)} – {fmtDur(s.to)}</p>
          </div>
          <a href={s.url} target="_blank" rel="noreferrer" className="hidden rounded-full bg-sage-soft px-2.5 py-0.5 text-xs text-sage sm:block">Shazam</a>
          <button onClick={() => setSaved(saved.includes(s.title) ? saved.filter((x) => x !== s.title) : [...saved, s.title])} aria-label="收藏歌曲" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${saved.includes(s.title) ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'}`}><I.IHeart size={16} /></button>
        </div>
      ))}
      <button onClick={run} className="text-sm text-muted hover:text-ink">重新识别</button>
    </div>
  )
}

/* ---------------- 人声分离（真实 /api/analyze full） ---------------- */
function SepPanel({ bvid, mix, setMix }: { bvid: string; mix: string; setMix: (m: string) => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [stems, setStems] = useState<Record<string, string>>({})
  const [label, setLabel] = useState('')
  const [msg, setMsg] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  const run = async () => {
    setState('running')
    setLabel('正在提交分离任务…')
    const job = await api.analyze(bvid, 'full', true)
    if (!job.ok || !job.jobId) { setState('error'); setMsg(job.message || '任务启动失败'); return }
    const tick = async () => {
      const s = await api.analyzeStatus(job.jobId!)
      setLabel((s.log || []).slice(-1)[0] || s.stage || '')
      if (s.state === 'done') {
        setStems(s.result?.stems || {})
        setState('done')
        return
      }
      if (s.state === 'error') { setState('error'); setMsg(s.error || '分离失败'); return }
      window.setTimeout(tick, 1800)
    }
    tick()
  }

  const srcOf = (name: string) =>
    name === '人声' ? stems.vocals : name === '伴奏' ? stems.instrumental : api.audioUrl(bvid)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.src = srcOf(mix)
    el.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mix, stems])

  if (state === 'idle') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-blue-soft text-blue"><I.ILayers size={28} /></span>
        <p className="fm">分离这个视频的声音</p>
        <p className="max-w-xs text-sm text-muted">把人声与背景音乐拆开，分离后可直接切换收听（需要 Replicate 额度）。</p>
        <button onClick={run} className="mt-1 rounded-full bg-ink px-6 py-2 text-sm text-bg">开始分离</button>
      </div>
    )
  }
  if (state === 'running') {
    return (
      <div className="rounded-2xl bg-sunken p-4">
        <div className="flex justify-between text-sm"><span className="truncate">{label || '正在分离人声与伴奏…'}</span><span className="font-mono text-muted">…</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full w-1/3 animate-pulse rounded-full bg-blue" /></div>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">分离失败：{msg}</p>
        <button onClick={run} className="text-sm text-muted hover:text-ink">重试</button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">分离完成，选择当前播放的声音：</p>
      <audio ref={audioRef} className="hidden" />
      {[['原声', I.IVolume, '完整混音', 'bg-sunken text-muted'], ['人声', I.IMic, '仅保留说话与演唱', 'bg-accent-soft text-accent'], ['伴奏', I.IMusic, '去除人声，保留音乐与环境', 'bg-sage-soft text-sage']].map(([n, Ic, d, tone]) => {
        const Icon = Ic as typeof I.IMic
        const ready = n === '原声' || (n === '人声' ? !!stems.vocals : !!stems.instrumental)
        return (
          <button key={n as string} disabled={!ready} onClick={() => setMix(n as string)}
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition disabled:opacity-40 ${mix === n ? 'bg-sunken ring-2 ring-accent' : 'hover:bg-sunken'}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon size={20} /></span>
            <span className="min-w-0 flex-1"><span className="fm block text-sm">{n as string}</span><span className="block text-xs text-muted">{d as string}</span></span>
            {mix === n && <I.ICheck size={18} className="text-accent" />}
          </button>
        )
      })}
      <div className="flex gap-2 pt-1">
        <a href={stems.vocals ? stems.vocals + '&dl=1' : undefined} className="flex items-center gap-1.5 rounded-full bg-sunken px-4 py-2 text-sm"><I.IDownload size={16} />下载人声</a>
        <a href={stems.instrumental ? stems.instrumental + '&dl=1' : undefined} className="flex items-center gap-1.5 rounded-full bg-sunken px-4 py-2 text-sm"><I.IDownload size={16} />下载伴奏</a>
      </div>
      <button onClick={run} className="text-sm text-muted hover:text-ink">重新分离</button>
    </div>
  )
}

/* ---------------- 评论（真实 /api/comments） ---------------- */
function Comments({ bvid, total }: { bvid: string; total?: number }) {
  const [list, setList] = useState<Comment[]>([])
  const [all, setAll] = useState(total || 0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async (pn: number) => {
    setLoading(true)
    const r = await api.comments(bvid, pn)
    setLoading(false)
    if (!r.ok) { setErr(r.message || '评论接口失败'); return }
    setAll(r.total || 0)
    setList((prev) => (pn === 1 ? r.replies : [...prev, ...r.replies]))
    setPage(pn)
  }

  useEffect(() => { load(1) /* eslint-disable-next-line */ }, [bvid])

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-muted"><I.IUser size={18} /></span>
        <input placeholder="说点温柔的话吧…（发评论需 csrf，暂未接入）" disabled className="h-10 flex-1 rounded-full bg-sunken px-4 text-sm outline-none placeholder:text-muted" />
      </div>
      {loading && !list.length ? <p className="text-sm text-muted">评论加载中…</p> : null}
      {err ? <p className="text-sm text-muted">{err}</p> : null}
      {list.map((c) => (
        <div key={c.rpid} className="flex gap-3">
          <img src={img(c.avatar)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="fm text-sm">{c.uname}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{c.content}</p>
            <p className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><I.IHeart size={12} />{fmtNum(c.like)}</span>
              {c.rcount ? <span>{c.rcount} 条回复</span> : null}
              {c.location ? <span>IP 属地：{c.location}</span> : null}
            </p>
          </div>
        </div>
      ))}
      {list.length > 0 && list.length < all ? (
        <button onClick={() => load(page + 1)} disabled={loading} className="text-sm text-muted hover:text-ink">
          {loading ? '加载中…' : `查看更多评论（${fmtNum(all - list.length)}）`}
        </button>
      ) : null}
    </div>
  )
}

/* ---------------- 未接入的工具页（保持原样式，只把假进度换成说明） ---------------- */
function Asr() {
  return (
    <div className="mx-auto max-w-3xl">
      <ToolHeader icon={I.IWave} tone="bg-sage-soft text-sage" title="音视频识别" desc="上传音频或视频，自动生成文字稿与字幕" />
      <div className="card rounded-3xl p-6 text-sm leading-relaxed text-muted">
        该功能需要 ASR（语音识别）后端，本项目尚未接入。
        <br />
        现已能用的相近能力：视频页「识别歌曲」可拉出完整 BGM 曲目表（Shazam 指纹），「人声分离」可拆出人声/伴奏轨。
      </div>
    </div>
  )
}

function Split() {
  return (
    <div className="mx-auto max-w-3xl">
      <ToolHeader icon={I.ILayers} tone="bg-blue-soft text-blue" title="人声分离" desc="AI 精准拆分音轨，干净提取人声与伴奏" />
      <div className="card rounded-3xl p-6 text-sm leading-relaxed text-muted">
        本地上传分离需要 GPU / 云端额度，暂未在此页开放。
        <br />
        视频详情页的「人声分离」标签已接入真实接口（Replicate demucs），可分离并试听、下载人声与伴奏。
      </div>
    </div>
  )
}

function ToolHeader({ icon: Icon, title, desc, tone }: { icon: typeof I.IWave; title: string; desc: string; tone: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon size={26} /></span>
      <div><h1 className="fb text-2xl">{title}</h1><p className="mt-0.5 text-sm text-muted">{desc}</p></div>
    </div>
  )
}

/* ---------------- 我的 ---------------- */
function Me({ dark, setDark, user, onLogin, onLogout }: { dark: boolean; setDark: (b: boolean) => void; user: User | null; onLogin: () => void; onLogout: () => void }) {
  const [info, setInfo] = useState<User | null>(null)
  const [folders, setFolders] = useState<{ id: number; title: string; count: number }[]>([])

  useEffect(() => {
    if (!user) { setInfo(null); setFolders([]); return }
    ;(async () => {
      const u = await api.user()
      if (u.ok && u.user) setInfo(u.user)
      const f = await api.fav()
      if (f.ok && f.folders) setFolders(f.folders)
    })()
  }, [user])

  const items: [typeof I.IClock, string, string][] = [
    [I.IClock, '观看历史', '本地记录（断点续播已生效）'],
    [I.IStar, '我的收藏', folders.length ? `${folders.length} 个收藏夹` : '登录后可见'],
    [I.IHeadphones, '离线收听', '音频流直连，不走缓存'],
    [I.IFile, '识别与分离记录', '随视频缓存保存'],
  ]

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="card flex items-center gap-4 rounded-3xl p-5">
        {user ? (
          <>
            <img src={img(user.face)} className="h-16 w-16 rounded-full object-cover" alt="" />
            <div className="min-w-0">
              <p className="fb truncate text-lg">{user.uname}</p>
              <p className="text-sm text-muted">
                {user.vip} · Lv{user.level} · UID {user.mid}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {fmtNum(info?.fans)} 粉丝 · {fmtNum(info?.favCount)} 个收藏夹
              </p>
            </div>
            <button onClick={onLogout} className="ml-auto shrink-0 rounded-full bg-sunken px-4 py-2 text-sm">退出</button>
          </>
        ) : (
          <>
            <span className="grid h-16 w-16 place-items-center rounded-full bg-sunken text-muted"><I.IUser size={26} /></span>
            <div><p className="fb text-lg">未登录</p><p className="text-sm text-muted">扫码登录后可见个人资料与收藏</p></div>
            <button onClick={onLogin} className="ml-auto shrink-0 rounded-full bg-ink px-4 py-2 text-sm text-bg">登录</button>
          </>
        )}
      </div>

      {folders.length ? (
        <div className="card rounded-3xl p-5">
          <p className="fm mb-3">收藏夹</p>
          <div className="space-y-2">
            {folders.slice(0, 8).map((f) => (
              <div key={f.id} className="flex items-center gap-3 text-sm">
                <I.IStar size={18} className="text-muted" />
                <span className="truncate">{f.title}</span>
                <span className="ml-auto font-mono text-xs text-muted">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card divide-y divide-line rounded-3xl">
        {items.map(([C, t, d]) => (
          <div key={t} className="flex items-center gap-3 px-5 py-4 text-sm">
            <C size={20} className="text-muted" />
            <span>{t}</span>
            <span className="ml-auto max-w-[52%] truncate text-xs text-muted">{d}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 px-5 py-4 text-sm">
          {dark ? <I.IMoon size={20} className="text-muted" /> : <I.ISun size={20} className="text-muted" />}深色模式
          <button onClick={() => setDark(!dark)} className={`ml-auto h-7 w-12 rounded-full p-1 transition ${dark ? 'bg-accent' : 'bg-line'}`} aria-label="切换深色模式">
            <span className={`block h-5 w-5 rounded-full bg-white transition ${dark ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
