import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import Player from '../components/Player.jsx'
import CommentList from '../components/CommentList.jsx'
import AnalyzePanel from '../components/AnalyzePanel.jsx'
import { Icon } from '../components/Icons.jsx'
import { api, fmtNum, fmtTime, fmtDate } from '../api.js'

const QUALITIES = [
  { id: 80, name: '1080P' },
  { id: 64, name: '720P' },
  { id: 32, name: '480P' },
  { id: 16, name: '360P' },
]

export default function Watch() {
  const { bvid } = useParams()
  const [video, setVideo] = useState(null)
  const [related, setRelated] = useState([])
  const [quality, setQuality] = useState(80)
  const [qOpen, setQOpen] = useState(false)
  const [src, setSrc] = useState('')
  const [preparing, setPreparing] = useState(true)
  const [progress, setProgress] = useState(null)
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [descOpen, setDescOpen] = useState(false)
  const [resumeAt, setResumeAt] = useState(0)
  const [audioOn, setAudioOn] = useState(false)

  /* 相关推荐 */
  useEffect(() => {
    let alive = true
    ;(async () => {
      const j = await api.popular(1)
      if (alive && j.ok) setRelated((j.items || []).filter((x) => x.bvid !== bvid).slice(0, 12))
    })()
    return () => {
      alive = false
    }
  }, [bvid])

  /* 详情 + 合流 */
  useEffect(() => {
    let alive = true
    ;(async () => {
      setVideo(null)
      setSrc('')
      setErr('')
      setInfo(null)
      setProgress(null)
      setPreparing(true)
      setAudioOn(false)

      const v = await api.video(bvid)
      if (!alive) return
      if (!v.ok) {
        setPreparing(false)
        return setErr(v.message || '视频信息获取失败 code=' + v.code)
      }
      setVideo(v.video)
      try {
        setResumeAt(Number(localStorage.getItem('aura:pos:' + bvid) || 0))
      } catch {
        setResumeAt(0)
      }

      let polling = true
      const timer = setInterval(async () => {
        if (!polling) return
        const g = await api.progress(bvid, quality)
        if (alive && g.ok) setProgress(g)
      }, 900)

      const p = await api.prepare(bvid, quality)
      polling = false
      clearInterval(timer)
      if (!alive) return
      setPreparing(false)
      if (!p.ok) return setErr(p.message || '合流失败')
      setInfo(p)
      setProgress({ running: false, done: true, percent: 100 })
      setSrc(p.url)
    })()
    return () => {
      alive = false
    }
  }, [bvid, quality])

  const v = video
  const stat = v?.stat || {}
  const qName = QUALITIES.find((q) => q.id === quality)?.name

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-shell px-4 pb-16 pt-4 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* 左列 */}
          <div className="min-w-0">
            {err && !v ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center text-[13px] text-danger">
                {err}
              </div>
            ) : (
              <Player
                src={src}
                poster={v ? api.img(v.pic) : ''}
                loading={preparing}
                error={err}
                title={v?.title}
                progress={progress}
                resumeAt={resumeAt}
                storageKey={bvid}
                onDownload={() => window.open(api.downloadUrl(bvid, quality), '_blank')}
              />
            )}

            {/* 仅音频 */}
            {audioOn ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2">
                <Icon.Music size={16} className="shrink-0 text-brand" />
                <audio src={api.audioUrl(bvid)} controls autoPlay className="h-8 w-full" />
                <button className="shrink-0 text-[12px] text-fg-3 hover:text-fg-1" onClick={() => setAudioOn(false)}>
                  收起
                </button>
              </div>
            ) : null}

            {/* 标签 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded bg-brand/15 px-2 py-0.5 text-[11px] text-brand">{qName}</span>
              <span className="rounded border border-line px-2 py-0.5 text-[11px] text-fg-3">
                原始分辨率 {v ? (info?.quality === 80 ? '1080P' : qName) : '—'}
              </span>
              {v?.tname ? (
                <Link to="/search" className="rounded border border-line px-2 py-0.5 text-[11px] text-fg-2 hover:border-line-2">
                  {v.tname}
                </Link>
              ) : null}
              <span className="rounded border border-line px-2 py-0.5 text-[11px] text-fg-3">音频 {info ? '204kbps' : '—'}</span>
            </div>

            {/* 标题 */}
            <h1 className="mt-2 text-[22px] font-semibold leading-snug text-fg-1">{v?.title || '加载中…'}</h1>

            {/* 数据行 */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-fg-3">
              <span className="inline-flex items-center gap-1 num">
                <Icon.Eye size={13} /> {fmtNum(stat.view)} 观看
              </span>
              <span className="inline-flex items-center gap-1 num">
                <Icon.Film size={13} /> {fmtNum(stat.danmaku)} 弹幕
              </span>
              <span className="inline-flex items-center gap-1 num">
                <Icon.Message size={13} /> {fmtNum(stat.reply)} 评论
              </span>
              <span>{fmtDate(v?.pubdate)}</span>
            </div>

            {/* 操作条 */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-ghost">
                <Icon.Heart size={15} />
                <span className="num">{fmtNum(stat.like)}</span>
              </button>
              <button className="btn-ghost">
                <Icon.Coin size={15} />
                <span className="num">{fmtNum(stat.coin)}</span>
              </button>
              <button className="btn-ghost">
                <Icon.Star size={15} />
                <span className="num">{fmtNum(stat.favorite)}</span>
              </button>
              <button className="btn-ghost">
                <Icon.Share size={15} />
                分享
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  className={'btn-ghost ' + (audioOn ? '!border-brand/40 !text-brand' : '')}
                  onClick={() => setAudioOn((x) => !x)}
                  title="只播放音频（不加载画面）"
                >
                  <Icon.Music size={15} />
                  {audioOn ? '收起音频' : '听音频'}
                </button>

                {/* 清晰度 */}
                <div className="relative">
                  <button className="btn-ghost" onClick={() => setQOpen((x) => !x)}>
                    <Icon.Settings size={15} />
                    {qName}
                    <Icon.ChevronRight size={13} className="rotate-90 text-fg-3" />
                  </button>
                  {qOpen && (
                    <div className="absolute bottom-11 right-0 z-20 w-28 overflow-hidden rounded-lg border border-line bg-bg-2 py-1 shadow-float">
                      {QUALITIES.map((q) => (
                        <button
                          key={q.id}
                          className={
                            'flex w-full items-center justify-between px-3 py-1.5 text-[12px] transition hover:bg-bg-3 ' +
                            (q.id === quality ? 'text-brand' : 'text-fg-2')
                          }
                          onClick={() => {
                            setQuality(q.id)
                            setQOpen(false)
                          }}
                        >
                          {q.name}
                          {q.id === quality ? <Icon.Check size={13} /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <a className="btn-ghost" href={api.downloadUrl(bvid, quality)}>
                  <Icon.Download size={15} />
                  下载
                </a>
              </div>
            </div>

            {/* UP 主 */}
            {v ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-white/[0.03] p-4">
                <img
                  src={api.img(v.owner?.face)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 shrink-0 rounded-full bg-bg-3 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-fg-1">{v.owner?.name}</span>
                    <span className="num rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-3">
                      {fmtNum(v.owner?.follower)} 粉丝
                    </span>
                  </div>
                  <p className={'mt-1 text-[12px] leading-relaxed text-fg-3 ' + (descOpen ? '' : 'clamp-2')}>
                    {v.desc || '这个 UP 主很神秘，什么都没写。'}
                  </p>
                  {v.desc && v.desc.length > 80 ? (
                    <button className="mt-1 text-[12px] text-brand" onClick={() => setDescOpen((x) => !x)}>
                      {descOpen ? '收起' : '展开'}
                    </button>
                  ) : null}
                </div>
                <button className="btn-primary shrink-0 !h-8 !px-3 !text-[12px]">
                  <Icon.Check size={14} />已关注
                </button>
              </div>
            ) : null}

            {/* 合流信息 */}
            {info ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-3">
                <span className="rounded-full border border-line bg-white/[0.03] px-2 py-0.5">
                  合流 {QUALITIES.find((q) => q.id === info.quality)?.name || info.quality}
                </span>
                <span className="num">{(info.size / 1048576).toFixed(1)} MB</span>
                <span className="num">{fmtTime(info.duration)}</span>
                <span>{info.ms ? `ffmpeg ${(info.ms / 1000).toFixed(1)}s` : '命中缓存'}</span>
              </div>
            ) : null}

            {/* BGM 分析 */}
            <AnalyzePanel bvid={bvid} />

            {/* 评论 */}
            <div className="mt-6">
              <CommentList bvid={bvid} total={stat.reply} />
            </div>
          </div>

          {/* 右列 */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-lg border border-line bg-bg-2">
              <header className="flex items-center justify-between px-4 py-3">
                <h2 className="text-[14px] font-medium text-fg-1">推荐视频</h2>
                <span className="text-[11px] text-fg-3">自动连播</span>
              </header>
              <ul className="max-h-[calc(100vh-180px)] space-y-1 overflow-auto p-2">
                {related.map((it, i) => (
                  <li key={it.bvid}>
                    <Link
                      to={`/watch/${it.bvid}`}
                      className="flex gap-3 rounded-lg p-2 transition hover:bg-white/[0.06]"
                    >
                      <div className="relative aspect-video w-[132px] shrink-0 overflow-hidden rounded bg-bg-3">
                        <img
                          src={api.img(it.cover)}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] text-white num">
                          {i + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="clamp-2 text-[12px] font-medium leading-snug text-fg-1">{it.title}</p>
                        <p className="mt-1 truncate text-[11px] text-fg-3">{it.up}</p>
                        <p className="num mt-0.5 text-[11px] text-fg-3">{fmtNum(it.play)} 播放</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
