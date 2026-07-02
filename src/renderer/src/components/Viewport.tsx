// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef } from 'react'
import { invoke, useApp } from '@/store'

/**
 * The browsing area. The actual page is a native WebContentsView drawn by the
 * main process on top of this element — we just measure and report its rect.
 * When no tab is open (or an overlay hides the view) this renderer content
 * shows through.
 */
export default function Viewport({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const tabs = useApp((s) => s.tabs)

  useEffect(() => {
    const el = ref.current
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
    <div ref={ref} className="relative flex-1 overflow-hidden bg-neutral-950">
      {tabs.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="text-3xl font-semibold tracking-tight text-accent">Wisp</div>
          <div className="max-w-sm text-center text-sm text-neutral-500">
            Adres çubuğuna bir URL yaz ya da bir şey ara — aradığın her şey bu odanın
            kaynaklarına kaydedilir.
          </div>
          <div className="text-xs text-neutral-600">
            Ctrl+T yeni sekme · Ctrl+L adres çubuğu · Ctrl+K komut paleti
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
