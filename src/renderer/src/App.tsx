// Wisp — © Shawy404. All rights reserved.
import { useEffect } from 'react'
import { useApp } from '@/store'
import TitleBar from './components/TitleBar'
import AddressBar from './components/AddressBar'
import RoomSidebar from './components/RoomSidebar'
import Viewport from './components/Viewport'
import SearchPanel from './components/SearchPanel'
import SourcesPanel from './components/SourcesPanel'

function OverlayPlaceholder({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
      <div className="text-sm text-neutral-500">{label}</div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const ready = useApp((s) => s.ready)
  const overlay = useApp((s) => s.overlay)

  useEffect(() => {
    void useApp.getState().init()
  }, [])

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
      <AddressBar />
      <div className="flex min-h-0 flex-1">
        <RoomSidebar />
        <Viewport>
          {overlay === 'search' && <SearchPanel />}
          {overlay === 'sources' && <SourcesPanel />}
          {overlay === 'notes' && <OverlayPlaceholder label="Notlar — Faz 4" />}
          {overlay === 'map' && <OverlayPlaceholder label="Kavram haritası — Faz 5" />}
          {overlay === 'settings' && <OverlayPlaceholder label="Ayarlar — Faz 7" />}
        </Viewport>
      </div>
    </div>
  )
}
