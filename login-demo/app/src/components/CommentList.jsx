import { useEffect, useState } from 'react'
import { Icon } from './Icons.jsx'
import { api, fmtNum, fmtDate } from '../api.js'

/** 评论流：只读。每个评论是淡白半透明块，无分割线 */
export default function CommentList({ bvid, total }) {
  const [list, setList] = useState([])
  const [page, setPage] = useState(1)
  const [all, setAll] = useState(total || 0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sort, setSort] = useState('hot')

  const load = async (pn) => {
    if (!bvid) return
    setLoading(true)
    setErr('')
    const j = await api.comments(bvid, pn)
    setLoading(false)
    if (!j.ok) return setErr(j.message || '加载失败 code=' + j.code)
    setAll(j.total || 0)
    setList((prev) => (pn === 1 ? j.replies || [] : [...prev, ...(j.replies || [])]))
    setPage(pn)
  }

  useEffect(() => {
    setList([])
    setPage(1)
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bvid])

  return (
    <section className="rounded-lg border border-line bg-bg-2">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <h2 className="text-[15px] font-medium text-fg-1">
          全部评论 <span className="num ml-1 text-[13px] text-fg-3">{fmtNum(all)}</span>
        </h2>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-line p-0.5">
          {[
            { k: 'hot', label: '按热度' },
            { k: 'new', label: '按时间' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setSort(t.k)}
              className={
                'h-6 rounded-full px-2.5 text-[11px] transition ' +
                (sort === t.k ? 'bg-bg-3 text-fg-1' : 'text-fg-3 hover:text-fg-2')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* 输入框（占位） */}
      <div className="mx-4 mb-3 flex items-start gap-3 rounded-lg bg-white/[0.03] p-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-3 text-fg-3">
          <Icon.User size={16} />
        </div>
        <div className="flex-1">
          <div className="rounded-lg border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg-3">
            善语结善缘，写下你对这个视频的看法…
          </div>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-fg-3">
            <Icon.Sparkles size={14} />
            <Icon.Film size={14} />
            <Icon.Message size={14} />
            <span className="ml-auto num">0 / 1000</span>
            <button className="btn-primary !h-7 !px-3 !text-[12px] opacity-40" disabled>
              发布
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {loading && !list.length ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 rounded-lg bg-white/[0.02] p-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-bg-3" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-24 animate-pulse rounded bg-bg-3" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-bg-3" />
                </div>
              </div>
            ))}
          </div>
        ) : err ? (
          <div className="px-3 py-6 text-[13px] text-danger">{err}</div>
        ) : !list.length ? (
          <div className="px-3 py-10 text-center text-[13px] text-fg-3">还没有评论</div>
        ) : (
          list.map((c, i) => (
            <article key={c.rpid} className="flex gap-3 rounded-lg bg-white/[0.03] p-3 transition hover:bg-white/[0.05]">
              <img
                src={api.img(c.avatar)}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-full bg-bg-3 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                  <span className="truncate font-medium text-fg-2">{c.uname}</span>
                  <span className="rounded border border-line px-1 text-[10px]">Lv{Math.min(6, (c.rpid % 6) + 1)}</span>
                  <span className="num">#{list.length - i} 楼</span>
                  <span>{fmtDate(c.ctime)}</span>
                  {c.location ? <span className="truncate">IP 属地：{c.location}</span> : null}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg-2">
                  {c.content}
                </p>
                <div className="mt-2 flex items-center gap-4 text-[12px] text-fg-3">
                  <button className="inline-flex items-center gap-1 transition hover:text-fg-1">
                    <Icon.Heart size={13} /> <span className="num">{fmtNum(c.like)}</span>
                  </button>
                  <button className="inline-flex items-center gap-1 transition hover:text-fg-1">
                    <Icon.Message size={13} /> 回复
                  </button>
                  {c.rcount ? (
                    <span className="num text-[11px] text-fg-3">{c.rcount} 条回复</span>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}

        {list.length > 0 && list.length < all && (
          <div className="py-2 text-center">
            <button className="btn-ghost mx-auto" disabled={loading} onClick={() => load(page + 1)}>
              {loading ? '加载中…' : '查看更多评论'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
