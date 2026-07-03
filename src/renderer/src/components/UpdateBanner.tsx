// Wisp — © Shawy404. All rights reserved.
import { useEffect, useState } from 'react'
import { invoke, useT } from '@/store'

/**
 * "A new version is ready" banner. Shown once electron-updater has downloaded
 * an update in the background (Windows/NSIS). Restarting installs it; the user
 * decides when. Rendered as a layout bar so the native page view can't cover it.
 */
export default function UpdateBanner(): React.JSX.Element | null {
  const t = useT()
  const [version, setVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(
    () =>
      window.wisp.on('update:ready', (info) => {
        setVersion((info as { version: string }).version)
        setDismissed(false)
      }),
    []
  )

  if (!version || dismissed) return null

  return (
    <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">
        ↑
      </span>
      <div className="min-w-0 flex-1 truncate text-xs text-neutral-100">
        {t('update.ready', { version })}
      </div>
      <button
        className="shrink-0 rounded-md bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
        onClick={() => setDismissed(true)}
      >
        {t('update.later')}
      </button>
      <button
        className="shrink-0 rounded-md bg-accent/80 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-accent"
        onClick={() => void invoke('update:install')}
      >
        {t('update.restart')}
      </button>
    </div>
  )
}
