// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef } from 'react'
import { invoke, useApp, useT } from '@/store'

/**
 * The browsing area. The page renders as a rounded card with a thin gutter
 * around it: the actual page is a native WebContentsView drawn by the main
 * process, so this component measures the inner card and reports its rect;
 * the view gets matching rounded corners via setBorderRadius. Overlays render
 * on top by hiding the native view.
 */
const QUICK_LINKS = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { name: 'Scholar', url: 'https://scholar.google.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'Translate', url: 'https://translate.google.com' }
]

export default function Viewport({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const inner = useRef<HTMLDivElement>(null)
  const tabs = useApp((s) => s.tabs)
  const t = useT()

  useEffect(() => {
    const el = inner.current
    if (!el) return
    const report = (): void => {
      const r = el.getBoundingClientRect()
      void invoke('viewport:bounds', { x: r.x, y: r.y, width: r.width, height: r.height })
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    window.addEventListener('resize', report)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden bg-neutral-925 p-2 pl-0">
      <div
        ref={inner}
        className="relative h-full w-full overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-950 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      >
        {tabs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="text-3xl font-semibold tracking-tight text-accent">Wisp</div>
            <div className="max-w-sm text-center text-sm text-neutral-500">
              {t('viewport.emptyHint')}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.url}
                  onClick={() => useApp.getState().newTab(link.url)}
                  className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-100"
                >
                  {link.name}
                </button>
              ))}
            </div>
            <div className="text-xs text-neutral-600">{t('viewport.shortcuts')}</div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
