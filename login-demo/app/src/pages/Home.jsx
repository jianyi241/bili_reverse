import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import VideoCard from '../components/VideoCard.jsx'
import { Icon } from '../components/Icons.jsx'
import { api, fmtNum, fmtTime } from '../api.js'

const CHIPS = ['全部', '动画', '音乐', '游戏', '影视', '知识', '科技', '美食', '旅行', '纪录片']

export default function Home() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [chip, setChip] = useState('全部')
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      const j = await api.popular(1)
      setLoading(false)
      if (j.ok) setItems(j.items || [])
      else setErr(j.message || '加载失败 code=' + j.code)
    })()
  }, [])

  const hero = items[0]
  const rest = items.slice(1)

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-shell px-4 pb-16 pt-4 lg:px-6">
        {/* Hero */}
        {loading ? (
          <div className="h-[320px] w-full animate-pulse rounded-xl bg-bg-2" />
        ) : hero ? (
          <section className="relative overflow-hidden rounded-xl border border-line bg-bg-2">
            <div className="relative h-[300px] w-full sm:h-[360px] lg:h-[420px]">
              <img
                src={api.img(hero.cover)}
                alt=""
                fetchPriority="high"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-0 via-bg-0/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 lg:p-8">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-brand/90 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    今日精选
                  </span>
                  <span className="rounded-full border border-line bg-black/40 px-2.5 py-0.5 text-[11px] text-fg-2 backdrop-blur">
                    {hero.meta || '热门'}
                  </span>
                </div>
                <h1 className="clamp-2 max-w-[70%] text-[22px] font-semibold leading-tight text-fg-1 lg:text-[26px]">
                  {hero.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-fg-2">
                  <span className="inline-flex items-center gap-1">
                    <Icon.User size={13} /> {hero.up}
                  </span>
                  <span className="inline-flex items-center gap-1 num">
                    <Icon.Eye size={13} /> {fmtNum(hero.play)} 播放
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link to={`/watch/${hero.bvid}`} className="btn-primary">
                    <Icon.Play size={16} />
                    立即播放
                  </Link>
                  <button className="btn-ghost !bg-black/40 backdrop-blur">
                    <Icon.Star size={16} />
                    稍后再看
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-line bg-bg-2 p-10 text-center text-[13px] text-fg-3">
            {err || '暂无数据'}
          </div>
        )}

        {/* 分类 chips */}
        <div className="no-scrollbar mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={'chip ' + (chip === c ? 'chip-on' : '')}
            >
              {c}
            </button>
          ))}
          <span className="ml-auto shrink-0 text-[12px] text-fg-3">
            共 {items.length} 条 · 来自 /x/web-interface/popular
          </span>
        </div>

        {/* 网格 */}
        <section className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-video w-full animate-pulse rounded-lg bg-bg-2" />
                  <div className="mt-2.5 h-3 w-4/5 animate-pulse rounded bg-bg-2" />
                  <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-bg-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 2xl:grid-cols-4">
              {rest.map((it) => (
                <VideoCard key={it.bvid} item={it} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-14 border-t border-line pt-6 text-[12px] text-fg-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© 2026 AuraVideo · 数据来自 bilibili 公开接口（本项目仅用于本地逆向研究）</span>
            <span className="flex items-center gap-4">
              <span>关于</span>
              <span>接口文档</span>
              <span>更新日志</span>
            </span>
          </div>
        </footer>
      </main>
    </div>
  )
}
