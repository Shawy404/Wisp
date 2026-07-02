// Wisp — © Shawy404. All rights reserved.
import { BrowserWindow, WebContentsView } from 'electron'
import type { TabInfo } from '@shared/types'

interface TabEntry {
  id: string
  roomId: string
  url: string
  title: string
  favicon?: string
  view: WebContentsView
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

let nextTabId = 1

/**
 * Owns every WebContentsView. Each room has its own ordered tab list; only the
 * active room's active tab is attached to the window. Switching rooms swaps
 * which set of tabs is live — inactive rooms keep their views in memory so a
 * switch back is instant.
 */
export class TabManager {
  private win: BrowserWindow
  private tabs = new Map<string, TabEntry>()
  private order = new Map<string, string[]>()
  private active = new Map<string, string | null>()
  private loadedRooms = new Set<string>()
  private currentRoom: string | null = null
  private bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 }
  private visible = true
  /** Called whenever a room's tab set changes, for persistence. */
  onPersist: (roomId: string, urls: string[], activeIndex: number) => void = () => {}
  /** Hook for attaching per-tab behaviour (e.g. context menus) to new views. */
  onViewCreated: (view: WebContentsView, tabId: string) => void = () => {}

  constructor(win: BrowserWindow) {
    this.win = win
  }

  /** Switch the window to a room, restoring persisted tabs on first visit. */
  setRoom(roomId: string, persistedUrls: string[], persistedActiveIndex: number): void {
    if (this.currentRoom === roomId) return
    this.detachCurrent()
    this.currentRoom = roomId
    if (!this.loadedRooms.has(roomId)) {
      this.loadedRooms.add(roomId)
      this.order.set(roomId, [])
      this.active.set(roomId, null)
      for (const url of persistedUrls) this.openTab(roomId, url, false, true)
      const ids = this.order.get(roomId)!
      const activeId = ids[Math.min(persistedActiveIndex, ids.length - 1)] ?? null
      this.active.set(roomId, activeId)
    }
    this.attachActive()
    this.broadcast()
  }

  closeRoom(roomId: string): void {
    for (const id of [...(this.order.get(roomId) ?? [])]) this.destroyTab(id)
    this.order.delete(roomId)
    this.active.delete(roomId)
    this.loadedRooms.delete(roomId)
    if (this.currentRoom === roomId) this.currentRoom = null
  }

  openTab(roomId: string, url: string, activate = true, silent = false): string {
    const id = `tab-${nextTabId++}`
    const view = new WebContentsView({
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    const entry: TabEntry = { id, roomId, url, title: url, view }
    // Match the rounded corners of the renderer's viewport card.
    if (typeof view.setBorderRadius === 'function') view.setBorderRadius(12)
    this.tabs.set(id, entry)
    if (!this.order.has(roomId)) {
      this.order.set(roomId, [])
      this.active.set(roomId, null)
      this.loadedRooms.add(roomId)
    }
    this.order.get(roomId)!.push(id)
    this.wireEvents(entry)
    this.onViewCreated(view, id)
    if (url && url !== 'about:blank') view.webContents.loadURL(url).catch(() => {})
    if (activate) this.activateTab(id)
    if (!silent) {
      this.broadcast()
      this.persist(roomId)
    }
    return id
  }

  closeTab(id: string): void {
    const entry = this.tabs.get(id)
    if (!entry) return
    const { roomId } = entry
    const ids = this.order.get(roomId)!
    const idx = ids.indexOf(id)
    this.destroyTab(id)
    if (this.active.get(roomId) === id) {
      const next = ids[Math.min(idx, ids.length - 1)] ?? null
      this.active.set(roomId, next)
      this.attachActive()
    }
    this.broadcast()
    this.persist(roomId)
  }

  activateTab(id: string): void {
    const entry = this.tabs.get(id)
    if (!entry) return
    this.detachCurrent()
    this.active.set(entry.roomId, id)
    if (entry.roomId === this.currentRoom || this.currentRoom === null) {
      this.currentRoom = entry.roomId
      this.attachActive()
    }
    this.broadcast()
    this.persist(entry.roomId)
  }

  reorderTabs(roomId: string, ids: string[]): void {
    const current = this.order.get(roomId)
    if (!current) return
    const valid = ids.filter((id) => current.includes(id))
    for (const id of current) if (!valid.includes(id)) valid.push(id)
    this.order.set(roomId, valid)
    this.broadcast()
    this.persist(roomId)
  }

  navigate(id: string, url: string): void {
    this.tabs.get(id)?.view.webContents.loadURL(url).catch(() => {})
  }

  goBack(id: string): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward(id: string): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(id: string): void {
    this.tabs.get(id)?.view.webContents.reload()
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    const view = this.activeView()
    if (view && this.visible) view.setBounds(this.bounds)
  }

  /** Hide the web view while a UI overlay (map, notes, palette…) is open. */
  setVisible(visible: boolean): void {
    this.visible = visible
    const view = this.activeView()
    if (!view) return
    view.setVisible(visible)
    if (visible) view.setBounds(this.bounds)
  }

  activeTabId(): string | null {
    return this.currentRoom ? (this.active.get(this.currentRoom) ?? null) : null
  }

  activeView(): WebContentsView | null {
    const id = this.activeTabId()
    return id ? (this.tabs.get(id)?.view ?? null) : null
  }

  getTab(id: string): { url: string; title: string; view: WebContentsView } | null {
    const e = this.tabs.get(id)
    return e ? { url: e.url, title: e.title, view: e.view } : null
  }

  currentRoomId(): string | null {
    return this.currentRoom
  }

  state(): { roomId: string | null; tabs: TabInfo[]; activeTabId: string | null } {
    const roomId = this.currentRoom
    const ids = roomId ? (this.order.get(roomId) ?? []) : []
    const tabs = ids
      .map((id) => this.tabs.get(id))
      .filter((e): e is TabEntry => !!e)
      .map((e) => ({
        id: e.id,
        roomId: e.roomId,
        url: e.url,
        title: e.title,
        favicon: e.favicon,
        canGoBack: e.view.webContents.navigationHistory.canGoBack(),
        canGoForward: e.view.webContents.navigationHistory.canGoForward(),
        isLoading: e.view.webContents.isLoading()
      }))
    return { roomId, tabs, activeTabId: roomId ? (this.active.get(roomId) ?? null) : null }
  }

  broadcast(): void {
    if (this.win.isDestroyed()) return
    this.win.webContents.send('tabs:state', this.state())
  }

  private persist(roomId: string): void {
    const ids = this.order.get(roomId) ?? []
    const urls = ids
      .map((id) => this.tabs.get(id)?.url ?? '')
      .filter((u) => u && u !== 'about:blank')
    const activeId = this.active.get(roomId)
    const activeIndex = Math.max(0, ids.indexOf(activeId ?? ''))
    this.onPersist(roomId, urls, activeIndex)
  }

  private destroyTab(id: string): void {
    const entry = this.tabs.get(id)
    if (!entry) return
    try {
      this.win.contentView.removeChildView(entry.view)
    } catch {
      /* not attached */
    }
    entry.view.webContents.close()
    this.tabs.delete(id)
    const ids = this.order.get(entry.roomId)
    if (ids) ids.splice(ids.indexOf(id), 1)
  }

  private detachCurrent(): void {
    const view = this.activeView()
    if (view) {
      try {
        this.win.contentView.removeChildView(view)
      } catch {
        /* not attached */
      }
    }
  }

  private attachActive(): void {
    const view = this.activeView()
    if (!view) return
    this.win.contentView.addChildView(view)
    view.setBounds(this.bounds)
    view.setVisible(this.visible)
  }

  private wireEvents(entry: TabEntry): void {
    const wc = entry.view.webContents
    const sync = (): void => {
      entry.url = wc.getURL() || entry.url
      entry.title = wc.getTitle() || entry.title
      this.broadcast()
    }
    wc.on('did-navigate', () => {
      sync()
      this.persist(entry.roomId)
    })
    wc.on('did-navigate-in-page', sync)
    wc.on('page-title-updated', sync)
    wc.on('did-start-loading', () => this.broadcast())
    wc.on('did-stop-loading', () => this.broadcast())
    wc.on('page-favicon-updated', (_e, favicons) => {
      entry.favicon = favicons[0]
      this.broadcast()
    })
    wc.setWindowOpenHandler(({ url }) => {
      this.openTab(entry.roomId, url, true)
      return { action: 'deny' }
    })
  }
}
