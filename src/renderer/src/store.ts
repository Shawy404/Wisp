// Wisp — © Shawy404. All rights reserved.
import { create } from 'zustand'
import type { MapData, NoteInfo, RoomData, RoomMeta, SourceItem, TabInfo, WispConfig } from '@shared/types'
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

  init: () => Promise<void>
  refreshRoomData: (roomId?: string) => Promise<void>
  setOverlay: (overlay: Overlay) => void
  setConfig: (patch: Partial<WispConfig>) => Promise<void>

  createRoom: (name: string) => Promise<void>
  deleteRoom: (id: string) => Promise<void>
  renameRoom: (id: string, name: string) => Promise<void>
  switchRoom: (id: string) => Promise<void>
  pinTab: (url: string, title: string, favicon?: string) => Promise<void>
  unpinTab: (url: string) => Promise<void>

  newTab: (url?: string) => void
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

  init: async () => {
    window.wisp.on('tabs:state', (state) => {
      const s = state as TabsState
      set({ tabs: s.tabs, activeTabId: s.activeTabId })
    })
    window.wisp.on('room:updated', (roomId) => {
      if (roomId === get().activeRoomId) void get().refreshRoomData()
    })
    const boot = await invoke<{ config: WispConfig; rooms: RoomMeta[]; activeRoomId: string }>(
      'app:init'
    )
    set({ ready: true, config: boot.config, rooms: boot.rooms, activeRoomId: boot.activeRoomId })
    const state = await invoke<TabsState>('tabs:state')
    set({ tabs: state.tabs, activeTabId: state.activeTabId })
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

  setOverlay: (overlay) => {
    set({ overlay })
    void invoke('viewport:visible', overlay === 'none')
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

  newTab: (url) => void invoke('tabs:new', url ?? 'about:blank'),
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
