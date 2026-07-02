// Wisp — © Shawy404. All rights reserved.
import { BrowserWindow, ipcMain } from 'electron'
import type { RoomMeta, WispConfig } from '@shared/types'
import * as store from './storage'
import { TabManager } from './tabs'

export interface WispContext {
  win: BrowserWindow
  tabs: TabManager
  config: WispConfig
}

/** Registers every phase-1 IPC channel: app boot, config, rooms, tabs, window. */
export function registerCoreIpc(ctx: WispContext): void {
  const { win, tabs } = ctx

  tabs.onPersist = (roomId, urls, activeIndex) => {
    const meta = store.loadRoomMeta(roomId)
    if (!meta) return
    meta.tabs = urls
    meta.activeTabIndex = activeIndex
    store.saveRoomMeta(meta)
  }

  const switchRoom = (roomId: string): RoomMeta | null => {
    const meta = store.loadRoomMeta(roomId)
    if (!meta) return null
    tabs.setRoom(roomId, meta.tabs, meta.activeTabIndex)
    ctx.config.lastRoomId = roomId
    store.saveConfig(ctx.config)
    return meta
  }

  ipcMain.handle('app:init', () => {
    const rooms = store.ensureDefaultRoom()
    const roomId =
      ctx.config.lastRoomId && rooms.some((r) => r.id === ctx.config.lastRoomId)
        ? ctx.config.lastRoomId!
        : rooms[0].id
    switchRoom(roomId)
    return { config: ctx.config, rooms, activeRoomId: roomId }
  })

  ipcMain.handle('config:get', () => ctx.config)
  ipcMain.handle('config:set', (_e, patch: Partial<WispConfig>) => {
    ctx.config = { ...ctx.config, ...patch }
    store.saveConfig(ctx.config)
    return ctx.config
  })

  ipcMain.handle('rooms:list', () => store.listRooms())
  ipcMain.handle('rooms:create', (_e, name: string) => {
    const meta = store.createRoom(name)
    switchRoom(meta.id)
    return meta
  })
  ipcMain.handle('rooms:delete', (_e, id: string) => {
    tabs.closeRoom(id)
    store.deleteRoom(id)
    const rooms = store.ensureDefaultRoom()
    const next = rooms[0].id
    switchRoom(next)
    return { rooms, activeRoomId: next }
  })
  ipcMain.handle('rooms:rename', (_e, id: string, name: string) => store.renameRoom(id, name))
  ipcMain.handle('rooms:switch', (_e, id: string) => switchRoom(id))
  ipcMain.handle('rooms:data', (_e, id: string) => store.loadRoomData(id))

  ipcMain.handle('tabs:new', (_e, url: string) => {
    const roomId = tabs.currentRoomId()
    if (roomId) tabs.openTab(roomId, url || 'about:blank', true)
  })
  ipcMain.handle('tabs:close', (_e, id: string) => tabs.closeTab(id))
  ipcMain.handle('tabs:activate', (_e, id: string) => tabs.activateTab(id))
  ipcMain.handle('tabs:navigate', (_e, id: string, url: string) => tabs.navigate(id, url))
  ipcMain.handle('tabs:back', (_e, id: string) => tabs.goBack(id))
  ipcMain.handle('tabs:forward', (_e, id: string) => tabs.goForward(id))
  ipcMain.handle('tabs:reload', (_e, id: string) => tabs.reload(id))
  ipcMain.handle('tabs:reorder', (_e, roomId: string, ids: string[]) =>
    tabs.reorderTabs(roomId, ids)
  )
  ipcMain.handle('tabs:state', () => tabs.state())

  ipcMain.handle('viewport:bounds', (_e, b: { x: number; y: number; width: number; height: number }) => {
    tabs.setBounds({
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.round(b.width),
      height: Math.round(b.height)
    })
  })
  ipcMain.handle('viewport:visible', (_e, visible: boolean) => tabs.setVisible(visible))

  ipcMain.handle('window:minimize', () => win.minimize())
  ipcMain.handle('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.handle('window:close', () => win.close())
}
