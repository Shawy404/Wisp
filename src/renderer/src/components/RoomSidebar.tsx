// Wisp — © Shawy404. All rights reserved.
import { useState } from 'react'
import { useApp, type Overlay } from '@/store'

function RailButton(props: {
  title: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
        props.active
          ? 'bg-accent/15 text-accent'
          : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
      }`}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export default function RoomSidebar(): React.JSX.Element {
  const rooms = useApp((s) => s.rooms)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const overlay = useApp((s) => s.overlay)
  const { switchRoom, createRoom, deleteRoom, renameRoom, setOverlay } = useApp.getState()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [menuRoom, setMenuRoom] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const toggle = (o: Overlay): void => setOverlay(overlay === o ? 'none' : o)

  return (
    <div className="flex w-52 flex-col border-r border-neutral-800 bg-neutral-925">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          Odalar
        </span>
        <button
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          title="Yeni oda"
          onClick={() => setCreating(true)}
        >
          +
        </button>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {rooms.map((room) => (
          <div key={room.id} className="relative">
            {renaming === room.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    void renameRoom(room.id, renameValue.trim())
                    setRenaming(null)
                  }
                  if (e.key === 'Escape') setRenaming(null)
                }}
                onBlur={() => setRenaming(null)}
                className="w-full rounded-md border border-accent/50 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 outline-none"
              />
            ) : (
              <button
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  room.id === activeRoomId
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200'
                }`}
                onClick={() => void switchRoom(room.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenuRoom(menuRoom === room.id ? null : room.id)
                }}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: room.color }}
                />
                <span className="min-w-0 flex-1 truncate">{room.name}</span>
                <span
                  className="hidden text-neutral-600 group-hover:inline hover:text-neutral-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuRoom(menuRoom === room.id ? null : room.id)
                  }}
                >
                  ⋯
                </span>
              </button>
            )}
            {menuRoom === room.id && (
              <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-neutral-700 bg-neutral-900 py-1 text-xs shadow-xl">
                <button
                  className="block w-full px-3 py-1.5 text-left text-neutral-300 hover:bg-neutral-800"
                  onClick={() => {
                    setRenameValue(room.name)
                    setRenaming(room.id)
                    setMenuRoom(null)
                  }}
                >
                  Yeniden adlandır
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-red-400 hover:bg-neutral-800"
                  onClick={() => {
                    setMenuRoom(null)
                    void deleteRoom(room.id)
                  }}
                >
                  Odayı sil
                </button>
              </div>
            )}
          </div>
        ))}

        {creating && (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Oda adı…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                void createRoom(name.trim())
                setName('')
                setCreating(false)
              }
              if (e.key === 'Escape') setCreating(false)
            }}
            onBlur={() => setCreating(false)}
            className="w-full rounded-md border border-accent/50 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600"
          />
        )}
      </div>

      <div className="flex items-center justify-around border-t border-neutral-800 px-2 py-2">
        <RailButton title="Arama (odaya kaydedilir)" active={overlay === 'search'} onClick={() => toggle('search')}>
          ⌕
        </RailButton>
        <RailButton title="Kaynaklar" active={overlay === 'sources'} onClick={() => toggle('sources')}>
          ▤
        </RailButton>
        <RailButton title="Notlar" active={overlay === 'notes'} onClick={() => toggle('notes')}>
          ✎
        </RailButton>
        <RailButton title="Kavram haritası" active={overlay === 'map'} onClick={() => toggle('map')}>
          ❋
        </RailButton>
        <RailButton title="Ayarlar" active={overlay === 'settings'} onClick={() => toggle('settings')}>
          ⚙
        </RailButton>
      </div>
    </div>
  )
}
