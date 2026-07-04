// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
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

/** One half of the drag-to-split target. Lights up while a tab hovers over it. */
function SplitZone({ side }: { side: 'left' | 'right' }): React.JSX.Element {
  const t = useT()
  const [hot, setHot] = useState(false)
  return (
    <div
      className={`absolute inset-y-2 z-20 flex w-[30%] items-center justify-center rounded-xl border-2 border-dashed transition-all duration-150 ${
        side === 'left' ? 'left-2' : 'right-2'
      } ${hot ? 'scale-[1.02] border-accent bg-accent/15' : 'border-neutral-700 bg-neutral-900/40'}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setHot(true)
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        e.preventDefault()
        setHot(false)
        const tabId = e.dataTransfer.getData('wisp/tab-id')
        if (tabId) useApp.getState().requestSplit(tabId, side)
      }}
    >
      <span className={`text-xs font-medium ${hot ? 'text-accent' : 'text-neutral-500'}`}>
        {t(side === 'left' ? 'split.dropLeft' : 'split.dropRight')}
      </span>
    </div>
  )
}

export default function Viewport({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const inner = useRef<HTMLDivElement>(null)
  const tabs = useApp((s) => s.tabs)
  const draggingTab = useApp((s) => s.draggingTab)
  const t = useT()

  useEffect(() => {
    const el = inner.current
    if (!el) return
    const report = (): void => {
      // While a split-view pane owns the native view (live page), let it drive
      // the bounds — reporting the full card here would yank the page back to
      // fill the whole viewport mid-split.
      if (useApp.getState().splitLiveRect) return
      const r = el.getBoundingClientRect()
      void invoke('viewport:bounds', { x: r.x, y: r.y, width: r.width, height: r.height })
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    window.addEventListener('resize', report)
    // When the split's live pane releases the view, restore the full card.
    const unsub = useApp.subscribe((s, prev) => {
      if (prev.splitLiveRect && !s.splitLiveRect) report()
    })
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
      unsub()
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
        {/* Drag-to-split: while a sidebar tab is being dragged the native view
            is hidden, so these zones are visible and can accept the drop. */}
        {draggingTab && (
          <div className="absolute inset-0 z-20 bg-neutral-950/60">
            <SplitZone side="left" />
            <SplitZone side="right" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] text-neutral-500">
              {t('split.dropHint')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
