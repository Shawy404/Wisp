// Wisp — © Shawy404. All rights reserved.
import { useState } from 'react'
import type { SourceItem } from '@shared/types'
import { invoke, useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'
import SourceCard from './SourceCard'

type Filter = 'all' | SourceItem['kind']

const FILTERS: { key: Filter; labelKey: TKey }[] = [
  { key: 'all', labelKey: 'sources.filter.all' },
  { key: 'academic', labelKey: 'sources.filter.academic' },
  { key: 'wiki', labelKey: 'sources.filter.wiki' },
  { key: 'image', labelKey: 'sources.filter.image' },
  { key: 'clip', labelKey: 'sources.filter.clip' },
  { key: 'web', labelKey: 'sources.filter.web' }
]

export default function SourcesPanel(): React.JSX.Element {
  const sources = useApp((s) => s.sources)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const t = useT()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')

  const filtered = sources
    .filter((s) => filter === 'all' || s.kind === filter)
    .filter(
      (s) =>
        !text ||
        s.title.toLowerCase().includes(text.toLowerCase()) ||
        s.tags.some((t) => t.includes(text.toLowerCase()))
    )
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pt-6 pb-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('sources.searchPlaceholder', { count: sources.length })}
          className="h-9 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2 py-1 text-[11px] ${
                filter === f.key
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-2 overflow-y-auto px-6 pb-6">
        {filtered.map((s) => (
          <SourceCard
            key={s.id}
            source={s}
            onDelete={() => activeRoomId && void invoke('sources:delete', activeRoomId, s.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="pt-10 text-center text-xs text-neutral-600">{t('sources.empty')}</div>
        )}
      </div>
    </div>
  )
}
