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
            <div className="text-xs text-neutral-600">{t('viewport.shortcuts')}</div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
