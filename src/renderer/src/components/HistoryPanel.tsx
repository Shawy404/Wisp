// Wisp. © Shawy404, MIT.
import { useEffect, useMemo, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import { invoke, useApp, useT } from '@/store'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The room's browsing trail, newest first, grouped by day. Click reopens the
 * page in a tab; entries can be removed one by one, or the whole room's
 * history wiped behind an inline confirm.
 */
export default function HistoryPanel(): React.JSX.Element {
  const activeRoomId = useApp((s) => s.activeRoomId)
  const lang = useApp((s) => s.config?.language ?? 'tr')
  const t = useT()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [text, setText] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!activeRoomId) return
    void invoke<HistoryEntry[]>('history:list', activeRoomId).then(setEntries)
  }, [activeRoomId])

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
    )
  }, [entries, text])

  // Group consecutive entries by calendar day; the list is already newest-first.
  const groups = useMemo(() => {
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US'
    const startOfDay = (d: Date): number => new Date(d).setHours(0, 0, 0, 0)
    const today = startOfDay(new Date())
    const out: { label: string; items: HistoryEntry[] }[] = []
    let currentDay = ''
    for (const h of filtered) {
      const d = new Date(h.at)
      const dayKey = d.toDateString()
      if (dayKey !== currentDay) {
        currentDay = dayKey
        const diffDays = Math.round((today - startOfDay(d)) / 86400000)
        const label =
          diffDays === 0
            ? t('history.today')
            : diffDays === 1
              ? t('history.yesterday')
              : d.toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })
        out.push({ label, items: [] })
      }
      out[out.length - 1].items.push(h)
    }
    return out
  }, [filtered, lang, t])

  const open = (url: string): void => {
    useApp.getState().newTab(url)
    useApp.getState().setOverlay('none')
  }

  const remove = async (at: string): Promise<void> => {
    if (!activeRoomId) return
    await invoke('history:delete', activeRoomId, at)
    setEntries((prev) => prev.filter((h) => h.at !== at))
  }

  const clearAll = async (): Promise<void> => {
    if (!activeRoomId) return
    await invoke('history:clear', activeRoomId)
    setEntries([])
    setConfirmClear(false)
  }

  const timeOf = (iso: string): string =>
    new Date(iso).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

  return (
    <div className="wisp-panel absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pt-6 pb-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('history.searchPlaceholder', { count: entries.length })}
          className="h-9 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
          spellCheck={false}
        />
        {entries.length > 0 &&
          (confirmClear ? (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-neutral-400">{t('history.clearConfirm')}</span>
              <button
                className="rounded-md bg-red-500/15 px-2.5 py-1.5 text-red-400 hover:bg-red-500/25"
                onClick={() => void clearAll()}
              >
                {t('history.clearYes')}
              </button>
              <button
                className="rounded-md bg-neutral-800 px-2.5 py-1.5 text-neutral-300 hover:bg-neutral-700"
                onClick={() => setConfirmClear(false)}
              >
                {t('history.clearNo')}
              </button>
            </span>
          ) : (
            <button
              className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
              onClick={() => setConfirmClear(true)}
            >
              {t('history.clear')}
            </button>
          ))}
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 pb-6">
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="sticky top-0 z-10 bg-neutral-950 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              {g.label}
            </div>
            <div className="space-y-px">
              {g.items.map((h) => (
                <div
                  key={h.at}
                  className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-neutral-900"
                >
                  {h.favicon ? (
                    <img src={h.favicon} alt="" className="h-4 w-4 shrink-0 rounded-sm" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-sm bg-neutral-800" />
                  )}
                  <button
                    className="min-w-0 flex-1 truncate text-left text-xs text-neutral-200 hover:text-accent"
                    onClick={() => open(h.url)}
                    title={h.url}
                  >
                    {h.title || h.url}
                  </button>
                  <span className="hidden max-w-40 shrink-0 truncate text-[11px] text-neutral-600 sm:inline">
                    {hostOf(h.url)}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
                    {timeOf(h.at)}
                  </span>
                  <button
                    className="invisible shrink-0 rounded px-1 text-neutral-500 group-hover:visible hover:text-red-400"
                    onClick={() => void remove(h.at)}
                    data-tip={t('history.delete')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="pt-10 text-center text-xs text-neutral-600">
            {text ? t('history.noMatch') : t('history.empty')}
          </div>
        )}
      </div>
    </div>
  )
}
