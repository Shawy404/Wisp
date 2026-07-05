// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { app, BrowserWindow, ipcMain } from 'electron'
import type { PinnedTab, RoomMeta, WispConfig } from '@shared/types'
import * as store from './storage'
import { TabManager } from './tabs'
import { getBlockedCount, setAdblock } from './adblock'

export interface WispContext {
  win: BrowserWindow
  tabs: TabManager
  config: WispConfig
}

/** Core IPC channels: app boot, config, rooms, tabs, viewport, window. */
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
    if ('adblock' in patch || 'adblockAllowlist' in patch) setAdblock(ctx.config)
    if ('tabSleepMinutes' in patch) tabs.setSleepMinutes(ctx.config.tabSleepMinutes ?? 20)
    return ctx.config
  })
  ipcMain.handle('app:version', () => app.getVersion())

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
  ipcMain.handle('rooms:pin', (_e, id: string, pin: PinnedTab) => {
    const meta = store.loadRoomMeta(id)
    if (!meta || !pin.url) return null
    if (!meta.pinned.some((p) => p.url === pin.url)) {
      meta.pinned.push(pin)
      store.saveRoomMeta(meta)
    }
    return meta
  })
  ipcMain.handle('rooms:unpin', (_e, id: string, url: string) => {
    const meta = store.loadRoomMeta(id)
    if (!meta) return null
    meta.pinned = meta.pinned.filter((p) => p.url !== url)
    store.saveRoomMeta(meta)
    return meta
  })
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

  ipcMain.handle('adblock:stats', () => ({ blocked: getBlockedCount() }))

  // ---- Sidebar widgets: what's playing, and how heavy the app is. ----
  tabs.onMediaChange = () => {
    if (!win.isDestroyed()) win.webContents.send('media:state', tabs.mediaState())
  }
  ipcMain.handle('media:state', () => tabs.mediaState())
  ipcMain.handle('media:toggle', async () => {
    const state = tabs.mediaState()
    if (!state) return
    const wc = tabs.getTab(state.tabId)?.view?.webContents
    if (!wc) return
    // Top-frame <audio>/<video> only — covers YouTube & friends.
    const js = state.playing
      ? 'document.querySelectorAll("audio,video").forEach(m => { if (!m.paused) m.pause() })'
      : 'document.querySelectorAll("audio,video").forEach(m => { if (m.paused && m.currentTime > 0) m.play().catch(() => {}) })'
    await wc.executeJavaScript(js, true).catch(() => {})
    tabs.onMediaChange()
  })
  ipcMain.handle('media:focus', () => {
    const state = tabs.mediaState()
    if (state) tabs.activateTab(state.tabId)
  })
  // One field out of /proc-style "Field:   1234 kB" files, in KB.
  const readProcKB = (file: string, field: string): number | null => {
    try {
      const m = new RegExp(`^${field}:\\s+(\\d+)`, 'm').exec(fs.readFileSync(file, 'utf8'))
      return m ? Number(m[1]) : null
    } catch {
      return null
    }
  }
  ipcMain.handle('stats:memory', () => {
    // workingSetSize counts shared pages once per process, so summing it over
    // the half-dozen Chromium processes overstates the app badly. PSS splits
    // shared pages fairly; fall back to WSS where /proc isn't available.
    let appBytes = 0
    for (const m of app.getAppMetrics()) {
      const pss =
        process.platform === 'linux' ? readProcKB(`/proc/${m.pid}/smaps_rollup`, 'Pss') : null
      appBytes += (pss ?? m.memory.workingSetSize) * 1024
    }
    // "free" excludes reclaimable page cache, which makes the system look far
    // fuller than it is — MemAvailable is the number `free -h` calls available.
    const sys = process.getSystemMemoryInfo()
    const availKB = readProcKB('/proc/meminfo', 'MemAvailable') ?? sys.free
    return { app: appBytes, sysUsed: (sys.total - availKB) * 1024, sysTotal: sys.total * 1024 }
  })
  ipcMain.handle('tabs:freeMemory', () => tabs.sleepBackgroundNow())

  ipcMain.handle('viewport:bounds', (_e, b: { x: number; y: number; width: number; height: number }) => {
    tabs.setBounds({
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.round(b.width),
      height: Math.round(b.height)
    })
  })
  ipcMain.handle('viewport:visible', (_e, visible: boolean) => tabs.setVisible(visible))

  // A page's preload reports when the pointer nears the left edge; relay it to
  // the shell so compact mode can reveal the sidebar even over a live page.
  // Ignore "near" reports from a page that isn't actually at the window's left
  // (e.g. the right split pane, whose left edge is mid-window at the divider).
  ipcMain.on('shell:edge-left', (e, near: boolean) => {
    if (near && !tabs.viewAtWindowLeft(e.sender)) return
    if (!win.isDestroyed()) win.webContents.send('shell:edge-left', near)
  })

  // Split view: show one or two live tabs side by side at the given rects.
  ipcMain.handle(
    'split:show',
    (_e, panes: { tabId: string; rect: { x: number; y: number; width: number; height: number } }[]) =>
      tabs.setSplit(panes)
  )
  ipcMain.handle('split:hide', () => tabs.setSplit([]))

  // Web-dev mode: open DevTools for the active tab's page (detached window).
  ipcMain.handle('tabs:devtools', () => {
    ctx.tabs.activeView()?.webContents.openDevTools({ mode: 'detach' })
  })

  // Window transparency is fixed at window creation, so flipping it needs a
  // full relaunch — the settings panel offers this right after the toggle.
  ipcMain.handle('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle('window:minimize', () => win.minimize())
  ipcMain.handle('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.handle('window:close', () => win.close())
}
