import type { ReactNode, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const make = (paths: ReactNode) =>
  function Icon({ size = 20, ...p }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
        {paths}
      </svg>
    )
  }

export const IHome = make(<path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-6v5H5.5A1.5 1.5 0 0 1 4 19z" />)
export const ISearch = make(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>)
export const IHeadphones = make(<><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3.5" y="14" width="4" height="6.5" rx="2" /><rect x="16.5" y="14" width="4" height="6.5" rx="2" /></>)
export const IPlay = make(<path d="M8 5.8v12.4a1 1 0 0 0 1.5.86l10-6.2a1 1 0 0 0 0-1.72l-10-6.2A1 1 0 0 0 8 5.8z" fill="currentColor" stroke="none" />)
export const IPause = make(<><rect x="6.5" y="5" width="4" height="14" rx="1.6" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="4" height="14" rx="1.6" fill="currentColor" stroke="none" /></>)
export const IHeart = make(<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" />)
export const IStar = make(<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />)
export const IChat = make(<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h.5A2.5 2.5 0 0 1 5 13.5z" />)
export const IShare = make(<><path d="M12 15V4.5M8 8l4-3.5L16 8" /><path d="M5 13v4.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V13" /></>)
export const ISun = make(<><circle cx="12" cy="12" r="4" /><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1" /></>)
export const IMoon = make(<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />)
export const IWave = make(<path d="M3 12h1.5M6.5 8v8M10 5v14M13.5 9v6M17 6.5v11M20.5 11v2" />)
export const ILayers = make(<><path d="m12 4 8 4-8 4-8-4z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></>)
export const IUpload = make(<><path d="M12 15.5V5M8 8.5 12 4.5l4 4" /><path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" /></>)
export const IUser = make(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>)
export const IBell = make(<><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>)
export const IClock = make(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4.2l2.8 1.8" /></>)
export const IBack = make(<path d="M14.5 6 8.5 12l6 6" />)
export const IMic = make(<><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3" /></>)
export const IMusic = make(<><path d="M9 17.5V6.5l10-2v11" /><circle cx="6.8" cy="17.5" r="2.3" /><circle cx="16.8" cy="15.5" r="2.3" /></>)
export const IDrum = make(<><ellipse cx="12" cy="8" rx="7.5" ry="3" /><path d="M4.5 8v7.5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V8" /></>)
export const IDownload = make(<><path d="M12 4.5V15M8 11l4 4 4-4" /><path d="M5 19.5h14" /></>)
export const ICopy = make(<><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V7a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" /></>)
export const IVolume = make(<><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>)
export const IExpand = make(<path d="M4.5 9V6.5a2 2 0 0 1 2-2H9M15 4.5h2.5a2 2 0 0 1 2 2V9M19.5 15v2.5a2 2 0 0 1-2 2H15M9 19.5H6.5a2 2 0 0 1-2-2V15" />)
export const ICheck = make(<path d="m5.5 12.5 4 4 9-9" />)
export const ISpark = make(<path d="M12 4c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6z" />)
export const IFile = make(<><path d="M7 3.5h6.5l4.5 4.5v10a2.5 2.5 0 0 1-2.5 2.5h-8.5A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z" /><path d="M13 3.5V8h5" /></>)
