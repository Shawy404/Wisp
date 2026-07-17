// Wisp. © Shawy404, MIT.
import { useState } from 'react'
import { PRIVATE_ROOM_ID } from '@shared/types'
import { invoke, useApp, useT } from '@/store'
import AddressBar from './AddressBar'
import FindBar from './FindBar'
import FocusTimer from './FocusTimer'
import { Icon } from './icons'
import { RAIL_DND_TYPE, railItemsFor, type RailItem } from './railItems'

/**
 * Single slim toolbar: the address pill, the focus timer and window controls.
 * Any rail buttons the user has dragged up here (config.railPlacement) sit left
 * of the timer; this row is also a drop target, so a button dropped anywhere on
 * it moves to the title bar. Dragging one back onto the sidebar rail returns it.
 * (the compact auto-hiding toolbar is gone: it kept eating the address bar
 * mid-typing and clipping the suggestion list. the sidebar's compact mode
 * survives, that one behaves.)
 */
export default function TitleBar(): React.JSX.Element {
  const t = useT()
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)
  const privateMode = useApp((s) => s.activeRoomId === PRIVATE_ROOM_ID)
  const { setOverlay, placeRailItem, togglePrivateMode } = useApp.getState()
  const [dropHot, setDropHot] = useState(false)

  const items = railItemsFor(config, 'titlebar')

  const startDrag = (e: React.DragEvent, item: RailItem): void => {
    e.dataTransfer.setData(RAIL_DND_TYPE, item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="relative shrink-0">
      <div className="h-11 overflow-visible">
        <div>
          <div
            className={`drag-region wisp-chrome flex h-11 items-center gap-2 border-b border-white/[0.05] pr-1 pl-3 ${
              config?.chromeBlur ? 'bg-neutral-925/70 backdrop-blur-md' : 'bg-neutral-925'
            }`}
          >
      {/* the wisp itself is the settings button now. the bottom bar it used to
          live in is gone, and honestly the little guy earned a job. */}
      <button
        className={`no-drag flex items-center gap-1.5 rounded-md px-1.5 py-1 select-none ${
          overlay === 'settings' ? 'bg-accent/15' : 'hover:bg-neutral-800'
        }`}
        onClick={() => setOverlay(overlay === 'settings' ? 'none' : 'settings')}
        data-tip={t('sidebar.settings')}
        data-tip-pos="bottom"
        aria-label={t('sidebar.settings')}
      >
        {/* in private mode the little guy puts his sunglasses on. he takes
            operational security very seriously. */}
        <span className={`wisp-mascot ${privateMode ? 'wisp-mascot--private' : ''}`} />
        <span className="wisp-display text-xs font-semibold text-accent">Wisp</span>
      </button>
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
            <Icon name={item.icon} size={15} />
          </button>
        ))}
        {/* An empty landing strip so buttons can be dropped even when none are
            here yet — otherwise there'd be nothing to aim at. */}
        {items.length === 0 && dropHot && (
          <span className="px-3 text-[10px] text-accent">{t('rail.dropHere')}</span>
        )}
        <button
          className={`flex h-8 w-9 items-center justify-center rounded-md ${
            privateMode
              ? 'bg-accent/15 text-accent'
              : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
          }`}
          onClick={() => void togglePrivateMode()}
          data-tip={t(privateMode ? 'private.off' : 'private.on')}
          data-tip-pos="bottom"
          data-tip-align="end"
          aria-label={t(privateMode ? 'private.off' : 'private.on')}
        >
          <Icon name="glasses" size={15} />
        </button>
        <div className="mx-1.5 h-5 w-px bg-neutral-800" />
        <FocusTimer />
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:minimize')}
          data-tip={t('titlebar.minimize')}
          data-tip-pos="bottom"
          data-tip-align="end"
          aria-label={t('titlebar.minimize')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:maximize')}
          data-tip={t('titlebar.maximize')}
          data-tip-pos="bottom"
          data-tip-align="end"
          aria-label={t('titlebar.maximize')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-red-600 hover:text-white"
          onClick={() => invoke('window:close')}
          data-tip={t('titlebar.close')}
          data-tip-pos="bottom"
          data-tip-align="end"
          aria-label={t('titlebar.close')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
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
