// Wisp. © Shawy404, MIT.
import { useEffect, useRef, useState } from 'react'
import { invoke, useApp, useT } from '@/store'
import AddressBar from './AddressBar'
import FindBar from './FindBar'
import FocusTimer from './FocusTimer'
import { RAIL_DND_TYPE, railItemsFor, type RailItem } from './railItems'

/**
 * Single slim toolbar: the address pill, the focus timer and window controls.
 * Any rail buttons the user has dragged up here (config.railPlacement) sit left
 * of the timer; this row is also a drop target, so a button dropped anywhere on
 * it moves to the title bar. Dragging one back onto the sidebar rail returns it.
 * In compact mode the whole bar tucks itself away like the sidebar does and
 * slides back when the pointer touches the top edge (or Ctrl+L calls for it).
 */
export default function TitleBar(): React.JSX.Element {
  const t = useT()
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)
  const { setOverlay, placeRailItem } = useApp.getState()
  const [dropHot, setDropHot] = useState(false)

  const compact = config?.compactSidebar ?? false
  const [revealed, setRevealed] = useState(!compact)
  const root = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHide = (): void => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }
  const scheduleHide = (): void => {
    if (!useApp.getState().config?.compactSidebar) return
    cancelHide()
    hideTimer.current = setTimeout(() => {
      // typing in the address bar keeps the toolbar up. hiding an input while
      // someone is mid sentence is a war crime.
      if (root.current?.contains(document.activeElement)) return
      setRevealed(false)
    }, useApp.getState().config?.compactHideDelayMs ?? 400)
  }

  useEffect(() => {
    setRevealed(!compact)
    return cancelHide
  }, [compact])

  // reveal triggers: the pointer grazing the top edge of a live page, Ctrl+L
  // asking for the address bar, or Ctrl+F wanting the find bar.
  useEffect(() => {
    const reveal = (): void => {
      if (!useApp.getState().config?.compactSidebar) return
      cancelHide()
      setRevealed(true)
    }
    const offEdge = window.wisp.on('shell:edge-top', (near) => {
      if (near) reveal()
      else scheduleHide()
    })
    window.addEventListener('wisp:focus-address', reveal)
    window.addEventListener('wisp:find-open', reveal)
    return () => {
      offEdge()
      window.removeEventListener('wisp:focus-address', reveal)
      window.removeEventListener('wisp:find-open', reveal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = railItemsFor(config, 'titlebar')

  const startDrag = (e: React.DragEvent, item: RailItem): void => {
    e.dataTransfer.setData(RAIL_DND_TYPE, item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const hidden = compact && !revealed

  return (
    <div
      ref={root}
      className="relative shrink-0"
      onMouseEnter={() => {
        cancelHide()
        if (compact) setRevealed(true)
      }}
      onMouseLeave={scheduleHide}
    >
      {/* the sliver that marks where the toolbar sleeps in compact mode */}
      {hidden && (
        <div className="absolute inset-x-0 top-0 z-10 h-[6px] border-b border-neutral-800/60 bg-neutral-925">
          <div className="absolute inset-x-[42%] top-[2px] h-[3px] rounded-full bg-accent/40" />
        </div>
      )}
      <div
        className={`overflow-hidden transition-[height] duration-200 ease-out ${hidden ? 'h-[6px]' : 'h-11'}`}
      >
        <div
          className={`transition-opacity duration-150 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
          <div className="drag-region wisp-chrome flex h-11 items-center gap-2 border-b border-neutral-800/60 bg-neutral-925 pr-1 pl-3">
      <span className="no-drag flex items-center gap-1.5 select-none" data-tip="Wisp" data-tip-pos="bottom">
        <span className="wisp-mascot" />
        <span className="text-xs font-semibold tracking-tight text-accent">Wisp</span>
      </span>
      <AddressBar />
      <FindBar />
      <div
        className={`no-drag flex items-center rounded-md ${dropHot ? 'bg-accent/10 ring-1 ring-accent/40' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(RAIL_DND_TYPE)) {
            e.preventDefault()
            setDropHot(true)
          }
        }}
        onDragLeave={() => setDropHot(false)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(RAIL_DND_TYPE)
          setDropHot(false)
          if (id) void placeRailItem(id, 'titlebar')
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            draggable
            onDragStart={(e) => startDrag(e, item)}
            className={`flex h-8 w-9 cursor-grab items-center justify-center rounded-md text-sm active:cursor-grabbing ${
              overlay === item.id
                ? 'bg-accent/15 text-accent'
                : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
            onClick={() => setOverlay(overlay === item.id ? 'none' : item.id)}
            data-tip={t(item.titleKey)}
            data-tip-pos="bottom"
            data-tip-align="end"
          >
            {item.icon}
          </button>
        ))}
        {/* An empty landing strip so buttons can be dropped even when none are
            here yet — otherwise there'd be nothing to aim at. */}
        {items.length === 0 && dropHot && (
          <span className="px-3 text-[10px] text-accent">{t('rail.dropHere')}</span>
        )}
        <div className="mx-1.5 h-5 w-px bg-neutral-800" />
        <FocusTimer />
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:minimize')}
          data-tip={t('titlebar.minimize')}
          data-tip-pos="bottom"
          data-tip-align="end"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:maximize')}
          data-tip={t('titlebar.maximize')}
          data-tip-pos="bottom"
          data-tip-align="end"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-red-600 hover:text-white"
          onClick={() => invoke('window:close')}
          data-tip={t('titlebar.close')}
          data-tip-pos="bottom"
          data-tip-align="end"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
          </div>
        </div>
      </div>
    </div>
  )
}
