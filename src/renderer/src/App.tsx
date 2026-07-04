// Wisp — © Shawy404. All rights reserved.
import { lazy, Suspense, useEffect, useRef } from 'react'
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
    if (config.theme && config.theme !== 'dark') el.classList.add(`wisp-${config.theme}`)
    if (config.windowTransparent || (config.translucentUi && backgroundUrl)) {
      el.classList.add('wisp-translucent')
    }
  }, [config?.accent, config?.theme, config?.translucentUi, config?.windowTransparent, backgroundUrl])

  // The main window stays hidden behind the native splash window until we say
  // we're ready. Hold the splash for a deliberate minimum so people actually see
  // the animation and the warmed-up panels finish loading, then reveal the whole
  // app at once (Opera-style). The main process has an 8s hard fallback.
  const MIN_SPLASH_MS = 3200
  const mountedAt = useRef(Date.now())
  useEffect(() => {
    if (!ready) return
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAt.current))
    const id = setTimeout(() => void invoke('app:ready'), wait)
    return () => clearTimeout(id)
  }, [ready])

  if (!ready) return <div className="h-full bg-neutral-950" />

  return (
    <div className="relative flex h-full flex-col">
      {backgroundUrl &&
        (() => {
          // The built-in icon shows as a centered watermark; a custom image fills.
          const isIcon = !config?.backgroundImage || config.backgroundImage === 'icon'
          return (
            <div
              className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${backgroundUrl})`,
                backgroundSize: isIcon ? 'min(38vw, 42vh)' : 'cover',
                opacity: config?.backgroundOpacity ?? 0.15,
                filter: config?.backgroundBlur ? `blur(${config.backgroundBlur}px)` : undefined
              }}
            />
          )
        })()}
      <div className="relative z-10 flex h-full flex-col">
      <TitleBar />
      <UpdateBanner />
      <PermissionPrompt />
      <VaultOffer />
      <div className="flex min-h-0 flex-1">
        <RoomSidebar />
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
      <BottomBar />
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
