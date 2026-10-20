import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import VideoCard from '../components/VideoCard.jsx'
import { Icon } from '../components/Icons.jsx'
import { api } from '../api.js'

export default function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [items, setItems] = useState([])
  const [num, setNum] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!q) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setErr('')
      const j = await api.search(q)
      if (!alive) return
      setLoading(false)
      if (j.ok) {
        setItems(j.items || [])
        setNum(j.numResults || (j.items || []).length)
      } else setErr(j.message || '搜索失败 code=' + j.code)
    })()
    return () => {
      alive = false
    }
  }, [q])

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-shell px-4 pb-16 pt-5 lg:px-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[20px] font-semibold text-fg-1">
            {q ? (
              <>
                <span className="text-fg-3">搜索 </span>“{q}”
              </>
            ) : (
              '发现'
            )}
          </h1>
          {q ? <span className="text-[12px] text-fg-3">找到约 {num} 个结果</span> : null}
        </div>

        {!q ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-bg-2 text-fg-3">
              <Icon.Search size={26} />
            </div>
            <p className="text-[15px] font-medium text-fg-2">想看点别的？</p>
            <p className="text-[13px] text-fg-3">在顶部搜索框输入视频名、UP 主，或直接粘贴 BV 号</p>
          </div>
        ) : loading ? (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video w-full animate-pulse rounded-lg bg-bg-2" />
                <div className="mt-2.5 h-3 w-4/5 animate-pulse rounded bg-bg-2" />
              </div>
            ))}
          </div>
        ) : err ? (
          <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-6 text-[13px] text-danger">{err}</div>
        ) : !items.length ? (
          <div className="mt-10 text-center text-[13px] text-fg-3">没找到相关视频，换个关键词试试</div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((it, i) => (
              <VideoCard key={it.bvid || i} item={it} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
