// Wisp — © Shawy404. All rights reserved.
import { useRef } from 'react'
import { useApp } from '@/store'

/**
 * Zen-style vertical tab list: tabs live in the sidebar, not a top strip.
 * Favicon + title, close on hover, drag to reorder, middle-click to close.
 */
export default function VerticalTabs({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  const tabs = useApp((s) => s.tabs)
  const activeTabId = useApp((s) => s.activeTabId)
  const { activateTab, closeTab, newTab, reorderTabs } = useApp.getState()
  const dragId = useRef<string | null>(null)

  const handleDrop = (targetId: string): void => {
    const from = dragId.current
    dragId.current = null
    if (!from || from === targetId) return
    const ids = tabs.map((t) => t.id)
    const fromIdx = ids.indexOf(from)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    ids.splice(toIdx, 0, ...ids.splice(fromIdx, 1))
    reorderTabs(ids)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex items-center px-3 pt-3 pb-1 ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
        {!collapsed && (
          <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Sekmeler
          </span>
        )}
        <button
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => newTab()}
          title="Yeni sekme (Ctrl+T)"
        >
          +
        </button>
      </div>
      <div className={`flex-1 space-y-0.5 overflow-y-auto py-1 ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            draggable
            onDragStart={() => (dragId.current = tab.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(tab.id)}
            onClick={() => activateTab(tab.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
            title={tab.title || tab.url}
            className={`group flex cursor-default items-center gap-2 rounded-lg text-xs ${
              collapsed ? 'justify-center p-2' : 'px-2.5 py-2'
            } ${
              tab.id === activeTabId
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200'
            }`}
          >
            {tab.isLoading ? (
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-neutral-500 border-t-accent" />
            ) : tab.favicon ? (
              <img src={tab.favicon} className="h-3.5 w-3.5 shrink-0 rounded-sm" alt="" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-neutral-700" />
            )}
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{tab.title || 'Yeni sekme'}</span>
                <button
                  className="hidden h-4 w-4 shrink-0 items-center justify-center rounded text-neutral-500 group-hover:flex hover:bg-neutral-700 hover:text-neutral-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10">
                    <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ))}
        {tabs.length === 0 && !collapsed && (
          <div className="px-2 py-4 text-center text-[10px] text-neutral-600">
            Sekme yok — + ile aç ya da adres çubuğuna yaz.
          </div>
        )}
      </div>
    </div>
  )
}
