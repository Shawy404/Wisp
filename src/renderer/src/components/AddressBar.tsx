// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import { resolveAddress, webSearchUrl } from '@shared/address'
import { invoke, useApp, useT } from '@/store'

function NavButton(props: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
      onClick={props.onClick}
      disabled={props.disabled}
      data-tip={props.title}
      data-tip-pos="bottom"
    >
      {props.children}
    </button>
  )
}

/** Shield badge: session-wide blocked request count, refreshed while browsing. */
function ShieldBadge(): React.JSX.Element | null {
  const adblock = useApp((s) => s.config?.adblock ?? false)
  const t = useT()
  const [blocked, setBlocked] = useState(0)

  useEffect(() => {
    if (!adblock) return
    let alive = true
    const tick = async (): Promise<void> => {
      const stats = (await invoke('adblock:stats')) as { blocked: number }
      if (alive) setBlocked(stats.blocked)
    }
    void tick()
    const id = setInterval(() => void tick(), 4000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [adblock])

  if (!adblock) return null
  return (
    <div
      className="flex h-6 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] text-neutral-500"
      data-tip={t('address.shield')}
      data-tip-pos="bottom"
    >
      <svg width="11" height="11" viewBox="0 0 12 12">
        <path
          d="M6 1 L10.5 2.8 V6 C10.5 8.6 8.6 10.4 6 11 C3.4 10.4 1.5 8.6 1.5 6 V2.8 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
      {blocked > 0 && <span className="tabular-nums">{blocked > 999 ? '1k+' : blocked}</span>}
    </div>
  )
}

const VIDEO_URL_RE = /(youtube\.com\/(watch|shorts)|youtu\.be\/|vimeo\.com\/\d)/i

/**
 * Shows on video pages: downloads the whole video — or just a time range —
 * into the room's clips via yt-dlp. Progress lands in the downloads panel.
 */
function VideoClipButton({ url }: { url?: string }): React.JSX.Element | null {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)

  // The dialog floats over the page area — hide the native view meanwhile.
  useEffect(() => {
    if (open) void invoke('viewport:visible', false)
    else void invoke('viewport:visible', useApp.getState().overlay === 'none')
  }, [open])

  if (!url || !VIDEO_URL_RE.test(url)) return null

  const startDownload = async (): Promise<void> => {
    setBusy(true)
    const res = await invoke<{ error?: string }>(
      'video:clip',
      url,
      start.trim() || undefined,
      end.trim() || undefined
    )
    setBusy(false)
    if (res.error) {
      window.dispatchEvent(new CustomEvent('wisp:toast-local', { detail: res.error }))
      return
    }
    setOpen(false)
    setStart('')
    setEnd('')
  }

  return (
    <>
      <NavButton title={t('video.button')} onClick={() => setOpen(true)}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="0.8" y="2" width="7.4" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M8.2 5 L11.2 3.2 V10.8 L8.2 9" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M3.4 4.6 L6 6 L3.4 7.4 Z" fill="currentColor" />
        </svg>
      </NavButton>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-28"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-96 rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-sm font-medium text-neutral-100">{t('video.title')}</div>
            <div className="mb-3 text-[11px] text-neutral-500">{t('video.hint')}</div>
            <div className="mb-3 flex items-center gap-2">
              <input
                autoFocus
                value={start}
                onChange={(e) => setStart(e.target.value)}
                placeholder={t('video.start')}
                className="h-8 w-1/2 rounded-md border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
                spellCheck={false}
              />
              <span className="text-neutral-600">–</span>
              <input
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                placeholder={t('video.end')}
                onKeyDown={(e) => e.key === 'Enter' && void startDownload()}
                className="h-8 w-1/2 rounded-md border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
                spellCheck={false}
              />
            </div>
            <button
              className="h-8 w-full rounded-md bg-accent/15 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
              disabled={busy}
              onClick={() => void startDownload()}
            >
              {t('video.download')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function AddressBar(): React.JSX.Element {
  const tabs = useApp((s) => s.tabs)
  const activeTabId = useApp((s) => s.activeTabId)
  const devMode = useApp((s) => s.config?.devMode ?? false)
  const t = useT()
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused) setValue(activeTab?.url === 'about:blank' ? '' : (activeTab?.url ?? ''))
  }, [activeTab?.url, activeTabId, focused])

  // Shortcuts live in shortcuts.ts; Ctrl+L arrives here as a focus event.
  useEffect(() => {
    const focus = (): void => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('wisp:focus-address', focus)
    return () => window.removeEventListener('wisp:focus-address', focus)
  }, [])

  const submit = (): void => {
    const { activeTabId, navigate, newTab, requestSearch, config } = useApp.getState()
    // "?" prefix targets Wisp's research search; anything else behaves like a
    // normal browser — URLs open, plain text goes to the web search engine.
    if (value.trim().startsWith('?')) {
      const q = value.trim().slice(1).trim()
      if (q) requestSearch(q)
      inputRef.current?.blur()
      return
    }
    const resolved = resolveAddress(value)
    if (resolved.type === 'url') {
      if (activeTabId) navigate(activeTabId, resolved.url)
      else newTab(resolved.url)
    } else if (resolved.query) {
      const url = webSearchUrl(config?.searchEngine, resolved.query)
      if (activeTabId) navigate(activeTabId, url)
      else newTab(url)
    }
    inputRef.current?.blur()
  }

  return (
    <div className="no-drag mx-auto flex h-8 min-w-0 flex-1 max-w-2xl items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/70 px-1.5 focus-within:border-accent/50">
      <NavButton
        title={t('address.back')}
        disabled={!activeTab?.canGoBack}
        onClick={() => activeTabId && invoke('tabs:back', activeTabId)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M8 1 L3 6 L8 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </NavButton>
      <NavButton
        title={t('address.forward')}
        disabled={!activeTab?.canGoForward}
        onClick={() => activeTabId && invoke('tabs:forward', activeTabId)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M4 1 L9 6 L4 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </NavButton>
      <NavButton title={t('address.reload')} onClick={() => activeTabId && invoke('tabs:reload', activeTabId)}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M10.5 6 A4.5 4.5 0 1 1 6 1.5 M6 1.5 L8.5 1.5 M6 1.5 L6 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      </NavButton>
      {devMode && (
        <NavButton
          title={t('address.devtools')}
          disabled={!activeTab}
          onClick={() => invoke('tabs:devtools')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M4.5 3 L2 6 L4.5 9 M7.5 3 L10 6 L7.5 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </NavButton>
      )}
      <NavButton
        title={t('address.zap')}
        disabled={!activeTab || activeTab.url === 'about:blank'}
        onClick={() => {
          window.dispatchEvent(new CustomEvent('wisp:toast-local', { detail: t('address.zapHint') }))
          void invoke<{ zapped: boolean }>('zap:start').then((res) => {
            if (res.zapped) {
              window.dispatchEvent(
                new CustomEvent('wisp:toast-local', { detail: t('address.zapDone') })
              )
            }
          })
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M1.5 1.5 L10.5 10.5 M4.2 3.1 C4.8 2.8 5.4 2.7 6 2.7 C8.5 2.7 10.4 4.9 11 6 C10.7 6.6 10.1 7.4 9.3 8.1 M6.9 6.9 A1.3 1.3 0 1 1 5.1 5.1 M2.8 3.9 C1.9 4.6 1.3 5.4 1 6 C1.6 7.1 3.5 9.3 6 9.3 C6.6 9.3 7.2 9.2 7.7 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </NavButton>
      <VideoClipButton url={activeTab?.url} />
      <NavButton
        title={t('address.reader')}
        disabled={!activeTab || activeTab.url === 'about:blank'}
        onClick={() => useApp.getState().setOverlay('reader')}
      >
        <svg width="13" height="13" viewBox="0 0 14 14">
          <path
            d="M2 2.5 h10 M2 5 h10 M2 7.5 h7 M2 10 h9"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </NavButton>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          setFocused(true)
          e.target.select()
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={t('address.placeholder')}
        className="h-7 min-w-0 flex-1 bg-transparent px-2 text-center text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:text-left"
        spellCheck={false}
      />
      <ShieldBadge />
    </div>
  )
}
