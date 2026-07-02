// Wisp — © Shawy404. All rights reserved.
import { invoke, useApp } from '@/store'
import TabStrip from './TabStrip'
import FocusTimer from './FocusTimer'

export default function TitleBar(): React.JSX.Element {
  const rooms = useApp((s) => s.rooms)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const room = rooms.find((r) => r.id === activeRoomId)

  return (
    <div className="drag-region flex h-10 items-stretch gap-1 border-b border-neutral-800 bg-neutral-925 pl-2">
      <div className="flex items-center gap-2 pr-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: room?.color ?? '#666' }}
        />
        <span className="max-w-40 truncate text-xs font-medium text-neutral-400">
          {room?.name ?? 'Wisp'}
        </span>
      </div>
      <TabStrip />
      <div className="no-drag ml-auto flex items-center">
        <FocusTimer />
        <button
          className="flex h-10 w-11 items-center justify-center text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:minimize')}
          title="Küçült"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-10 w-11 items-center justify-center text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:maximize')}
          title="Büyüt"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-10 w-11 items-center justify-center text-neutral-500 hover:bg-red-600 hover:text-white"
          onClick={() => invoke('window:close')}
          title="Kapat"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
