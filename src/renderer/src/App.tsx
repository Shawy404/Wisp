// Wisp — © Shawy404. All rights reserved.
import { useEffect } from 'react'
import { useApp } from '@/store'
import TitleBar from './components/TitleBar'
import RoomSidebar from './components/RoomSidebar'
import Viewport from './components/Viewport'
import SearchPanel from './components/SearchPanel'
import SourcesPanel from './components/SourcesPanel'
import ReaderPanel from './components/ReaderPanel'
import NotesPanel from './components/NotesPanel'
import MapPanel from './components/MapPanel'
import SplitView from './components/SplitView'
import CommandPalette from './components/CommandPalette'
import SettingsPanel from './components/SettingsPanel'
import Toast from './components/Toast'
import PermissionPrompt from './components/PermissionPrompt'

export default function App(): React.JSX.Element {
  const ready = useApp((s) => s.ready)
  const overlay = useApp((s) => s.overlay)
  const config = useApp((s) => s.config)

  useEffect(() => {
    void useApp.getState().init()
  }, [])

  // Live theme: accent drives every `text-accent`/`bg-accent` via the CSS var,
  // and a `wisp-<theme>` class swaps the whole shell palette (dark = default).
  useEffect(() => {
    if (!config) return
    const el = document.documentElement
    el.style.setProperty('--wisp-accent', config.accent)
    for (const cls of [...el.classList]) if (cls.startsWith('wisp-')) el.classList.remove(cls)
    if (config.theme && config.theme !== 'dark') el.classList.add(`wisp-${config.theme}`)
  }, [config?.accent, config?.theme])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-2xl font-semibold text-accent">Wisp</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <PermissionPrompt />
      <div className="flex min-h-0 flex-1">
        <RoomSidebar />
        <Viewport>
          {overlay === 'search' && <SearchPanel />}
          {overlay === 'sources' && <SourcesPanel />}
          {overlay === 'reader' && <ReaderPanel />}
          {overlay === 'notes' && <NotesPanel />}
          {overlay === 'map' && <MapPanel />}
          {overlay === 'split' && <SplitView />}
          {overlay === 'settings' && <SettingsPanel />}
          <CommandPalette />
          <Toast />
        </Viewport>
      </div>
    </div>
  )
}
