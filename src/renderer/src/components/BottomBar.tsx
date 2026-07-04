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
        className={`flex h-6 w-6 items-center justify-center rounded-md ${
          overlay === 'settings'
            ? 'bg-accent/15 text-accent'
            : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
        }`}
        onClick={() => setOverlay(overlay === 'settings' ? 'none' : 'settings')}
        data-tip={t('sidebar.settings')}
        data-tip-pos="top"
        data-tip-align="end"
      >
        {/* Inline SVG gear — the ⚙ emoji renders poorly (and coloured) on Linux. */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
