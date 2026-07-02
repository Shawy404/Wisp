// Wisp — © Shawy404. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveAddress, webSearchUrl } from '@shared/address'
import { invoke, useApp, useT, type Overlay } from '@/store'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

export default function CommandPalette(): React.JSX.Element | null {
  const rooms = useApp((s) => s.rooms)
  const notes = useApp((s) => s.notes)
  const t = useT()
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
    // Sidebar "+" ve Ctrl+T buraya düşer: yeni sekme akışı komut çubuğundan.
    const openBar = (): void => {
      setOpen(true)
      setQuery('')
      setIndex(0)
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('wisp:open-palette', openBar)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('wisp:open-palette', openBar)
    }
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
      { id: 'search', label: t('palette.openSearch'), hint: t('palette.hint.panel'), run: go('search') },
      { id: 'sources', label: t('palette.openSources'), hint: t('palette.hint.panel'), run: go('sources') },
      { id: 'notes', label: t('palette.openNotes'), hint: t('palette.hint.panel'), run: go('notes') },
      { id: 'map', label: t('palette.openMap'), hint: t('palette.hint.panel'), run: go('map') },
      { id: 'settings', label: t('palette.openSettings'), hint: t('palette.hint.panel'), run: go('settings') },
      {
        id: 'newtab',
        label: t('palette.newTab'),
        hint: t('palette.hint.browser'),
        run: () => { newTab(); setOverlay('none'); setOpen(false) }
      }
    ]
    for (const r of rooms) {
      list.push({
        id: `room-${r.id}`,
        label: t('palette.switchToRoom', { name: r.name }),
        hint: t('palette.hint.room'),
        run: () => {
          void switchRoom(r.id)
          setOpen(false)
        }
      })
    }
    for (const n of notes.slice(0, 30)) {
      list.push({
        id: `note-${n.id}`,
        label: t('palette.openNote', { title: n.title }),
        hint: t('palette.hint.note'),
        run: () => {
          setOverlay('notes')
          setOpen(false)
        }
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, notes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 12)

    // Serbest metin bir komut çubuğu girdisidir: URL ise aç; değilse önce
    // normal web araması, sonra Wisp'in araştırma araması önerilir.
    const resolved = resolveAddress(query.trim().replace(/^\?/, ''))
    const goCommands: Command[] =
      resolved.type === 'url'
        ? [
            {
              id: 'go-url',
              label: t('palette.open', { url: resolved.url }),
              hint: t('palette.hint.newTab'),
              run: () => {
                useApp.getState().newTab(resolved.url)
                useApp.getState().setOverlay('none')
                setOpen(false)
              }
            }
          ]
        : [
            {
              id: 'web-search',
              label: t('palette.webSearchFor', { query: resolved.query ?? '' }),
              hint: t('palette.hint.web'),
              run: () => {
                const { newTab, setOverlay, config } = useApp.getState()
                newTab(webSearchUrl(config?.searchEngine, resolved.query ?? ''))
                setOverlay('none')
                setOpen(false)
              }
            },
            {
              id: 'quick-search',
              label: t('palette.searchFor', { query: resolved.query ?? '' }),
              hint: t('palette.hint.search'),
              run: () => {
                useApp.getState().requestSearch(resolved.query ?? '')
                setOpen(false)
              }
            }
          ]

    const term = q.startsWith('?') ? q.slice(1).trim() : q
    const matches = commands.filter((c) => c.label.toLowerCase().includes(term)).slice(0, 10)
    return [...goCommands, ...matches]
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          placeholder={t('palette.placeholder')}
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
            <div className="px-4 py-6 text-center text-xs text-neutral-600">{t('palette.noMatch')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
