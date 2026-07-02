// Wisp — © Shawy404. All rights reserved.
import { invoke } from '@/store'
import AddressBar from './AddressBar'
import FocusTimer from './FocusTimer'

/**
 * Zen-style single toolbar: one slim draggable row holding the floating
 * address pill, the focus timer and the window controls. Tabs live in the
 * sidebar, so the top chrome stays minimal.
 */
export default function TitleBar(): React.JSX.Element {
  return (
    <div className="drag-region flex h-11 items-center gap-2 border-b border-neutral-800/60 bg-neutral-925 pr-1 pl-3">
      <span className="text-xs font-semibold tracking-tight text-accent select-none">Wisp</span>
      <AddressBar />
      <div className="no-drag flex items-center">
        <FocusTimer />
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:minimize')}
          title="Küçült"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => invoke('window:maximize')}
          title="Büyüt"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-red-600 hover:text-white"
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
