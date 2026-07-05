// Wisp. © Shawy404, MIT.
import { useEffect, useRef, useState } from 'react'
import type { RoomSearchHit } from '@shared/types'
import { invoke, useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'

const TYPE_KEY: Record<RoomSearchHit['type'], TKey> = {
  note: 'roomsearch.type.note',
  source: 'roomsearch.type.source',
  clip: 'roomsearch.type.clip',
  history: 'roomsearch.type.history'
}

const TYPE_COLOR: Record<RoomSearchHit['type'], string> = {
  note: 'text-accent border-accent/30',
  source: 'text-sky-400 border-sky-400/30',
  clip: 'text-amber-300 border-amber-300/30',
  history: 'text-neutral-400 border-neutral-500/30'
}

/** Ctrl+Shift+F: full-text search across the room's notes, sources, clips and history. */
export default function RoomSearchPanel(): React.JSX.Element {
  const activeRoomId = useApp((s) => s.activeRoomId)
  const t = useT()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<RoomSearchHit[]>([])
  const [searched, setSearched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!activeRoomId || query.trim().length < 2) {
      setHits([])
      setSearched(false)
      return
    }
    timer.current = setTimeout(() => {
      void invoke<RoomSearchHit[]>('room:search', activeRoomId, query.trim()).then((res) => {
        setHits(res)
        setSearched(true)
      })
    }, 180)
  }, [query, activeRoomId])

  const openHit = (hit: RoomSearchHit): void => {
    const app = useApp.getState()
    if (hit.type === 'note') {
      app.requestNote(hit.id)
    } else if (hit.url) {
      app.newTab(hit.url)
      app.setOverlay('none')
    } else {
      app.setOverlay('sources')
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto w-full max-w-2xl px-6 pt-6 pb-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('roomsearch.placeholder')}
          className="h-10 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
          spellCheck={false}
        />
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-1.5 overflow-y-auto px-6 pb-6">
        {!searched && (
          <div className="pt-8 text-center text-xs text-neutral-600">{t('roomsearch.hint')}</div>
        )}
        {searched && hits.length === 0 && (
          <div className="pt-8 text-center text-xs text-neutral-600">{t('roomsearch.empty')}</div>
        )}
        {hits.map((hit, i) => (
          <button
            key={`${hit.type}-${hit.id}-${i}`}
            onClick={() => openHit(hit)}
            className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-left hover:border-neutral-700"
          >
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded border px-1 py-px text-[9px] tracking-wide uppercase ${TYPE_COLOR[hit.type]}`}
              >
                {t(TYPE_KEY[hit.type])}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">
                {hit.title}
              </span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-400">
              {hit.snippet}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
