// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/store'
import TitleBar from './components/TitleBar'
import RoomSidebar from './components/RoomSidebar'
import Viewport from './components/Viewport'
import SearchPanel from './components/SearchPanel'
import SourcesPanel from './components/SourcesPanel'
import ReaderPanel from './components/ReaderPanel'
import NotesPanel from './components/NotesPanel'
import MapPanel from './components/MapPanel'
import HistoryPanel from './components/HistoryPanel'
import DownloadsPanel from './components/DownloadsPanel'
import RoomSearchPanel from './components/RoomSearchPanel'
import ShortcutsPanel from './components/ShortcutsPanel'
import VaultPanel from './components/VaultPanel'
import Onboarding from './components/Onboarding'
import SplitView from './components/SplitView'
import CommandPalette from './components/CommandPalette'
import SettingsPanel from './components/SettingsPanel'
import Toast from './components/Toast'
import PermissionPrompt from './components/PermissionPrompt'
import VaultOffer from './components/VaultOffer'
import UpdateBanner from './components/UpdateBanner'

export default function App(): React.JSX.Element {
  const ready = useApp((s) => s.ready)
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)
  const backgroundUrl = useApp((s) => s.backgroundUrl)

  useEffect(() => {
    void useApp.getState().init()
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

  // Boot splash: the wisp bobs while the shell loads. Its lifetime is anchored
  // to a minimum wall-clock time from first mount, not to how fast init()
  // resolves — otherwise on a fast machine the window can appear only after the
  // splash has already timed out, and you'd never see it. It fades out once the
  // app is ready AND that minimum has elapsed.
  const MIN_SPLASH_MS = 1400
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

  const splash = !splashGone && (
    <div className={`wisp-splash ${splashFading ? 'is-done' : ''}`}>
      <div className="wisp-orb">
        <span className="wisp-eye" />
        <span className="wisp-eye" />
      </div>
      <div className="wisp-splash-name">Wisp</div>
    </div>
  )

  if (!ready) return <div className="h-full">{splash}</div>

  return (
    <div className="relative flex h-full flex-col">
      {splash}
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
          <CommandPalette />
          <Toast />
        </Viewport>
      </div>
      </div>
      {/* First run: language + a short skippable tour, above everything. */}
      {config && !config.onboarded && <Onboarding />}
    </div>
  )
}
