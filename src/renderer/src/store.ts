// Wisp. © Shawy404, MIT.
import { create } from 'zustand'
import {
  PRIVATE_ROOM_ID,
  type MapData,
  type NoteInfo,
  type RoomData,
  type RoomMeta,
  type SourceItem,
  type TabInfo,
  type WispConfig
} from '@shared/types'
import { translate, type TKey } from '@shared/i18n'

export type Overlay =
  | 'none'
  | 'search'
  | 'sources'
  | 'notes'
  | 'map'
  | 'settings'
  | 'reader'
  | 'split'
  | 'history'
  | 'downloads'
  | 'roomsearch'
  | 'shortcuts'
  | 'vault'

interface TabsState {
  roomId: string | null
  tabs: TabInfo[]
  activeTabId: string | null
}

interface AppState {
  ready: boolean
  config: WispConfig | null
  rooms: RoomMeta[]
  activeRoomId: string | null
  tabs: TabInfo[]
  activeTabId: string | null
  overlay: Overlay
  sources: SourceItem[]
  notes: NoteInfo[]
  map: MapData
  /** Query queued for the search panel — survives the panel not being mounted yet. */
  pendingSearch: string | null
  /** Note queued for the notes panel (e.g. double-clicked on the map). */
  pendingNoteId: string | null
  /** Data URL of the current background image (null = none). */
  backgroundUrl: string | null
  setBackgroundUrl: (url: string | null) => void
  /** True while a sidebar tab is being dragged — the viewport shows split drop zones. */
  draggingTab: boolean
  setDraggingTab: (dragging: boolean) => void
  /** Which side of the split view shows the page/reader pane. */
  splitSide: 'left' | 'right'
  /** Drag-to-split: focus the tab and open split view with the page on `side`. */
  requestSplit: (tabId: string, side: 'left' | 'right') => void
  /**
   * True while split view is positioning live web views itself, so the normal
   * viewport bounds/visibility logic stands back and doesn't fight it.
   */
  splitLive: boolean
  setSplitLive: (live: boolean) => void

  /** Window fullscreen state, mirrored from main (the wm can flip it too). */
  fullscreen: boolean
  setFullscreen: (on: boolean) => void

  /** Enter/leave the private room (in-memory session, no history, no traces). */
  togglePrivateMode: () => Promise<void>

  init: () => Promise<void>
  refreshRoomData: (roomId?: string) => Promise<void>
  setOverlay: (overlay: Overlay) => void
  /** Open the search panel and run this query (from the address bar / palette). */
  requestSearch: (query: string) => void
  consumePendingSearch: () => string | null
  /** Open the notes panel focused on this note. */
  requestNote: (noteId: string) => void
  consumePendingNote: () => string | null
  setConfig: (patch: Partial<WispConfig>) => Promise<void>

  createRoom: (name: string) => Promise<void>
  deleteRoom: (id: string) => Promise<void>
  renameRoom: (id: string, name: string) => Promise<void>
  setRoomColor: (id: string, color: string) => Promise<void>
  archiveRoom: (id: string) => Promise<void>
  restoreRoom: (id: string) => Promise<void>
  switchRoom: (id: string) => Promise<void>
  pinTab: (url: string, title: string, favicon?: string) => Promise<void>
  unpinTab: (url: string) => Promise<void>
  /** Essentials live in the global config — they follow you into every room. */
  addEssential: (url: string, title: string, favicon?: string) => Promise<void>
  removeEssential: (url: string) => Promise<void>
  /** Hide an essential in one room only (it stays everywhere else). */
  excludeEssentialFromRoom: (url: string, roomId: string) => Promise<void>
  /** Drag-and-drop: move a rail button to the sidebar or the title bar. */
  placeRailItem: (id: string, location: 'sidebar' | 'titlebar') => Promise<void>

  newTab: (url?: string, background?: boolean) => void
  closeTab: (id: string) => void
  activateTab: (id: string) => void
  navigate: (id: string, url: string) => void
  reorderTabs: (ids: string[]) => void
}

export const invoke = <T = unknown>(channel: string, ...args: unknown[]): Promise<T> =>
  window.wisp.invoke(channel, ...args) as Promise<T>

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  config: null,
  rooms: [],
  activeRoomId: null,
  tabs: [],
  activeTabId: null,
  overlay: 'none',
  sources: [],
  notes: [],
  map: { concepts: [], edges: [] },
  backgroundUrl: null,

  setBackgroundUrl: (url) => set({ backgroundUrl: url }),

  draggingTab: false,
  setDraggingTab: (dragging) => set({ draggingTab: dragging }),

  splitSide: 'left',
  requestSplit: (tabId, side) => {
    get().activateTab(tabId)
    set({ splitSide: side })
    get().setOverlay('split')
  },

  splitLive: false,
  setSplitLive: (live) => set({ splitLive: live }),

  fullscreen: false,
  setFullscreen: (on) => {
    void invoke('window:fullscreen', on)
    set({ fullscreen: on })
  },

  togglePrivateMode: async () => {
    const inPrivate = get().activeRoomId === PRIVATE_ROOM_ID
    const res = await invoke<{ on: boolean; activeRoomId: string | null }>('private:set', !inPrivate)
    set({ activeRoomId: res.activeRoomId, overlay: 'none' })
    void invoke('viewport:visible', true)
    await get().refreshRoomData(res.activeRoomId ?? undefined)
  },

  init: async () => {
    window.wisp.on('tabs:state', (state) => {
      const s = state as TabsState
      set({ tabs: s.tabs, activeTabId: s.activeTabId })
    })
    window.wisp.on('room:updated', (roomId) => {
      if (roomId === get().activeRoomId) void get().refreshRoomData()
    })
    // the wm can flip fullscreen without asking; mirror whatever it did
    window.wisp.on('window:fullscreen-changed', (on) => {
      set({ fullscreen: on === true })
    })
    // Screenshot tooling (WISP_SHOT): main asks for an overlay to be shown.
    // A couple of the shots are interactive states (a dropdown open, the
    // archive list showing) that no plain overlay switch can reach, so those
    // ride in as their own DOM events the components listen for.
    window.wisp.on('shot:overlay', (name) => {
      const overlay = name as string
      if (overlay === 'search-run') get().requestSearch('mycorrhizal networks')
      else if (overlay === 'address-suggest') {
        // fire a few times: the first can land while the boot splash still
        // owns focus, so a couple of follow-ups make sure the field keeps it
        const fire = (): void => {
          window.dispatchEvent(new CustomEvent('wisp:demo-address', { detail: 'mycorrhiz' }))
        }
        fire()
        setTimeout(fire, 800)
        setTimeout(fire, 1600)
      } else if (overlay === 'archive') {
        window.dispatchEvent(new CustomEvent('wisp:demo-archive'))
      } else if (overlay && overlay !== 'none') get().setOverlay(overlay as Overlay)
    })
    const boot = await invoke<{ config: WispConfig; rooms: RoomMeta[]; activeRoomId: string }>(
      'app:init'
    )
    set({ ready: true, config: boot.config, rooms: boot.rooms, activeRoomId: boot.activeRoomId })
    const state = await invoke<TabsState>('tabs:state')
    set({ tabs: state.tabs, activeTabId: state.activeTabId })
    const bg = await invoke<string | null>('bg:get')
    set({ backgroundUrl: bg })
    await get().refreshRoomData()
  },

  refreshRoomData: async (roomId) => {
    const id = roomId ?? get().activeRoomId
    if (!id) return
    const data = await invoke<RoomData | null>('rooms:data', id)
    if (data && get().activeRoomId === id) {
      set({ sources: data.sources, notes: data.notes, map: data.map })
    }
  },

  pendingSearch: null,
  pendingNoteId: null,

  setOverlay: (overlay) => {
    set({ overlay })
    void invoke('viewport:visible', overlay === 'none')
  },

  requestSearch: (query) => {
    set({ pendingSearch: query })
    get().setOverlay('search')
  },

  consumePendingSearch: () => {
    const q = get().pendingSearch
    if (q !== null) set({ pendingSearch: null })
    return q
  },

  requestNote: (noteId) => {
    set({ pendingNoteId: noteId })
    get().setOverlay('notes')
  },

  consumePendingNote: () => {
    const id = get().pendingNoteId
    if (id !== null) set({ pendingNoteId: null })
    return id
  },

  setConfig: async (patch) => {
    const config = await invoke<WispConfig>('config:set', patch)
    set({ config })
  },

  createRoom: async (name) => {
    await invoke('rooms:create', name)
    const rooms = await invoke<RoomMeta[]>('rooms:list')
    const created = rooms.find((r) => r.name === name)
    set({ rooms, activeRoomId: created?.id ?? rooms[rooms.length - 1]?.id, overlay: 'none' })
    void invoke('viewport:visible', true)
  },

  deleteRoom: async (id) => {
    const res = await invoke<{ rooms: RoomMeta[]; activeRoomId: string }>('rooms:delete', id)
    set({ rooms: res.rooms, activeRoomId: res.activeRoomId })
  },

  renameRoom: async (id, name) => {
    await invoke('rooms:rename', id, name)
    set({ rooms: await invoke<RoomMeta[]>('rooms:list') })
  },

  setRoomColor: async (id, color) => {
    await invoke('rooms:color', id, color)
    set({ rooms: await invoke<RoomMeta[]>('rooms:list') })
  },

  archiveRoom: async (id) => {
    const res = await invoke<{ rooms: RoomMeta[]; activeRoomId: string }>('rooms:archive', id)
    set({ rooms: res.rooms, activeRoomId: res.activeRoomId })
    await get().refreshRoomData(res.activeRoomId)
  },

  restoreRoom: async (id) => {
    const res = await invoke<{ rooms: RoomMeta[]; activeRoomId: string }>('rooms:restore', id)
    set({ rooms: res.rooms, activeRoomId: res.activeRoomId, overlay: 'none' })
    void invoke('viewport:visible', true)
    await get().refreshRoomData(id)
  },

  switchRoom: async (id) => {
    if (get().activeRoomId === id) return
    await invoke('rooms:switch', id)
    set({ activeRoomId: id, overlay: 'none' })
    void invoke('viewport:visible', true)
    await get().refreshRoomData(id)
  },

  pinTab: async (url, title, favicon) => {
    const roomId = get().activeRoomId
    if (!roomId) return
    await invoke('rooms:pin', roomId, { url, title, favicon })
    set({ rooms: await invoke<RoomMeta[]>('rooms:list') })
  },

  unpinTab: async (url) => {
    const roomId = get().activeRoomId
    if (!roomId) return
    await invoke('rooms:unpin', roomId, url)
    set({ rooms: await invoke<RoomMeta[]>('rooms:list') })
  },

  addEssential: async (url, title, favicon) => {
    if (!url) return
    const current = get().config?.essentials ?? []
    if (current.some((e) => e.url === url)) return
    await get().setConfig({ essentials: [...current, { url, title, favicon }] })
  },

  removeEssential: async (url) => {
    const current = get().config?.essentials ?? []
    await get().setConfig({ essentials: current.filter((e) => e.url !== url) })
  },

  excludeEssentialFromRoom: async (url, roomId) => {
    const current = get().config?.essentials ?? []
    await get().setConfig({
      essentials: current.map((e) =>
        e.url === url
          ? { ...e, excludedRooms: [...new Set([...(e.excludedRooms ?? []), roomId])] }
          : e
      )
    })
  },

  placeRailItem: async (id, location) => {
    const current = get().config?.railPlacement ?? {}
    if (current[id] === location) return
    await get().setConfig({ railPlacement: { ...current, [id]: location } })
  },

  newTab: (url, background) => void invoke('tabs:new', url ?? 'about:blank', background ?? false),
  closeTab: (id) => void invoke('tabs:close', id),
  activateTab: (id) => void invoke('tabs:activate', id),
  navigate: (id, url) => void invoke('tabs:navigate', id, url),
  reorderTabs: (ids) => {
    const roomId = get().activeRoomId
    if (roomId) void invoke('tabs:reorder', roomId, ids)
  }
}))

/** Bound to the current config language; falls back to Turkish until config loads. */
export function useT(): (key: TKey, vars?: Record<string, string | number>) => string {
  const lang = useApp((s) => s.config?.language ?? 'tr')
  return (key, vars) => translate(lang, key, vars)
}
