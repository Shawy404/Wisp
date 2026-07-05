// Wisp. © Shawy404, MIT.
import { useState } from 'react'
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
 */
export default function TitleBar(): React.JSX.Element {
  const t = useT()
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)
  const { setOverlay, placeRailItem } = useApp.getState()
  const [dropHot, setDropHot] = useState(false)

  const items = railItemsFor(config, 'titlebar')

  const startDrag = (e: React.DragEvent, item: RailItem): void => {
    e.dataTransfer.setData(RAIL_DND_TYPE, item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
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
  )
}
