// Wisp — © Shawy404. All rights reserved.
import { useRef } from 'react'
import { useApp } from '@/store'

export default function TabStrip(): React.JSX.Element {
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
    <div className="no-drag flex min-w-0 flex-1 items-end gap-px overflow-x-auto pt-1.5">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          draggable
          onDragStart={() => (dragId.current = tab.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(tab.id)}
          onClick={() => activateTab(tab.id)}
          onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
          title={tab.url}
          className={`group flex h-[34px] w-44 min-w-24 shrink cursor-default items-center gap-1.5 rounded-t-md px-2.5 text-xs ${
            tab.id === activeTabId
              ? 'bg-neutral-800 text-neutral-100'
              : 'text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200'
          }`}
        >
          {tab.isLoading ? (
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-neutral-500 border-t-accent" />
          ) : tab.favicon ? (
            <img src={tab.favicon} className="h-3.5 w-3.5 shrink-0" alt="" />
          ) : (
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-neutral-700" />
          )}
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
        </div>
      ))}
      <button
        className="mb-1 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        onClick={() => newTab()}
        title="Yeni sekme (Ctrl+T)"
      >
        <svg width="11" height="11" viewBox="0 0 10 10">
          <path d="M5 0 V10 M0 5 H10" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
    </div>
  )
}
