// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'
import type { DownloadInfo } from '@shared/types'
import { invoke, useT } from '@/store'

function formatBytes(n: number): string {
  if (n <= 0) return ''
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export default function DownloadsPanel(): React.JSX.Element {
  const t = useT()
  const [items, setItems] = useState<DownloadInfo[]>([])

  useEffect(() => {
    void invoke<DownloadInfo[]>('downloads:list').then(setItems)
    return window.wisp.on('downloads:state', (list) => setItems(list as DownloadInfo[]))
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-6 pb-3">
        <span className="text-sm font-semibold text-neutral-200">{t('downloads.title')}</span>
        {items.some((i) => i.state !== 'progress') && (
          <button
            className="text-[11px] text-neutral-500 underline decoration-dotted hover:text-neutral-300"
            onClick={() => void invoke('downloads:clear')}
          >
            {t('downloads.clear')}
          </button>
        )}
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-2 overflow-y-auto px-6 pb-6">
        {items.length === 0 && (
          <div className="pt-10 text-center text-xs text-neutral-600">{t('downloads.empty')}</div>
        )}
        {items.map((d) => {
          const pct = d.total > 0 ? Math.min(100, (d.received / d.total) * 100) : null
          return (
            <div key={d.id} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">
                  {d.filename}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-500">
                  {d.state === 'progress'
                    ? `${formatBytes(d.received)}${d.total ? ` / ${formatBytes(d.total)}` : ''}`
                    : d.state === 'done'
                      ? formatBytes(d.total || d.received)
                      : t(d.state === 'failed' ? 'downloads.state.failed' : 'downloads.state.canceled')}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-neutral-600">{d.url}</div>
              {d.state === 'progress' && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full bg-accent ${pct === null ? 'w-1/3 animate-pulse' : ''}`}
                    style={pct !== null ? { width: `${pct}%` } : undefined}
                  />
                </div>
              )}
              <div className="mt-1.5 flex gap-2">
                {d.state === 'progress' && (
                  <button
                    className="rounded px-1.5 py-px text-[10px] text-red-400/80 hover:bg-red-400/10"
                    onClick={() => void invoke('downloads:cancel', d.id)}
                  >
                    {t('downloads.cancel')}
                  </button>
                )}
                {d.state === 'done' && (
                  <>
                    <button
                      className="rounded px-1.5 py-px text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-accent"
                      onClick={() => void invoke('downloads:open', d.id)}
                    >
                      {t('downloads.open')}
                    </button>
                    <button
                      className="rounded px-1.5 py-px text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                      onClick={() => void invoke('downloads:show', d.id)}
                    >
                      {t('downloads.show')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
