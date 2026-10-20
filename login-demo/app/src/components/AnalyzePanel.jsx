import { useEffect, useRef, useState } from 'react'
import { api, fmtTime } from '../api.js'
import { Icon } from './Icons.jsx'

const MODES = [
  { key: 'recognize', label: '识别 BGM', hint: '扫 5 个窗口，零成本，几秒出结果' },
  { key: 'tracklist', label: '全片扫描', hint: '12s 窗 / 10s 步进，输出完整曲目表' },
  { key: 'full', label: '分离 + 识别', hint: '云端 demucs 分 4 轨再识别（需 Replicate 额度）' },
]

const STAGE = {
  queued: '排队中',
  resolve: '解析音频流',
  download: '下载音频',
  separate: '分离人声与伴奏',
  recognize: '识别中',
  done: '完成',
}

/** BGM / 音频分析面板：识别、全片扫描、分离+识别 */
export default function AnalyzePanel({ bvid }) {
  const [mode, setMode] = useState('recognize')
  const [state, setState] = useState('idle') // idle | running | done | error
  const [stage, setStage] = useState('')
  const [lines, setLines] = useState([])
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  const run = async (m = mode) => {
    setMode(m)
    setOpen(true)
    setState('running')
    setStage('queued')
    setLines([])
    setResult(null)
    setErr('')
    const j = await api.analyze(bvid, m, state === 'done')
    if (!j.ok) {
      setState('error')
      setErr(j.message || '任务启动失败')
      return
    }
    const tick = async () => {
      const s = await api.analyzeStatus(j.jobId)
      if (!s.ok) {
        setState('error')
        setErr('任务丢失')
        return
      }
      setStage(s.stage)
      setLines((prev) => {
        const line = (s.log || []).slice(-1)[0]
        if (!line || prev[prev.length - 1] === line) return prev
        return [...prev.slice(-4), line]
      })
      if (s.state === 'done') {
        setState('done')
        setResult(s.result)
        return
      }
      if (s.state === 'error') {
        setState('error')
        setErr(s.error || '分析失败')
        return
      }
      timer.current = setTimeout(tick, 2000)
    }
    tick()
  }

  const tracks = (result?.tracks || []).filter((t) => t?.match)
  const song = result?.bgm?.match || null
  const stems = result?.stems || {}

  return (
    <section className="mt-4 rounded-lg border border-line bg-white/[0.03]">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-fg-1">
          <Icon.Music size={16} className="text-brand" />
          BGM 分析
        </span>
        <span className="text-[11px] text-fg-3">分离音轨 · 识别曲目 · 合集拆曲</span>
        <div className="ml-auto flex items-center gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={
                'h-7 rounded-full border px-2.5 text-[12px] transition ' +
                (state === 'running'
                  ? 'border-line text-fg-3 opacity-50'
                  : 'border-line text-fg-2 hover:border-brand/50 hover:text-fg-1')
              }
              disabled={state === 'running'}
              title={m.hint}
              onClick={() => run(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {state === 'running' && (
            <div className="flex items-center gap-2 text-[12px] text-fg-2">
              <svg className="h-3.5 w-3.5 animate-spin text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.2-8.6" />
              </svg>
              <span className="font-medium">{STAGE[stage] || stage}</span>
              <span className="truncate text-fg-3">{lines[lines.length - 1] || ''}</span>
            </div>
          )}

          {state === 'error' && <p className="text-[12px] text-danger">{err}</p>}

          {state === 'done' && (
            <div className="space-y-3">
              {tracks.length > 1 ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-[12px]">
                    <span className="text-fg-2">曲目表</span>
                    <span className="rounded-full bg-brand/15 px-2 text-[11px] text-brand">{tracks.length} 首</span>
                    {result?.recognizer?.throttled ? (
                      <span className="text-[11px] text-yellow-500/80">被限流，结果不完整</span>
                    ) : null}
                  </div>
                  <ul className="max-h-[240px] space-y-0.5 overflow-auto">
                    {tracks.map((t, i) => (
                      <li key={i} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-white/[0.04]">
                        <span className="w-10 shrink-0 font-mono text-[11px] text-fg-3">{fmtTime(t.from)}</span>
                        {t.match.cover ? (
                          <img src={t.match.cover} alt="" referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 rounded object-cover" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-[12px] text-fg-1">{t.match.title}</span>
                        <span className="max-w-[120px] truncate text-[11px] text-fg-3">{t.match.artist}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : song ? (
                <div className="flex items-center gap-3">
                  {song.cover ? (
                    <img src={song.cover} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg-1">{song.title}</p>
                    <p className="truncate text-[12px] text-fg-3">
                      {song.artist}
                      {song.released ? ` · ${song.released}` : ''}
                      {song.genre ? ` · ${song.genre}` : ''}
                    </p>
                  </div>
                  {song.url ? (
                    <a href={song.url} target="_blank" rel="noreferrer" className="ml-auto text-[12px] text-brand">
                      Shazam ↗
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-[12px] text-fg-3">没识别出曲目（可能是原创配乐，或被 Shazam 限流）</p>
              )}

              {Object.keys(stems).length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(stems).map(([k, url]) => (
                    <div key={k} className="rounded border border-line bg-bg-2 p-2">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-fg-3">
                        <span>{({ vocals: '人声', instrumental: '伴奏/BGM', drums: '鼓', bass: '贝斯', other: '其他' })[k] || k}</span>
                        <a href={url + '&dl=1'} className="text-brand">下载</a>
                      </div>
                      <audio src={url} controls preload="none" className="h-7 w-full" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
