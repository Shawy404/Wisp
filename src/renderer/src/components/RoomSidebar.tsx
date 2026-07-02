// Wisp — © Shawy404. All rights reserved.
import { useState } from 'react'
import { useApp, useT, type Overlay } from '@/store'
import VerticalTabs from './VerticalTabs'

function RailButton(props: {
  title: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${
        props.active
          ? 'bg-accent/15 text-accent'
          : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
      }`}
      data-tip={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/**
 * Sidebar: rooms as a dot row up top, pinned tabs and the vertical tab list
 * in the middle, panel rail at the bottom. Collapsible to an icon-only rail.
 */
export default function RoomSidebar(): React.JSX.Element {
  const rooms = useApp((s) => s.rooms)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const overlay = useApp((s) => s.overlay)
  const { switchRoom, createRoom, deleteRoom, renameRoom, setOverlay } = useApp.getState()
  const t = useT()
  const [collapsed, setCollapsed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const room = rooms.find((r) => r.id === activeRoomId)
  const toggle = (o: Overlay): void => setOverlay(overlay === o ? 'none' : o)

  return (
    <div
      className={`wisp-chrome flex shrink-0 flex-col border-r border-neutral-800/60 bg-neutral-925 transition-[width] duration-150 ${
        collapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Oda değiştirici: her oda bir renk noktası */}
      <div
        className={`flex items-center gap-1.5 border-b border-neutral-800/60 px-3 py-2.5 ${
          collapsed ? 'flex-col px-0' : 'flex-wrap'
        }`}
      >
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => void switchRoom(r.id)}
            data-tip={r.name}
            data-tip-pos="bottom"
            className={`flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110 ${
              r.id === activeRoomId ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-neutral-925' : ''
            }`}
            style={{ background: r.color }}
          />
        ))}
        <button
          onClick={() => {
            setCollapsed(false)
            setCreating(true)
          }}
          data-tip={t('sidebar.newRoom')}
          data-tip-pos="bottom"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-neutral-600 text-[11px] text-neutral-500 hover:border-neutral-400 hover:text-neutral-300"
        >
          +
        </button>
      </div>

      {/* Aktif oda adı + oda menüsü */}
      {!collapsed && (
        <div className="relative border-b border-neutral-800/60 px-3 py-2">
          {creating ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sidebar.roomNamePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  void createRoom(name.trim())
                  setName('')
                  setCreating(false)
                }
                if (e.key === 'Escape') setCreating(false)
              }}
              onBlur={() => setCreating(false)}
              className="w-full rounded-md border border-accent/50 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none placeholder:text-neutral-600"
            />
          ) : renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim() && room) {
                  void renameRoom(room.id, renameValue.trim())
                  setRenaming(false)
                }
                if (e.key === 'Escape') setRenaming(false)
              }}
              onBlur={() => setRenaming(false)}
              className="w-full rounded-md border border-accent/50 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none"
            />
          ) : (
            <button
              className="group flex w-full items-center gap-2 text-left"
              onClick={() => setMenuOpen((v) => !v)}
              title={t('sidebar.roomMenu')}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: room?.color ?? '#666' }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">
                {room?.name ?? 'Wisp'}
              </span>
              <span className="text-neutral-600 group-hover:text-neutral-300">⌄</span>
            </button>
          )}
          {menuOpen && room && (
            <div className="absolute left-3 z-30 mt-1 w-40 rounded-md border border-neutral-700 bg-neutral-900 py-1 text-xs shadow-xl">
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-300 hover:bg-neutral-800"
                onClick={() => {
                  setRenameValue(room.name)
                  setRenaming(true)
                  setMenuOpen(false)
                }}
              >
                {t('sidebar.rename')}
              </button>
              <button
                className="block w-full px-3 py-1.5 text-left text-red-400 hover:bg-neutral-800"
                onClick={() => {
                  setMenuOpen(false)
                  void deleteRoom(room.id)
                }}
              >
                {t('sidebar.deleteRoom')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dikey sekmeler */}
      <VerticalTabs collapsed={collapsed} />

      {/* Panel rayı + daraltma */}
      <div
        className={`flex items-center border-t border-neutral-800/60 py-1.5 ${
          collapsed ? 'flex-col gap-1' : 'justify-around px-1'
        }`}
      >
        <RailButton title={t('sidebar.search')} active={overlay === 'search'} onClick={() => toggle('search')}>
          ⌕
        </RailButton>
        <RailButton title={t('sidebar.sources')} active={overlay === 'sources'} onClick={() => toggle('sources')}>
          ▤
        </RailButton>
        <RailButton title={t('sidebar.notes')} active={overlay === 'notes'} onClick={() => toggle('notes')}>
          ✎
        </RailButton>
        <RailButton title={t('sidebar.map')} active={overlay === 'map'} onClick={() => toggle('map')}>
          ❋
        </RailButton>
        <RailButton title={t('sidebar.split')} active={overlay === 'split'} onClick={() => toggle('split')}>
          ◫
        </RailButton>
        <RailButton title={t('sidebar.history')} active={overlay === 'history'} onClick={() => toggle('history')}>
          ◷
        </RailButton>
        <RailButton title={t('sidebar.settings')} active={overlay === 'settings'} onClick={() => toggle('settings')}>
          ⚙
        </RailButton>
        <RailButton
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '»' : '«'}
        </RailButton>
      </div>
    </div>
  )
}
