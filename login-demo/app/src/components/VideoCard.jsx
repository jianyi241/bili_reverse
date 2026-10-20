import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Icon } from './Icons.jsx'
import { api, fmtNum, fmtTime } from '../api.js'

/** 卡片：封面 + 标题 + UP + 播放量；hover 显示「听音频 / 下载」 */
export default function VideoCard({ item, size = 'normal' }) {
  const cover = item.cover || item.pic
  const title = item.title
  const bvid = item.bvid
  const big = size === 'big'
  const [playing, setPlaying] = useState(false)

  const toggleAudio = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setPlaying((v) => !v)
  }

  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-lg border border-line bg-bg-2">
        <div className="aspect-video w-full bg-bg-3">
          {cover ? (
            <img
              src={api.img(cover)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-fg-3">
              <Icon.Film size={28} />
            </div>
          )}
        </div>

        {/* 整卡点击层放在最底层，给上面的按钮留出点击区 */}
        <Link to={bvid ? `/watch/${bvid}` : '/'} className="absolute inset-0 z-0" aria-label={title} />

        {item.duration ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded bg-black/75 px-1.5 py-[1px] text-[11px] text-white num">
            {fmtTime(item.duration)}
          </span>
        ) : null}

        {/* hover 操作 */}
        <div className="absolute inset-0 z-20 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          {bvid ? (
            <>
              <button
                className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-brand"
                title={playing ? '收起音频' : '仅播放音频'}
                onClick={toggleAudio}
              >
                <Icon.Music size={15} />
              </button>
              <a
                className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-brand"
                href={api.downloadUrl(bvid, 80)}
                title="下载 mp4（服务端合流）"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon.Download size={15} />
              </a>
              <Link
                to={`/watch/${bvid}`}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-brand"
                title="播放"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon.Play size={14} />
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {playing && bvid ? (
        <audio src={api.audioUrl(bvid)} controls autoPlay className="mt-2 h-8 w-full" />
      ) : null}

      <div className="mt-2.5">
        <h3 className={'clamp-2 font-medium leading-snug text-fg-1 ' + (big ? 'text-[15px]' : 'text-[14px]')}>
          {title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-fg-3">
          {item.up ? <span className="truncate">{item.up}</span> : null}
          <span className="inline-flex items-center gap-1 num">
            <Icon.Eye size={13} />
            {fmtNum(item.play ?? item.view)}
          </span>
        </div>
      </div>
    </article>
  )
}
