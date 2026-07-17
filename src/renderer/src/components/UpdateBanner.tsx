// Wisp. © Shawy404, MIT.
import { useEffect, useRef, useState } from 'react'
import { changelogFor } from '@shared/changelog'
import { invoke, useApp, useT } from '@/store'
import { Icon } from './icons'

type Phase = 'available' | 'downloading' | 'paused' | 'ready' | 'error'

interface UpdateState {
  version: string
  notes: string
  phase: Phase
  /** A demo run driven from Settings — fakes progress instead of downloading. */
  demo?: boolean
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
 * Release notes come in as github flavoured markdown. This renders the parts
 * people actually read (headings, bullets, paragraphs) as real ui instead of
 * dumping the raw text with hashes and asterisks all over it. i'm not pulling
 * in a whole markdown library for a changelog popup.
 */
function ReleaseNotes({ text }: { text: string }): React.JSX.Element {
  const clean = (s: string): string =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
  const blocks: React.JSX.Element[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) return
    const heading = line.match(/^#{1,4}\s+(.*)/)
    if (heading) {
      blocks.push(
        <div
          key={i}
          className="mt-3 mb-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase first:mt-0"
        >
          {clean(heading[1])}
        </div>
      )
      return
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/)
    if (bullet) {
      blocks.push(
        <div key={i} className="flex gap-1.5 text-xs leading-relaxed text-neutral-300">
          <span className="shrink-0 text-accent">•</span>
          <span className="select-text">{clean(bullet[1])}</span>
        </div>
      )
      return
    }
    blocks.push(
      <p key={i} className="text-xs leading-relaxed text-neutral-300 select-text">
        {clean(line)}
      </p>
    )
  })
  return <div className="space-y-1">{blocks}</div>
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
  // The demo download's fake ticker, kept in a ref so pause can freeze it.
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

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
      // A straggler progress event can land right after a pause — don't let
      // it flip the phase back and make the pause button lie.
      setUpdate((prev) => (prev && prev.phase !== 'paused' ? { ...prev, phase: 'downloading' } : prev))
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
    const offPaused = window.wisp.on('update:paused', () => {
      setUpdate((prev) => (prev && prev.phase === 'downloading' ? { ...prev, phase: 'paused' } : prev))
    })
    // Settings → "Preview update" fires this so the whole banner→download→ready
    // animation can be seen without waiting for a real release.
    const onDemo = (): void => {
      setProgress(null)
      setError('')
      setDismissed(false)
      setUpdate({ version: '0.1.7 (demo)', notes: '', phase: 'available', demo: true })
    }
    window.addEventListener('wisp:demo-update', onDemo)
    return () => {
      offAvailable()
      offProgress()
      offReady()
      offError()
      offPaused()
      window.removeEventListener('wisp:demo-update', onDemo)
    }
  }, [])

  // Hide the native page view while the download/log overlay is up, same trick
  // the command palette uses, so the overlay isn't drawn underneath it.
  const overlayUp = showLog || (!!update && update.phase !== 'available')
  useEffect(() => {
    if (overlayUp) void invoke('viewport:visible', false)
    else void invoke('viewport:visible', useApp.getState().overlay === 'none')
  }, [overlayUp])

  if (!update || dismissed) return null

  const fallback = changelogFor(update.version)
  const logText = update.notes.trim() || fallback?.notes[lang].map((n) => `• ${n}`).join('\n') || ''

  // Fake a ~4s download so the animation can be watched end to end. Takes a
  // starting percent so the demo's pause button resumes where it stopped.
  const runDemoTicker = (fromPct: number): void => {
    const total = 158 * 1024 ** 2
    let pct = fromPct
    if (demoTimer.current) clearInterval(demoTimer.current)
    demoTimer.current = setInterval(() => {
      pct = Math.min(100, pct + 4 + Math.random() * 6)
      setProgress({
        percent: pct,
        transferred: (pct / 100) * total,
        total,
        bytesPerSecond: (12 + Math.random() * 8) * 1024 ** 2
      })
      if (pct >= 100) {
        if (demoTimer.current) clearInterval(demoTimer.current)
        demoTimer.current = null
        setProgress(null)
        setUpdate({ version: '0.1.7 (demo)', notes: '', phase: 'ready', demo: true })
      }
    }, 250)
  }

  const startDownload = (): void => {
    setError('')
    setProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })
    setUpdate((prev) => (prev ? { ...prev, phase: 'downloading' } : prev))
    if (update?.demo) {
      runDemoTicker(0)
      return
    }
    void invoke('update:download')
  }

  const pauseDownload = (): void => {
    if (update?.demo) {
      if (demoTimer.current) clearInterval(demoTimer.current)
      demoTimer.current = null
      setUpdate((prev) => (prev ? { ...prev, phase: 'paused' } : prev))
      return
    }
    void invoke('update:pause')
  }

  const resumeDownload = (): void => {
    setUpdate((prev) => (prev ? { ...prev, phase: 'downloading' } : prev))
    if (update?.demo) {
      runDemoTicker(progress?.percent ?? 0)
      return
    }
    // A "resume" is really a fresh downloadUpdate(); the differential
    // downloader reuses what already landed so the bar catches up fast.
    void invoke('update:download')
  }

  // --- The announcement bar (before the user commits to downloading). ---
  const banner = update.phase === 'available' && (
    <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <Icon name="arrow-up" size={12} />
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
  const overlay = (update.phase === 'downloading' || update.phase === 'paused' || update.phase === 'ready' || update.phase === 'error') && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="wisp-pop w-[380px] rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          {/* the wisp holds its breath while the download is paused */}
          <div className={`wisp-orb wisp-orb--update ${update.phase === 'paused' ? 'wisp-orb--paused' : ''}`}>
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
                  onClick={() => (update.demo ? setDismissed(true) : void invoke('update:install'))}
                >
                  {update.demo ? t('update.demoDone') : t('update.restart')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-neutral-100">
                {update.phase === 'paused'
                  ? t('update.pausedTitle')
                  : t('update.downloading', { version: update.version })}
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800"
                role="progressbar"
                aria-valuenow={Math.round(progress?.percent ?? 0)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full bg-accent transition-[width] duration-200 ${
                    update.phase === 'paused' ? 'opacity-50' : ''
                  }`}
                  style={{ width: `${Math.round(progress?.percent ?? 0)}%` }}
                />
              </div>
              <div className="flex w-full justify-between text-[10px] text-neutral-500 tabular-nums">
                <span>{Math.round(progress?.percent ?? 0)}%</span>
                {progress && progress.total > 0 && (
                  <span>
                    {fmtMB(progress.transferred)} / {fmtMB(progress.total)} MB
                    {update.phase === 'downloading' && progress.bytesPerSecond > 0 && ` · ${fmtMB(progress.bytesPerSecond)} MB/s`}
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-2">
                {update.phase === 'paused' ? (
                  <button
                    className="rounded-md bg-accent/80 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-accent"
                    onClick={resumeDownload}
                  >
                    {t('update.resume')}
                  </button>
                ) : (
                  <button
                    className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                    onClick={pauseDownload}
                  >
                    {t('update.pause')}
                  </button>
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
            className="wisp-pop flex max-h-[70vh] w-[440px] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
              <span className="text-sm font-semibold text-neutral-100">
                {t('update.logTitle', { version: update.version })}
              </span>
              <button
                className="ml-auto rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                onClick={() => setShowLog(false)}
                aria-label={t('update.later')}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {logText ? (
                <ReleaseNotes text={logText} />
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
