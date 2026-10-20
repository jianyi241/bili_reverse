import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtNum, fmtDate, fmtTime } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import { Icon } from '../components/Icons.jsx'
import { useUser } from '../context/UserContext.jsx'

const PAGE_SIZE = 20

/** 收藏页：顶部目录 chips 切换 + 下方视频网格 */
export default function Fav() {
  const { user, openLogin } = useUser()
  const [folders, setFolders] = useState([])
  const [active, setActive] = useState(null)
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const j = await api.fav()
      setLoading(false)
      if (!j.ok) return setErr(j.message || '收藏夹获取失败 code=' + j.code)
      setFolders(j.folders || [])
      if ((j.folders || []).length) openFolder(j.folders[0])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const openFolder = async (f, pn = 1) => {
    setActive(f.id)
    setLoading(true)
    setErr('')
    const j = await api.favItems(f.id, pn)
    setLoading(false)
    if (!j.ok) return setErr(j.message || '加载失败 code=' + j.code)
    const list = (j.items || []).filter(Boolean)
    setItems((prev) => (pn === 1 ? list : [...prev, ...list]))
    setPage(pn)
    setNote(`「${f.title}」共 ${f.count} 个收藏`)
  }

  if (!user) {
    return (
      <>
        <TopBar />
        <div className="mx-auto max-w-shell px-6 py-24 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-bg-2 text-fg-3">
          <Icon.Star size={26} />
        </div>
        <p className="text-[15px] font-medium text-fg-2">登录后可以查看收藏夹</p>
        <p className="mt-1 text-[13px] text-fg-3">支持扫码登录，Cookie 只存在本机</p>
        <button className="btn-primary mx-auto mt-5" onClick={openLogin}>
          <Icon.User size={16} />
          扫码登录
        </button>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-full">
      <TopBar />
      <div className="mx-auto max-w-shell px-4 pb-16 pt-5 lg:px-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[20px] font-semibold text-fg-1">我的收藏</h1>
        <span className="text-[12px] text-fg-3">
          {folders.length} 个收藏夹 {note ? '· ' + note : ''}
        </span>
      </div>

      {/* 目录 */}
      {folders.length > 0 && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => openFolder(f)}
              className={'chip shrink-0 ' + (active === f.id ? 'chip-on' : '')}
              title={f.title}
            >
              <span className="max-w-[180px] truncate">{f.title}</span>
              <span className={'ml-1.5 num text-[11px] ' + (active === f.id ? 'text-white/70' : 'text-fg-3')}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {err ? (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-6 text-[13px] text-danger">{err}</div>
      ) : loading && !items.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-video w-full animate-pulse rounded-lg bg-bg-2" />
              <div className="mt-2.5 h-3 w-4/5 animate-pulse rounded bg-bg-2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((it, i) => (
              <FavCard key={(it.bvid || '') + i} item={it} />
            ))}
          </div>
          {items.length >= PAGE_SIZE && (
            <div className="mt-8 text-center">
              <button className="btn-ghost mx-auto" disabled={loading} onClick={() => openFolder({ ...folders.find((f) => f.id === active) }, page + 1)}>
                {loading ? '加载中…' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}

function FavCard({ item }) {
  const [playing, setPlaying] = useState(false)
  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-lg border border-line bg-bg-2">
        <Link to={item.bvid ? `/watch/${item.bvid}` : '/'} className="block aspect-video w-full bg-bg-3">
          {item.cover ? (
            <img
              src={api.img(item.cover)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
        </Link>
        {item.duration ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-[1px] text-[11px] text-white num">
            {fmtTime(item.duration)}
          </span>
        ) : null}
        <div className="absolute inset-0 z-10 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          <button
            className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-brand"
            title="仅播放音频"
            onClick={(e) => {
              e.preventDefault()
              setPlaying((v) => !v)
            }}
          >
            <Icon.Music size={15} />
          </button>
          <a
            className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-brand"
            href={api.downloadUrl(item.bvid, 80)}
            title="下载 mp4"
          >
            <Icon.Download size={15} />
          </a>
        </div>
      </div>
      {playing ? <audio src={api.audioUrl(item.bvid)} controls autoPlay className="mt-2 h-8 w-full" /> : null}
      <h3 className="clamp-2 mt-2.5 text-[14px] font-medium leading-snug text-fg-1">{item.title}</h3>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-fg-3">
        <span className="truncate">{item.up}</span>
        {item.favTime ? <span className="num">{fmtDate(item.favTime)}</span> : null}
      </div>
    </article>
  )
}
