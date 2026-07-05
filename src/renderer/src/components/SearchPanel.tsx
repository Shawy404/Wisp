// Wisp. © Shawy404, MIT.
import { useEffect, useRef, useState } from 'react'
import type { SearchResults, SourceItem } from '@shared/types'
import { webSearchUrl } from '@shared/address'
import { invoke, useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'
import SourceCard from './SourceCard'

type ResultTab = 'academic' | 'wiki' | 'images' | 'web'

/** The wisp drifts around while every source is queried — nicer than a spinner. */
function WispLoader(): React.JSX.Element {
  const t = useT()
  const [msg, setMsg] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMsg((m) => (m + 1) % 5), 1700)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center gap-5 pt-16">
      <div className="wisp-loader">
        <span className="wisp-trail" />
        <span className="wisp-trail" />
        <span className="wisp-trail" />
        <div className="wisp-orb">
          <span className="wisp-eye" />
          <span className="wisp-eye" />
        </div>
      </div>
      <div className="text-xs text-neutral-500">{t(`search.fun.${msg + 1}` as TKey)}</div>
    </div>
  )
}

const TAB_KEY: Record<ResultTab, TKey> = {
  academic: 'search.tab.academic',
  wiki: 'search.tab.wiki',
  images: 'search.tab.images',
  web: 'search.tab.web'
}

export default function SearchPanel(): React.JSX.Element {
  const activeRoomId = useApp((s) => s.activeRoomId)
  const devMode = useApp((s) => s.config?.devMode ?? false)
  const savedSources = useApp((s) => s.sources)
  const t = useT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<ResultTab>('academic')
  const [showJson, setShowJson] = useState(false)
  const [page, setPage] = useState(0)
  // Where the query goes: Wisp's research aggregator, or the plain web engine.
  const [mode, setMode] = useState<'wisp' | 'web'>('wisp')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Guards the "restore last results" effect from clobbering a fresh search.
  const searchedRef = useRef(false)

  const run = async (q: string): Promise<void> => {
    if (!q.trim()) return
    if (mode === 'web') {
      const { newTab, setOverlay, config } = useApp.getState()
      newTab(webSearchUrl(config?.searchEngine, q.trim()))
      setOverlay('none')
      return
    }
    searchedRef.current = true
    setLoading(true)
    try {
      const res = await invoke<SearchResults>('search:run', q.trim())
      setResults(res)
      setTab(res.classification === 'academic' ? 'academic' : 'wiki')
    } finally {
      setLoading(false)
    }
  }

  // Address-bar / palette searches land here via the store, so they work even
  // when the panel wasn't mounted at the moment the query was submitted.
  const pendingSearch = useApp((s) => s.pendingSearch)
  useEffect(() => {
    const q = useApp.getState().consumePendingSearch()
    if (q) {
      setQuery(q)
      void run(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSearch])

  useEffect(() => {
    // Restore the room's last results when reopening the panel (unless a fresh
    // query is already queued).
    if (!results && activeRoomId && !searchedRef.current) {
      void invoke<SearchResults | null>('search:last', activeRoomId).then((last) => {
        if (last && !searchedRef.current) {
          setResults(last)
          setQuery(last.query)
          setTab(last.classification === 'academic' ? 'academic' : 'wiki')
        }
      })
    }
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items: SourceItem[] = results ? results[tab] : []

  // The backends return large result sets in one go; page through them so a
  // query stays browsable instead of one endless scroll.
  const pageSize = tab === 'images' ? 24 : 10
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pagedItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const goToPage = (p: number): void => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)))
    listRef.current?.scrollTo({ top: 0 })
  }
  useEffect(() => {
    setPage(0)
  }, [tab, results])

  // Nothing saves automatically anymore — every result carries its own save
  // button, and already-saved ones show a check instead.
  const savedIds = new Set(savedSources.map((s) => s.id))
  const saveResult = async (s: SourceItem): Promise<void> => {
    if (!activeRoomId || savedIds.has(s.id)) return
    await invoke('sources:add', activeRoomId, s)
    await useApp.getState().refreshRoomData()
  }

  const SaveButton = ({ source }: { source: SourceItem }): React.JSX.Element => {
    const saved = savedIds.has(source.id)
    return (
      <button
        className={`rounded px-1.5 py-px text-[10px] ${
          saved
            ? 'cursor-default text-accent'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-accent'
        }`}
        onClick={() => void saveResult(source)}
        data-tip={saved ? t('search.savedTip') : t('search.saveTip')}
      >
        {saved ? `✓ ${t('search.saved')}` : `＋ ${t('search.save')}`}
      </button>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void run(query)}
            placeholder={t('search.placeholder')}
            className="h-10 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
            spellCheck={false}
          />
          <button
            className="h-10 rounded-lg bg-accent/15 px-4 text-sm font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
            onClick={() => void run(query)}
            disabled={loading}
          >
            {loading ? t('search.searching') : t('search.button')}
          </button>
          {/* Which engine answers: Wisp's research search or the plain web. */}
          <div
            className="flex h-10 shrink-0 overflow-hidden rounded-lg border border-neutral-800"
            data-tip={t('search.mode.hint')}
            data-tip-pos="bottom"
          >
            {(['wisp', 'web'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 text-xs font-medium ${
                  mode === m
                    ? 'bg-neutral-800 text-accent'
                    : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t(m === 'wisp' ? 'search.mode.wisp' : 'search.mode.web')}
              </button>
            ))}
          </div>
        </div>

        {results && (
          <div className="flex items-center gap-1">
            {(Object.keys(TAB_KEY) as ResultTab[]).map((rt) => (
              <button
                key={rt}
                onClick={() => setTab(rt)}
                className={`rounded-md px-3 py-1 text-xs ${
                  tab === rt
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t(TAB_KEY[rt])}
                <span className="ml-1.5 text-[10px] text-neutral-600">{results[rt].length}</span>
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2">
              {results.classification === 'academic' && (
                <span className="text-[10px] text-neutral-600">{t('search.academicDetected')}</span>
              )}
              {devMode && (
                <button
                  onClick={() => setShowJson((v) => !v)}
                  className={`rounded px-2 py-0.5 text-[10px] ${
                    showJson ? 'bg-neutral-800 text-accent' : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                  data-tip={t('search.jsonToggle')}
                  data-tip-pos="bottom"
                >
                  {'{ } JSON'}
                </button>
              )}
            </span>
          </div>
        )}
      </div>

      <div ref={listRef} className="mx-auto w-full max-w-3xl flex-1 space-y-2 overflow-y-auto px-6 pb-6">
        {showJson && results && (
          <pre className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 text-[10px] leading-relaxed text-neutral-400 select-text">
            {JSON.stringify(results, null, 2)}
          </pre>
        )}
        {loading && <WispLoader />}
        {!loading && !results && (
          <div className="pt-10 text-center text-sm text-neutral-600">{t('search.empty')}</div>
        )}
        {!loading &&
          results &&
          (tab === 'images' ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pagedItems.map((s) => (
                <div
                  key={s.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900"
                  title={s.title}
                >
                  <button
                    className="h-full w-full"
                    onClick={() => {
                      if (s.url) {
                        useApp.getState().newTab(s.url)
                        useApp.getState().setOverlay('none')
                      }
                    }}
                  >
                    {s.imageUrl && (
                      <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </button>
                  <button
                    className={`absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-md text-xs backdrop-blur ${
                      savedIds.has(s.id)
                        ? 'bg-black/60 text-accent'
                        : 'bg-black/60 text-neutral-200 opacity-0 group-hover:opacity-100 hover:text-accent'
                    }`}
                    onClick={() => void saveResult(s)}
                    data-tip={savedIds.has(s.id) ? t('search.savedTip') : t('search.saveTip')}
                  >
                    {savedIds.has(s.id) ? '✓' : '＋'}
                  </button>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100">
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            pagedItems.map((s) => (
              <SourceCard key={s.id} source={s} extraActions={<SaveButton source={s} />} />
            ))
          ))}
        {!loading && results && items.length === 0 && (
          <div className="pt-8 text-center text-xs text-neutral-600">{t('search.noResultsInTab')}</div>
        )}
        {!loading && results && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-3 pb-1">
            <button
              disabled={currentPage === 0}
              onClick={() => goToPage(currentPage - 1)}
              className="rounded-md border border-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              {t('search.prev')}
            </button>
            <span className="text-[11px] text-neutral-500">
              {t('search.page', { page: currentPage + 1, total: totalPages })}
            </span>
            <button
              disabled={currentPage >= totalPages - 1}
              onClick={() => goToPage(currentPage + 1)}
              className="rounded-md border border-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              {t('search.next')}
            </button>
          </div>
        )}
        {results && results.errors.length > 0 && (
          <div className="pt-2 text-[10px] text-neutral-700">
            {t('search.unreachable', { list: results.errors.join(' · ') })}
          </div>
        )}
      </div>
    </div>
  )
}
