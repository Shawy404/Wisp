// Wisp — © Shawy404. All rights reserved.
import { useEffect, useState } from 'react'
import { changelogFor } from '@shared/changelog'
import { invoke, useApp, useT } from '@/store'

type Phase = 'available' | 'downloading' | 'ready' | 'error'

interface UpdateState {
  version: string
  notes: string
  phase: Phase
}

interface Progress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

function fmtMB(bytes: number): string {
  return (bytes / 1024 ** 2).toFixed(1)
}

/**
 * Update flow, entirely inside the app — no installer window ever appears.
 * A new release is announced as a banner; the user chooses to download; the
 * download runs behind a small progress overlay with the wisp bobbing along;
 * when it's ready the same overlay offers a restart that installs silently and
 * relaunches. Rendered as a layout bar/overlay so the native page view can't
 * cover it, and the log modal hides that view while open.
 */
export default function UpdateBanner(): React.JSX.Element | null {
  const t = useT()
  const lang = useApp((s) => s.config?.language ?? 'tr')
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    const offAvailable = window.wisp.on('update:available', (info) => {
      const { version, notes } = info as { version: string; notes?: string }
      setUpdate((prev) =>
        // Don't downgrade a download-in-flight or ready state back to available.
        prev && prev.phase !== 'available' ? prev : { version, notes: notes ?? '', phase: 'available' }
      )
      setDismissed(false)
    })
    const offProgress = window.wisp.on('update:progress', (p) => {
      setProgress(p as Progress)
      setUpdate((prev) => (prev ? { ...prev, phase: 'downloading' } : prev))
    })
    const offReady = window.wisp.on('update:ready', (info) => {
      const { version, notes } = info as { version: string; notes?: string }
      setProgress(null)
      setUpdate({ version, notes: notes ?? '', phase: 'ready' })
      setDismissed(false)
    })
    const offError = window.wisp.on('update:error', (info) => {
      setError((info as { message?: string }).message ?? '')
      setUpdate((prev) => (prev && prev.phase === 'downloading' ? { ...prev, phase: 'error' } : prev))
    })
    return () => {
      offAvailable()
      offProgress()
      offReady()
      offError()
    }
  }, [])

  // Hide the native page view while the download/log overlay is up, same trick
  // the command palette uses, so the overlay isn't drawn underneath it.
  const overlayUp = showLog || (!!update && (update.phase === 'downloading' || update.phase === 'ready' || update.phase === 'error'))
  useEffect(() => {
    if (overlayUp) void invoke('viewport:visible', false)
    else void invoke('viewport:visible', useApp.getState().overlay === 'none')
  }, [overlayUp])

  if (!update || dismissed) return null

  const fallback = changelogFor(update.version)
  const logText = update.notes.trim() || fallback?.notes[lang].map((n) => `• ${n}`).join('\n') || ''

  const startDownload = (): void => {
    setError('')
    setProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })
    setUpdate((prev) => (prev ? { ...prev, phase: 'downloading' } : prev))
    void invoke('update:download')
  }

  // --- The announcement bar (before the user commits to downloading). ---
  const banner = update.phase === 'available' && (
    <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">
        ↑
      </span>
      <div className="min-w-0 flex-1 truncate text-xs text-neutral-100">
        {t('update.available', { version: update.version })}
      </div>
      <button
        className="shrink-0 rounded-md px-3 py-1 text-xs text-accent hover:bg-accent/15"
        onClick={() => setShowLog(true)}
      >
        {t('update.log')}
      </button>
      <button
        className="shrink-0 rounded-md bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
        onClick={() => setDismissed(true)}
      >
        {t('update.later')}
      </button>
      <button
        className="shrink-0 rounded-md bg-accent/80 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-accent"
        onClick={startDownload}
      >
        {t('update.download')}
      </button>
    </div>
  )

  // --- The in-app download / ready / error overlay, with the wisp bobbing. ---
  const overlay = (update.phase === 'downloading' || update.phase === 'ready' || update.phase === 'error') && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[380px] rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="wisp-orb wisp-orb--update">
            <span className="wisp-eye" />
            <span className="wisp-eye" />
          </div>

          {update.phase === 'error' ? (
            <>
              <div className="text-sm font-semibold text-neutral-100">{t('update.failed')}</div>
              {error && <div className="text-center text-[11px] text-neutral-500">{error}</div>}
              <div className="mt-1 flex gap-2">
                <button
                  className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                  onClick={() => setDismissed(true)}
                >
                  {t('update.later')}
                </button>
                <button
                  className="rounded-md bg-accent/80 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-accent"
                  onClick={startDownload}
                >
                  {t('update.retry')}
                </button>
              </div>
            </>
          ) : update.phase === 'ready' ? (
            <>
              <div className="text-sm font-semibold text-neutral-100">
                {t('update.readyTitle', { version: update.version })}
              </div>
              <div className="text-center text-[11px] text-neutral-500">{t('update.readyHint')}</div>
              <div className="mt-1 flex gap-2">
                <button
                  className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                  onClick={() => setDismissed(true)}
                >
                  {t('update.later')}
                </button>
                <button
                  className="rounded-md bg-accent/80 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-accent"
                  onClick={() => void invoke('update:install')}
                >
                  {t('update.restart')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-neutral-100">
                {t('update.downloading', { version: update.version })}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${Math.round(progress?.percent ?? 0)}%` }}
                />
              </div>
              <div className="flex w-full justify-between text-[10px] text-neutral-500 tabular-nums">
                <span>{Math.round(progress?.percent ?? 0)}%</span>
                {progress && progress.total > 0 && (
                  <span>
                    {fmtMB(progress.transferred)} / {fmtMB(progress.total)} MB
                    {progress.bytesPerSecond > 0 && ` · ${fmtMB(progress.bytesPerSecond)} MB/s`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {banner}
      {overlay}

      {showLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowLog(false)}
        >
          <div
            className="flex max-h-[70vh] w-[440px] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
              <span className="text-sm font-semibold text-neutral-100">
                {t('update.logTitle', { version: update.version })}
              </span>
              <button
                className="ml-auto rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                onClick={() => setShowLog(false)}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {logText ? (
                <pre className="text-xs leading-relaxed whitespace-pre-wrap text-neutral-300 select-text">
                  {logText}
                </pre>
              ) : (
                <div className="py-6 text-center text-xs text-neutral-600">{t('update.noLog')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
