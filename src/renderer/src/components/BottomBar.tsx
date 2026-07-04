// Wisp — © Shawy404. All rights reserved.
import { useApp, useT } from '@/store'

/**
 * A slim status strip along the very bottom of the window, below the sidebar
 * and the page. Because the native page view can't cover it (it sits outside
 * the viewport card), the settings gear anchored to its right corner is always
 * reachable, on any page. Kept thin so it costs almost no height.
 */
export default function BottomBar(): React.JSX.Element {
  const overlay = useApp((s) => s.overlay)
  const room = useApp((s) => s.rooms.find((r) => r.id === s.activeRoomId))
  const t = useT()
  const { setOverlay } = useApp.getState()

  return (
    <div className="wisp-chrome flex h-8 shrink-0 items-center gap-3 border-t border-neutral-800/60 bg-neutral-925 pr-2 pl-3">
      {room && (
        <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: room.color }} />
          {room.name}
        </span>
      )}
      <div className="flex-1" />
      <button
        className={`flex h-6 items-center gap-1.5 rounded-md px-2.5 text-xs ${
          overlay === 'settings'
            ? 'bg-accent/15 text-accent'
            : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
        }`}
        onClick={() => setOverlay(overlay === 'settings' ? 'none' : 'settings')}
        data-tip={t('sidebar.settings')}
        data-tip-pos="top"
        data-tip-align="end"
      >
        <span className="text-sm">⚙</span>
        <span className="hidden sm:inline">{t('sidebar.settings')}</span>
      </button>
    </div>
  )
}
