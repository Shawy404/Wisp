// Wisp — © Shawy404. All rights reserved.
import { useEffect, useState } from 'react'
import { changelogFor } from '@shared/changelog'
import { invoke, useApp, useT } from '@/store'

interface UpdateState {
  version: string
  notes: string
  /** Downloaded and ready to install (Windows), or merely announced (Linux). */
  ready: boolean
}

/**
 * Update banner. Appears when electron-updater announces a new release and
 * again once it's downloaded (Windows/NSIS). Besides restart/later the user
 * can open the release log for the incoming version; the GitHub release body
 * is preferred, the built-in changelog is the offline fallback. The user
 * decides when to restart. Rendered as a layout bar so the native page view
 * can't cover it.
 */
export default function UpdateBanner(): React.JSX.Element | null {
  const t = useT()
  const lang = useApp((s) => s.config?.language ?? 'tr')
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    const offAvailable = window.wisp.on('update:available', (info) => {
      const { version, notes } = info as { version: string; notes?: string }
      // Never downgrade a "ready" banner back to "available".
      setUpdate((prev) =>
        prev?.ready ? prev : { version, notes: notes ?? '', ready: false }
      )
      setDismissed(false)
    })
    const offReady = window.wisp.on('update:ready', (info) => {
      const { version, notes } = info as { version: string; notes?: string }
      setUpdate({ version, notes: notes ?? '', ready: true })
      setDismissed(false)
    })
    return () => {
      offAvailable()
      offReady()
    }
  }, [])

  // The native page view draws above the shell — hide it while the log modal
  // is open (same trick as the command palette) so the modal is visible.
  useEffect(() => {
    if (showLog) void invoke('viewport:visible', false)
    else void invoke('viewport:visible', useApp.getState().overlay === 'none')
  }, [showLog])

  if (!update || dismissed) return null

  const fallback = changelogFor(update.version)
  const logText = update.notes.trim() || fallback?.notes[lang].map((n) => `• ${n}`).join('\n') || ''

  return (
    <>
      <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">
          ↑
        </span>
        <div className="min-w-0 flex-1 truncate text-xs text-neutral-100">
          {t(update.ready ? 'update.ready' : 'update.available', { version: update.version })}
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
        {update.ready && (
          <button
            className="shrink-0 rounded-md bg-accent/80 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-accent"
            onClick={() => void invoke('update:install')}
          >
            {t('update.restart')}
          </button>
        )}
      </div>

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
