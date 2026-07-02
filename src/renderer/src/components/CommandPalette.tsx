// Wisp — © Shawy404. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke, useApp, type Overlay } from '@/store'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

export default function CommandPalette(): React.JSX.Element | null {
  const rooms = useApp((s) => s.rooms)
  const notes = useApp((s) => s.notes)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setIndex(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
      // Hide the native web view so the palette isn't drawn under it.
      void invoke('viewport:visible', false)
    } else {
      void invoke('viewport:visible', useApp.getState().overlay === 'none')
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const { switchRoom, setOverlay, newTab } = useApp.getState()
    const go = (o: Overlay): (() => void) => () => {
      setOverlay(o)
      setOpen(false)
    }
    const list: Command[] = [
      { id: 'search', label: 'Arama şeridini aç', hint: 'panel', run: go('search') },
      { id: 'sources', label: 'Kaynakları aç', hint: 'panel', run: go('sources') },
      { id: 'notes', label: 'Notları aç', hint: 'panel', run: go('notes') },
      { id: 'map', label: 'Kavram haritasını aç', hint: 'panel', run: go('map') },
      { id: 'settings', label: 'Ayarları aç', hint: 'panel', run: go('settings') },
      { id: 'newtab', label: 'Yeni sekme', hint: 'tarayıcı', run: () => { newTab(); setOverlay('none'); setOpen(false) } }
    ]
    for (const r of rooms) {
      list.push({
        id: `room-${r.id}`,
        label: `Odaya geç: ${r.name}`,
        hint: 'oda',
        run: () => {
          void switchRoom(r.id)
          setOpen(false)
        }
      })
    }
    for (const n of notes.slice(0, 30)) {
      list.push({
        id: `note-${n.id}`,
        label: `Notu aç: ${n.title}`,
        hint: 'not',
        run: () => {
          setOverlay('notes')
          setOpen(false)
        }
      })
    }
    return list
  }, [rooms, notes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 12)
    // Free-text starting with "?" becomes a quick search command.
    if (q.startsWith('?')) {
      const term = query.trim().slice(1).trim()
      return [
        {
          id: 'quick-search',
          label: `Ara: "${term}"`,
          hint: 'arama',
          run: () => {
            window.dispatchEvent(new CustomEvent('wisp:search', { detail: term }))
            useApp.getState().setOverlay('search')
            setOpen(false)
          }
        },
        ...commands.filter((c) => c.label.toLowerCase().includes(q))
      ]
    }
    return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 12)
  }, [query, commands])

  useEffect(() => {
    if (index >= filtered.length) setIndex(0)
  }, [filtered, index])

  if (!open) return null

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[520px] overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              filtered[index]?.run()
            }
          }}
          placeholder="Komut ara… (?ile hızlı arama, oda/not/panel adları)"
          className="w-full border-b border-neutral-800 bg-transparent px-4 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => cmd.run()}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                i === index ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-300'
              }`}
            >
              <span className="flex-1 truncate">{cmd.label}</span>
              {cmd.hint && <span className="text-[10px] text-neutral-600">{cmd.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-neutral-600">Eşleşme yok.</div>
          )}
        </div>
      </div>
    </div>
  )
}
