// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import type { PinnedTab } from '@shared/types'
import { invoke, useApp, useT } from '@/store'

interface MenuState {
  x: number
  y: number
  items: { label: string; danger?: boolean; run: () => void }[]
}

/** Stable empty fallback so the essentials selector keeps a constant reference. */
const EMPTY_ESSENTIALS: PinnedTab[] = []

/**
 * Sidebar tab area, top to bottom: essentials (global — they follow you into
 * every room), the room's pinned tabs, then the vertical tab list. Tabs:
 * favicon + title, close on hover, drag to reorder — or drag onto the
 * viewport's edges to open split view. Right-click anything for pin /
 * essentials actions. The + button opens the command bar (Ctrl+T).
 */
export default function VerticalTabs({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  const tabs = useApp((s) => s.tabs)
  const activeTabId = useApp((s) => s.activeTabId)
  const rooms = useApp((s) => s.rooms)
  const activeRoomId = useApp((s) => s.activeRoomId)
  // Select the stored reference (may be undefined) — never `?? []` inside the
  // selector, or zustand v5 sees a fresh array every render and loops forever.
  const essentials = useApp((s) => s.config?.essentials) ?? EMPTY_ESSENTIALS
  const {
    activateTab,
    closeTab,
    newTab,
    reorderTabs,
    pinTab,
    unpinTab,
    addEssential,
    removeEssential,
    setOverlay,
    setDraggingTab
  } = useApp.getState()
  const t = useT()
  const dragId = useRef<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close, true)
    }
  }, [menu])

  const pinned = rooms.find((r) => r.id === activeRoomId)?.pinned ?? []

  // Picking a tab means "show me that page" — leave whatever panel is open.
  const showTab = (id: string): void => {
    activateTab(id)
    if (useApp.getState().overlay !== 'none') setOverlay('none')
  }

  const openSaved = (url: string): void => {
    const existing = tabs.find((t) => t.url === url)
    if (existing) showTab(existing.id)
    else {
      newTab(url)
      if (useApp.getState().overlay !== 'none') setOverlay('none')
    }
  }

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

  const openMenu = (e: React.MouseEvent, items: MenuState['items']): void => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  /** Icon grid shared by the essentials and pinned sections. */
  const SavedGrid = ({
    items,
    essential
  }: {
    items: PinnedTab[]
    essential: boolean
  }): React.JSX.Element => (
    <div
      className={`grid gap-1.5 p-2 ${collapsed ? 'grid-cols-1 justify-items-center' : 'grid-cols-4'}`}
    >
      {items.map((p) => (
        <button
          key={p.url}
          onClick={() => openSaved(p.url)}
          onContextMenu={(e) =>
            openMenu(
              e,
              essential
                ? [
                    {
                      label: t('tabs.menu.pinHere'),
                      run: () => {
                        void pinTab(p.url, p.title, p.favicon)
                        void removeEssential(p.url)
                      }
                    },
                    { label: t('tabs.menu.removeEssential'), danger: true, run: () => void removeEssential(p.url) }
                  ]
                : [
                    {
                      label: t('tabs.menu.moveToEssentials'),
                      run: () => {
                        void addEssential(p.url, p.title, p.favicon)
                        void unpinTab(p.url)
                      }
                    },
                    { label: t('tabs.unpin'), danger: true, run: () => void unpinTab(p.url) }
                  ]
            )
          }
          title={p.title}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-neutral-900 hover:border-neutral-600 ${
            essential ? 'border-accent/30' : 'border-neutral-800'
          }`}
        >
          {p.favicon ? (
            <img src={p.favicon} className="h-4 w-4 rounded-sm" alt="" />
          ) : (
            <span className="text-[10px] text-neutral-400">{p.title.slice(0, 2).toUpperCase()}</span>
          )}
        </button>
      ))}
    </div>
  )

  const sectionLabel = (key: 'tabs.essentials' | 'tabs.pinned'): React.JSX.Element | null =>
    collapsed ? null : (
      <div className="px-3 pt-2 text-[9px] font-semibold tracking-wider text-neutral-600 uppercase">
        {t(key)}
      </div>
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {essentials.length > 0 && (
        <div className="border-b border-neutral-800/60">
          {sectionLabel('tabs.essentials')}
          <SavedGrid items={essentials} essential />
        </div>
      )}
      {pinned.length > 0 && (
        <div className="border-b border-neutral-800/60">
          {sectionLabel('tabs.pinned')}
          <SavedGrid items={pinned} essential={false} />
        </div>
      )}

      <div className={`flex items-center px-3 pt-3 pb-1 ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
        {!collapsed && (
          <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            {t('tabs.title')}
          </span>
        )}
        <button
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={() => {
            newTab()
            if (useApp.getState().overlay !== 'none') setOverlay('none')
            window.dispatchEvent(new CustomEvent('wisp:focus-address'))
          }}
          data-tip={t('tabs.newTab')}
        >
          +
        </button>
      </div>
      <div className={`flex-1 space-y-0.5 overflow-y-auto py-1 ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => {
              dragId.current = tab.id
              e.dataTransfer.setData('wisp/tab-id', tab.id)
              e.dataTransfer.effectAllowed = 'move'
              // The native page view would cover the split drop zones, so it
              // hides for the duration of the drag; dragend restores it.
              setDraggingTab(true)
              void invoke('viewport:visible', false)
            }}
            onDragEnd={() => {
              setDraggingTab(false)
              void invoke('viewport:visible', useApp.getState().overlay === 'none')
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(tab.id)}
            onClick={() => showTab(tab.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
            onContextMenu={(e) =>
              openMenu(e, [
                { label: t('tabs.menu.pin'), run: () => void pinTab(tab.url, tab.title || tab.url, tab.favicon) },
                {
                  label: t('tabs.menu.addEssential'),
                  run: () => void addEssential(tab.url, tab.title || tab.url, tab.favicon)
                },
                { label: t('tabs.menu.close'), danger: true, run: () => closeTab(tab.id) }
              ])
            }
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
                <span className="min-w-0 flex-1 truncate">{tab.title || t('tabs.newTabDefault')}</span>
                <button
                  className="hidden h-4 w-4 shrink-0 items-center justify-center rounded text-neutral-500 group-hover:flex hover:bg-neutral-700 hover:text-accent"
                  title={t('tabs.pin')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void pinTab(tab.url, tab.title || tab.url, tab.favicon)
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 12 12">
                    <path
                      d="M6 1 v6 M3.5 3.5 h5 M6 7 v4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
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
          <div className="px-2 py-4 text-center text-[10px] text-neutral-600">{t('tabs.empty')}</div>
        )}
      </div>

      {menu && (
        <div
          className="fixed z-50 w-44 rounded-md border border-neutral-700 bg-neutral-900 py-1 text-xs shadow-xl"
          style={{ left: Math.min(menu.x, window.innerWidth - 184), top: Math.min(menu.y, window.innerHeight - menu.items.length * 30 - 12) }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.items.map((item) => (
            <button
              key={item.label}
              className={`block w-full px-3 py-1.5 text-left hover:bg-neutral-800 ${
                item.danger ? 'text-red-400' : 'text-neutral-300'
              }`}
              onClick={() => {
                item.run()
                setMenu(null)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
