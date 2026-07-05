// Wisp. © Shawy404, MIT.
import { useEffect, useRef, useState } from 'react'
import { useApp, useT, type Overlay } from '@/store'
import VerticalTabs from './VerticalTabs'
import SidebarWidgets from './SidebarWidgets'
import { RAIL_DND_TYPE, railItemsFor, type RailItem } from './railItems'

export function RailButton(props: {
  title: string
  active?: boolean
  onClick: () => void
  onDragStart?: (e: React.DragEvent) => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      draggable={!!props.onDragStart}
      onDragStart={props.onDragStart}
      className={`flex h-8 w-8 cursor-grab items-center justify-center rounded-lg text-base active:cursor-grabbing ${
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

const EXPANDED_W = 224

/**
 * Sidebar: rooms as a dot row up top, pinned tabs and the vertical tab list
 * in the middle, panel rail at the bottom. Collapsible to an icon-only rail —
 * or, in compact mode, it tucks itself away entirely and glides back when the
 * pointer touches the strip along the left edge.
 */
export default function RoomSidebar(): React.JSX.Element {
  const rooms = useApp((s) => s.rooms)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)
  const draggingTab = useApp((s) => s.draggingTab)
  const { switchRoom, createRoom, deleteRoom, renameRoom, setOverlay, placeRailItem } =
    useApp.getState()
  const [railDropHot, setRailDropHot] = useState(false)
  const t = useT()
  const [collapsed, setCollapsed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const compact = config?.compactSidebar ?? false
  const [revealed, setRevealed] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Inline UI that must not vanish under the user's cursor mid-action.
  const holdOpen = creating || renaming || menuOpen || draggingTab

  useEffect(() => {
    // Leaving compact mode always restores the full sidebar.
    if (!compact) setRevealed(true)
    else setRevealed(false)
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [compact])

  // Dragging a tab fires drag events, not mouseenter, so the hover-reveal never
  // triggers — pop the compact sidebar open for the whole drag so you can drop
  // onto it (rooms, rail) or drag a tab out toward the viewport edges.
  useEffect(() => {
    if (compact && draggingTab) {
      cancelHide()
      setRevealed(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, draggingTab])

  // A live page captures the mouse, so its preload tells us when the pointer
  // nears the left edge — that's what lets compact reveal work over any page.
  useEffect(() => {
    return window.wisp.on('shell:edge-left', (near) => {
      if (!useApp.getState().config?.compactSidebar) return
      if (near) {
        cancelHide()
        setRevealed(true)
      } else {
        scheduleHide()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancelHide = (): void => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }
  const scheduleHide = (): void => {
    if (!compact || holdOpen) return
    cancelHide()
    hideTimer.current = setTimeout(() => setRevealed(false), config?.compactHideDelayMs ?? 400)
  }

  const room = rooms.find((r) => r.id === activeRoomId)
  const toggle = (o: Overlay): void => setOverlay(overlay === o ? 'none' : o)

  // Rail buttons placed on the sidebar, split by group so the divider only
  // shows between clusters that are actually present here.
  const railItems = railItemsFor(config, 'sidebar')
  const contentItems = railItems.filter((i) => i.group === 'content')
  const systemItems = railItems.filter((i) => i.group === 'system')
  const startRailDrag = (e: React.DragEvent, item: RailItem): void => {
    e.dataTransfer.setData(RAIL_DND_TYPE, item.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const RailBtn = (item: RailItem): React.JSX.Element => (
    <RailButton
      key={item.id}
      title={t(item.titleKey)}
      active={overlay === item.id}
      onClick={() => toggle(item.id)}
      onDragStart={(e) => startRailDrag(e, item)}
    >
      {item.icon}
    </RailButton>
  )

  const hidden = compact && !revealed
  const width = compact
    ? revealed
      ? EXPANDED_W
      : Math.max(4, Math.min(24, config?.compactRevealPx ?? 10))
    : collapsed
      ? 48
      : EXPANDED_W

  // Group separator, matching the rail's two orientations.
  const Divider = (): React.JSX.Element =>
    collapsed && !compact ? (
      <div className="my-0.5 h-px w-5 bg-neutral-800" />
    ) : (
      <div className="mx-1 h-5 w-px bg-neutral-800" />
    )

  return (
    <div
      className="relative shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
      style={{ width }}
      onMouseEnter={() => {
        cancelHide()
        if (compact) setRevealed(true)
      }}
      onMouseLeave={scheduleHide}
    >
      {/* The sliver that stays visible while the compact sidebar is tucked away. */}
      {hidden && (
        <div className="absolute inset-y-0 left-0 w-full border-r border-neutral-800/60 bg-neutral-925">
          <div className="absolute inset-y-[35%] left-[2px] w-[3px] rounded-full bg-accent/40" />
        </div>
      )}

      <div
        className={`wisp-chrome flex h-full flex-col border-r border-neutral-800/60 bg-neutral-925 transition-opacity duration-150 ${
          hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ width: compact ? EXPANDED_W : undefined }}
      >
        {/* Oda değiştirici: her oda bir renk noktası */}
        <div
          className={`flex items-center gap-1.5 border-b border-neutral-800/60 px-3 py-2.5 ${
            collapsed && !compact ? 'flex-col px-0' : 'flex-wrap'
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
        {(!collapsed || compact) && (
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
        <VerticalTabs collapsed={collapsed && !compact} />

        {/* Mini widget'lar: müzik + bellek (daraltılmış rayda gizli) */}
        {(!collapsed || compact) && <SidebarWidgets />}

        {/* Panel rayı: içerik grubu | sistem grubu | daraltma. Butonlar
            sürüklenip üst çubuğa bırakılabilir; bu ray da bir bırakma alanı. */}
        <div
          className={`flex items-center border-t py-1.5 transition-colors ${
            railDropHot ? 'border-accent/50 bg-accent/10' : 'border-neutral-800/60'
          } ${collapsed && !compact ? 'flex-col gap-1' : 'justify-around px-1'}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(RAIL_DND_TYPE)) {
              e.preventDefault()
              setRailDropHot(true)
            }
          }}
          onDragLeave={() => setRailDropHot(false)}
          onDrop={(e) => {
            const id = e.dataTransfer.getData(RAIL_DND_TYPE)
            setRailDropHot(false)
            if (id) void placeRailItem(id, 'sidebar')
          }}
        >
          {contentItems.map(RailBtn)}
          {contentItems.length > 0 && systemItems.length > 0 && <Divider />}
          {systemItems.map(RailBtn)}
          {!compact && (
            <>
              <Divider />
              <RailButton
                title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? '»' : '«'}
              </RailButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
