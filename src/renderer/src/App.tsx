// Wisp. © Shawy404, MIT.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { THEMES } from '@shared/themes'
import { invoke, useApp } from '@/store'
import TitleBar from './components/TitleBar'
import RoomSidebar from './components/RoomSidebar'
import Viewport from './components/Viewport'
import CommandPalette from './components/CommandPalette'
import BottomBar from './components/BottomBar'
import Toast from './components/Toast'
import PermissionPrompt from './components/PermissionPrompt'
import VaultOffer from './components/VaultOffer'
import UpdateBanner from './components/UpdateBanner'

// Overlay panels are only shown on demand, and the heavy ones pull in big
// libraries (cytoscape for the map, CodeMirror for notes). Loading them lazily
// keeps the initial bundle — and so the cold-start parse time — much smaller.
const SearchPanel = lazy(() => import('./components/SearchPanel'))
const SourcesPanel = lazy(() => import('./components/SourcesPanel'))
const ReaderPanel = lazy(() => import('./components/ReaderPanel'))
const NotesPanel = lazy(() => import('./components/NotesPanel'))
const MapPanel = lazy(() => import('./components/MapPanel'))
const HistoryPanel = lazy(() => import('./components/HistoryPanel'))
const DownloadsPanel = lazy(() => import('./components/DownloadsPanel'))
const RoomSearchPanel = lazy(() => import('./components/RoomSearchPanel'))
const ShortcutsPanel = lazy(() => import('./components/ShortcutsPanel'))
const VaultPanel = lazy(() => import('./components/VaultPanel'))
const SplitView = lazy(() => import('./components/SplitView'))
const SettingsPanel = lazy(() => import('./components/SettingsPanel'))
const Onboarding = lazy(() => import('./components/Onboarding'))

export default function App(): React.JSX.Element {
  const ready = useApp((s) => s.ready)
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)
  const backgroundUrl = useApp((s) => s.backgroundUrl)
  const trueFullscreen = useApp((s) => s.trueFullscreen)

  // "follow the system" theme: the renderer's prefers-color-scheme tracks the
  // os setting on its own, so no ipc gymnastics needed. i was ready for pain
  // here and there was none.
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const effectiveTheme = config?.followSystemTheme ? (systemDark ? 'dark' : 'light') : config?.theme

  useEffect(() => {
    void useApp.getState().init()
    // Use the splash time productively: warm the heavy, code-split panels
    // (cytoscape map, CodeMirror editor) in the background so the first time you
    // open one after launch it's already parsed and opens instantly.
    void import('./components/MapPanel')
    void import('./components/NotesPanel')
    void import('./components/SplitView')
    void import('./components/SearchPanel')
    void import('./components/SettingsPanel')
  }, [])

  // Live theme: accent drives every `text-accent`/`bg-accent` via the CSS var,
  // a `wisp-<theme>` class swaps the whole shell palette (dark = default), and
  // `wisp-translucent` turns the shell to glass — over a background image, or
  // over the actual desktop when the window itself is transparent.
  useEffect(() => {
    if (!config) return
    const el = document.documentElement
    el.style.setProperty('--wisp-accent', config.accent)
    for (const cls of [...el.classList]) if (cls.startsWith('wisp-')) el.classList.remove(cls)
    if (effectiveTheme && effectiveTheme !== 'dark') el.classList.add(`wisp-${effectiveTheme}`)
    if (config.windowTransparent || (config.translucentUi && backgroundUrl)) {
      el.classList.add('wisp-translucent')
    }
  }, [config?.accent, effectiveTheme, config?.translucentUi, config?.windowTransparent, backgroundUrl])

  // Full-window boot splash: the wisp animates over the whole app for a
  // deliberate ~3.5s (so people actually see it and the warmed-up panels finish
  // loading), then fades out and unmounts. Anchored to first mount, not to how
  // fast init() resolves, so the timing is stable on any machine.
  const MIN_SPLASH_MS = 3500
  const mountedAt = useRef(Date.now())
  const [splashFading, setSplashFading] = useState(false)
  const [splashGone, setSplashGone] = useState(false)
  useEffect(() => {
    if (!ready) return
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAt.current))
    const fade = setTimeout(() => setSplashFading(true), wait)
    const gone = setTimeout(() => setSplashGone(true), wait + 500)
    return () => {
      clearTimeout(fade)
      clearTimeout(gone)
    }
  }, [ready])

  // A restored tab's native page view is drawn on top of the renderer, so it
  // would cover the splash — keep the page hidden until the splash is gone, then
  // hand visibility back to the overlay logic. Re-asserted on `ready` because
  // restoring tabs re-attaches (and re-shows) the active view mid-splash.
  useEffect(() => {
    if (!splashGone) void invoke('viewport:visible', false)
    else void invoke('viewport:visible', useApp.getState().overlay === 'none')
  }, [ready, splashGone])

  const splash = !splashGone && (
    // Opaque hardcoded background so it never shows through, even with window
    // transparency on — the animation fills the launch.
    <div
      className={`wisp-splash ${splashFading ? 'is-done' : ''}`}
      style={{ background: '#0e0e12' }}
    >
      <div className="wisp-orb">
        <span className="wisp-eye" />
        <span className="wisp-eye" />
      </div>
      <div className="wisp-splash-name">Wisp</div>
    </div>
  )

  if (!ready) return <div className="h-full bg-neutral-950">{splash}</div>

  return (
    <div className="relative flex h-full flex-col">
      {splash}
      {backgroundUrl &&
        (() => {
          // The built-in icon shows as a centered watermark; a custom image fills.
          const isIcon = !config?.backgroundImage || config.backgroundImage === 'icon'
          // a custom background gets an opaque slab under it. without this a
          // transparent window let the actual desktop wallpaper bleed through
          // MY wallpaper, which is a crossover nobody asked for.
          const base = THEMES.find((t) => t.id === effectiveTheme)?.preview[0] ?? '#0e0e12'
          return (
            <>
              {!isIcon && (
                <div className="pointer-events-none fixed inset-0 z-0" style={{ background: base }} />
              )}
              <div
                className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${backgroundUrl})`,
                  backgroundSize: isIcon ? 'min(38vw, 42vh)' : 'cover',
                  opacity: config?.backgroundOpacity ?? 0.15,
                  filter: config?.backgroundBlur ? `blur(${config.backgroundBlur}px)` : undefined
                }}
              />
            </>
          )
        })()}
      <div className="relative z-10 flex h-full flex-col">
      {/* true fullscreen strips every bar off; the page owns the whole window.
          F11 or shift+F11 brings the ui back. the update banner stays mounted
          (it hides itself) so a download in flight doesn't lose its overlay. */}
      {!trueFullscreen && <TitleBar />}
      <UpdateBanner />
      <PermissionPrompt />
      <VaultOffer />
      <div className="flex min-h-0 flex-1">
        {!trueFullscreen && <RoomSidebar />}
        <Viewport>
          <Suspense fallback={null}>
            {overlay === 'search' && <SearchPanel />}
            {overlay === 'sources' && <SourcesPanel />}
            {overlay === 'reader' && <ReaderPanel />}
            {overlay === 'notes' && <NotesPanel />}
            {overlay === 'map' && <MapPanel />}
            {overlay === 'history' && <HistoryPanel />}
            {overlay === 'downloads' && <DownloadsPanel />}
            {overlay === 'roomsearch' && <RoomSearchPanel />}
            {overlay === 'shortcuts' && <ShortcutsPanel />}
            {overlay === 'vault' && <VaultPanel />}
            {overlay === 'split' && <SplitView />}
            {overlay === 'settings' && <SettingsPanel />}
          </Suspense>
          <CommandPalette />
          <Toast />
        </Viewport>
      </div>
      {!trueFullscreen && <BottomBar />}
      </div>
      {/* First run: language + a short skippable tour, above everything. */}
      {config && !config.onboarded && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
    </div>
  )
}
