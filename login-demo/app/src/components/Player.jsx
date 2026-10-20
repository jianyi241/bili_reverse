import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'
import { fmtTime } from '../api.js'

const RATES = [0.75, 1, 1.25, 1.5, 2]

/**
 * 自研播放器：数据源是服务端合流后的 mp4（支持 Range）
 * 控制条：进度 / 播放 / 时间 / 音量 / 倍速 / 画中画 / 全屏，2.5s 自动隐藏
 */
export default function Player({ src, poster, loading, error, onDownload, title, progress, resumeAt, storageKey }) {
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)
  const lastSaved = useRef(0)

  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(1)
  const [rate, setRate] = useState(1)
  const [rateOpen, setRateOpen] = useState(false)
  const [fs, setFs] = useState(false)
  const [chrome, setChrome] = useState(true)

  /* ---------- 控制条显隐 ---------- */
  const bumpChrome = useCallback(() => {
    setChrome(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setChrome(false)
    }, 2500)
  }, [])
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  /* ---------- 快捷键 ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const v = videoRef.current
      if (!v) return
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        v.paused ? v.play() : v.pause()
      } else if (e.key === 'ArrowLeft') {
        v.currentTime = Math.max(0, v.currentTime - 5)
      } else if (e.key === 'ArrowRight') {
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5)
      } else if (e.key === 'f') {
        toggleFullscreen()
      } else if (e.key === 'm') {
        v.muted = !v.muted
        setMuted(v.muted)
      }
      bumpChrome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpChrome])

  /* ---------- 全屏 ---------- */
  const toggleFullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* ---------- 交互 ---------- */
  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play().catch(() => {}) : v.pause()
  }

  const seek = (e) => {
    const v = videoRef.current
    if (!v || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    v.currentTime = p * dur
    setTime(v.currentTime)
  }

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setTime(v.currentTime)
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
    // 断点续播：每 5 秒记一次
    if (storageKey && Math.abs(v.currentTime - lastSaved.current) > 5) {
      lastSaved.current = v.currentTime
      try {
        localStorage.setItem('aura:pos:' + storageKey, String(Math.round(v.currentTime)))
      } catch {
        /* ignore */
      }
    }
  }

  const pct = dur ? (time / dur) * 100 : 0
  const bufPct = dur ? Math.min(100, (buffered / dur) * 100) : 0

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-xl border border-line bg-black"
      onMouseMove={bumpChrome}
      onMouseLeave={() => setChrome(false)}
    >
      <div className="aspect-video w-full">
        {loading ? (
          <div className="grid h-full w-full place-items-center px-8 text-[13px] text-fg-2">
            <div className="w-full max-w-[380px] text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-line bg-bg-2">
                <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                </svg>
              </div>
              <p className="text-[13px] text-fg-1">
                {progress?.running ? '正在合流音视频…' : '正在准备播放地址…'}
              </p>
              {progress?.running ? (
                <>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-indigo-500 transition-[width] duration-500"
                      style={{ width: (progress.percent || 0) + '%' }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-fg-3 num">
                    <span>{progress.percent || 0}%</span>
                    <span>
                      {fmtTime(progress.outTime || 0)} / {fmtTime(progress.duration || 0)}
                    </span>
                    <span>
                      {progress.speed ? progress.speed.toFixed(1) + '×' : ''}
                      {progress.eta ? ` · 剩余约 ${fmtTime(progress.eta)}` : ''}
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-fg-3">首次播放该清晰度需要先合流，之后会复用缓存</p>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="grid h-full w-full place-items-center px-6 text-center text-[13px] text-danger">{error}</div>
        ) : (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            playsInline
            className="h-full w-full bg-black"
            onClick={toggle}
            onPlay={() => {
              setPlaying(true)
              bumpChrome()
            }}
            onPause={() => {
              setPlaying(false)
              setChrome(true)
            }}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={() => {
              const v = videoRef.current
              setDur(v?.duration || 0)
              // 断点续播：上次看到的位置（距结尾 10s 内则从头）
              if (v && resumeAt > 5 && resumeAt < (v.duration || 0) - 10) {
                v.currentTime = resumeAt
              }
            }}
            onDurationChange={() => setDur(videoRef.current?.duration || 0)}
            onVolumeChange={() => {
              setMuted(videoRef.current?.muted || false)
              setVol(videoRef.current?.volume ?? 1)
            }}
          />
        )}
      </div>

      {/* 标题（顶部渐变） */}
      {title && !loading && (
        <div
          className={
            'pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity ' +
            (chrome ? 'opacity-100' : 'opacity-0')
          }
        >
          <span className="clamp-2 text-[14px] font-medium text-white/90">{title}</span>
        </div>
      )}

      {/* 控制条 */}
      {!loading && !error && (
        <div
          className={
            'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-8 transition-opacity ' +
            (chrome ? 'opacity-100' : 'opacity-0')
          }
        >
          {/* 进度 */}
          <div className="group/seek relative h-4 cursor-pointer" onClick={seek}>
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white/40" style={{ width: bufPct + '%' }} />
            </div>
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand" style={{ width: pct + '%' }} />
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition group-hover/seek:opacity-100"
              style={{ left: pct + '%' }}
            />
          </div>

          <div className="mt-1 flex items-center gap-2 text-white">
            <button className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/15" onClick={toggle}>
              {playing ? <Icon.Pause size={17} /> : <Icon.Play size={17} />}
            </button>
            <span className="num text-[12px] text-white/85">
              {fmtTime(time)} <span className="text-white/40">/</span> {fmtTime(dur)}
            </span>

            {/* 音量 */}
            <div className="group/vol ml-1 flex items-center">
              <button
                className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/15"
                onClick={() => {
                  const v = videoRef.current
                  if (!v) return
                  v.muted = !v.muted
                }}
              >
                {muted || vol === 0 ? <Icon.VolumeOff size={17} /> : <Icon.Volume size={17} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={muted ? 0 : vol}
                onChange={(e) => {
                  const v = videoRef.current
                  if (!v) return
                  v.volume = Number(e.target.value)
                  v.muted = Number(e.target.value) === 0
                }}
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 accent-white"
              />
            </div>

            <div className="ml-auto flex items-center gap-1">
              {/* 倍速 */}
              <div className="relative">
                <button
                  className="h-8 rounded-full px-2 text-[12px] transition hover:bg-white/15"
                  onClick={() => setRateOpen((v) => !v)}
                >
                  {rate}×
                </button>
                {rateOpen && (
                  <div className="absolute bottom-9 right-0 w-20 overflow-hidden rounded-lg border border-line bg-bg-2 py-1 shadow-float">
                    {RATES.map((r) => (
                      <button
                        key={r}
                        className={
                          'block w-full px-3 py-1.5 text-left text-[12px] transition hover:bg-bg-3 ' +
                          (r === rate ? 'text-brand' : 'text-fg-2')
                        }
                        onClick={() => {
                          const v = videoRef.current
                          if (v) v.playbackRate = r
                          setRate(r)
                          setRateOpen(false)
                        }}
                      >
                        {r}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {onDownload && (
                <button
                  className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/15"
                  title="下载 mp4"
                  onClick={onDownload}
                >
                  <Icon.Download size={17} />
                </button>
              )}

              <button
                className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/15"
                title="画中画"
                onClick={() => videoRef.current?.requestPictureInPicture?.().catch(() => {})}
              >
                <Icon.Pip size={17} />
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/15"
                title="全屏（F）"
                onClick={toggleFullscreen}
              >
                {fs ? <Icon.Shrink size={17} /> : <Icon.Expand size={17} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
