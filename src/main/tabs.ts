// Wisp. © Shawy404, MIT.
import { join } from 'path'
import { BrowserWindow, WebContentsView, type Input } from 'electron'
import type { MediaState, TabInfo } from '@shared/types'
import { WEB_PARTITION, isSafeTabUrl, openExternalSafe } from './security'

interface TabEntry {
  id: string
  roomId: string
  url: string
  title: string
  favicon?: string
  /** null while the tab sleeps — recreated (and reloaded) on activation. */
  view: WebContentsView | null
  lastActiveAt: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

let nextTabId = 1

/** Background tabs unload after this long to free memory; waking reloads them. */
const DEFAULT_SLEEP_MINUTES = 20
const SLEEP_CHECK_MS = 60 * 1000

/**
 * App shortcuts that must work even while a web page has key focus. The page
 * never sees these; they're forwarded to the shell renderer as names.
 */
function shortcutFor(input: Input): string | null {
  if (input.type !== 'keyDown') return null
  // F5 reloads even without a modifier, and works while a page has key focus.
  if (input.key === 'F5' && !input.control && !input.alt && !input.meta) return 'reload'
  if (!input.control || input.alt || input.meta) return null
  const key = input.key.toLowerCase()
  if (key === 'r') return 'reload'
  if (key === 'tab') return input.shift ? 'prev-tab' : 'next-tab'
  if (input.shift) return key === 'f' ? 'room-search' : null
  if (key === 't') return 'palette-toggle'
  if (key === 'l') return 'address'
  if (key === 'w') return 'close-tab'
  if (key === 'h') return 'history'
  if (key === 'f') return 'find'
  if (key === '/') return 'shortcuts'
  if (/^[1-9]$/.test(key)) return `tab-${key}`
  return null
}

/**
 * Owns every WebContentsView. Each room has its own ordered tab list; only the
 * active room's active tab is attached to the window. Switching rooms swaps
 * which set of tabs is live — inactive rooms keep their views in memory so a
 * switch back is instant (until the sleep timer unloads long-idle ones).
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
  /** Tab ids currently shown side by side in split view (0, 1 or 2). */
  private splitTabs: string[] = []
  /** How long a background tab may idle before unloading; 0 disables sleeping. */
  private sleepAfterMs = DEFAULT_SLEEP_MINUTES * 60 * 1000
  /** Called whenever a room's tab set changes, for persistence. */
  onPersist: (roomId: string, urls: string[], activeIndex: number) => void = () => {}
  /** Called on navigation and title/favicon updates, for the room's history. */
  onVisit: (roomId: string, visit: { url: string; title: string; favicon?: string }) => void =
    () => {}
  /** Hooks for attaching per-tab behaviour (context menus, zapper…) to new views. */
  viewHooks: ((view: WebContentsView, tabId: string) => void)[] = []
  /** Fired when some tab starts/stops playing audio (sidebar music widget). */
  onMediaChange: () => void = () => {}
  /** The tab that most recently played audio — the widget's target. */
  private lastMediaTab: string | null = null

  constructor(win: BrowserWindow) {
    this.win = win
    const timer = setInterval(() => this.sleepIdleTabs(), SLEEP_CHECK_MS)
    win.once('closed', () => clearInterval(timer))
  }

  /** Switch the window to a room, restoring persisted tabs on first visit. */
  setRoom(roomId: string, persistedUrls: string[], persistedActiveIndex: number): void {
    if (this.currentRoom === roomId) return
    this.clearSplit()
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
    const entry: TabEntry = { id, roomId, url, title: url, view: null, lastActiveAt: Date.now() }
    this.tabs.set(id, entry)
    this.createView(entry)
    if (!this.order.has(roomId)) {
      this.order.set(roomId, [])
      this.active.set(roomId, null)
      this.loadedRooms.add(roomId)
    }
    this.order.get(roomId)!.push(id)
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
    if (!isSafeTabUrl(url)) return
    const entry = this.tabs.get(id)
    if (!entry) return
    entry.url = url
    this.wake(entry)
    entry.view?.webContents.loadURL(url).catch(() => {})
  }

  goBack(id: string): void {
    const wc = this.tabs.get(id)?.view?.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward(id: string): void {
    const wc = this.tabs.get(id)?.view?.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(id: string): void {
    const entry = this.tabs.get(id)
    if (!entry) return
    if (!entry.view) {
      this.wake(entry)
      return
    }
    entry.view.webContents.reload()
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    // Split mode owns view placement; don't let the normal single-view bounds
    // yank a pane back to full size.
    if (this.splitTabs.length) return
    const view = this.activeView()
    if (view && this.visible) view.setBounds(this.bounds)
  }

  /** Hide the web view while a UI overlay (map, notes, palette…) is open. */
  setVisible(visible: boolean): void {
    this.visible = visible
    if (this.splitTabs.length) return
    const view = this.activeView()
    if (!view) return
    view.setVisible(visible)
    if (visible) view.setBounds(this.bounds)
  }

  /**
   * Split view: show one or two tabs side by side, each at its own rect. Passing
   * an empty list returns to the normal single active view. This is the only
   * place two web views are attached at once, so both live pages are real and
   * interactive — not screenshots.
   */
  setSplit(panes: { tabId: string; rect: Bounds }[]): void {
    this.clearSplit()
    if (panes.length === 0) {
      this.attachActive()
      const view = this.activeView()
      if (view) view.setVisible(this.visible)
      return
    }
    // Take the normal active view off-screen; the panes below drive placement.
    this.detachCurrent()
    const round = (b: Bounds): Bounds => ({
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.round(b.width),
      height: Math.round(b.height)
    })
    for (const p of panes) {
      const entry = this.tabs.get(p.tabId)
      if (!entry) continue
      if (!entry.view) this.createView(entry)
      if (!entry.view) continue
      entry.lastActiveAt = Date.now()
      this.win.contentView.addChildView(entry.view)
      entry.view.setBounds(round(p.rect))
      entry.view.setVisible(true)
      this.splitTabs.push(p.tabId)
    }
    this.broadcast()
  }

  private clearSplit(): void {
    for (const id of this.splitTabs) {
      const view = this.tabs.get(id)?.view
      if (view) {
        try {
          this.win.contentView.removeChildView(view)
        } catch {
          /* not attached */
        }
      }
    }
    this.splitTabs = []
  }

  activeTabId(): string | null {
    return this.currentRoom ? (this.active.get(this.currentRoom) ?? null) : null
  }

  activeView(): WebContentsView | null {
    const id = this.activeTabId()
    return id ? (this.tabs.get(id)?.view ?? null) : null
  }

  getTab(id: string): { url: string; title: string; view: WebContentsView | null } | null {
    const e = this.tabs.get(id)
    return e ? { url: e.url, title: e.title, view: e.view } : null
  }

  /**
   * Is this page's view sitting against the window's left edge? Used to reject
   * "pointer at my left edge" reports from a split pane that's mid-window (a
   * right pane), so only a genuinely leftmost page reveals the compact sidebar.
   */
  viewAtWindowLeft(wc: Electron.WebContents): boolean {
    for (const entry of this.tabs.values()) {
      if (entry.view?.webContents === wc) {
        try {
          return entry.view.getBounds().x <= 24
        } catch {
          return false
        }
      }
    }
    return false
  }

  currentRoomId(): string | null {
    return this.currentRoom
  }

  /** What's playing (or paused) in the most recent media tab, if any. */
  mediaState(): MediaState | null {
    // Prefer whatever is audible right now; fall back to the last media tab
    // (paused media can be resumed from the widget).
    for (const entry of this.tabs.values()) {
      if (entry.view?.webContents.isCurrentlyAudible()) {
        this.lastMediaTab = entry.id
        return { tabId: entry.id, title: entry.title, playing: true }
      }
    }
    const last = this.lastMediaTab ? this.tabs.get(this.lastMediaTab) : null
    if (!last?.view) return null
    return { tabId: last.id, title: last.title, playing: false }
  }

  /** Unload every background tab right now (the RAM widget's broom). */
  sleepBackgroundNow(): number {
    return this.sleepIdleTabs(true)
  }

  /** Settings-driven idle timeout (minutes); 0 = never sleep automatically. */
  setSleepMinutes(minutes: number): void {
    this.sleepAfterMs = Math.max(0, minutes) * 60 * 1000
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
        canGoBack: e.view?.webContents.navigationHistory.canGoBack() ?? false,
        canGoForward: e.view?.webContents.navigationHistory.canGoForward() ?? false,
        isLoading: e.view?.webContents.isLoading() ?? false,
        asleep: e.view === null
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

  /** Build (or rebuild, after sleep) the native view for a tab entry. */
  private createView(entry: TabEntry): void {
    // Pages live in their own persisted partition, isolated from the UI session.
    // The web preload only watches for password-form submits (vault offers).
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: WEB_PARTITION,
        preload: join(__dirname, '../preload/web.js')
      }
    })
    // Match the rounded corners of the renderer's viewport card.
    if (typeof view.setBorderRadius === 'function') view.setBorderRadius(12)
    // Enable trackpad pinch-to-zoom: Chromium's visual zoom magnifies the page
    // smoothly, anchored to the pinch point, without reflowing the layout.
    view.webContents.setVisualZoomLevelLimits(1, 4).catch(() => {})
    entry.view = view
    this.wireEvents(entry)
    for (const hook of this.viewHooks) hook(view, entry.id)
    if (entry.url && entry.url !== 'about:blank' && isSafeTabUrl(entry.url)) {
      view.webContents.loadURL(entry.url).catch(() => {})
    }
  }

  private wake(entry: TabEntry): void {
    if (entry.view) return
    this.createView(entry)
    this.broadcast()
  }

  /** Unload long-idle background tabs. The active tab of the current room —
   *  and anything playing audio — is never touched. */
  private sleepIdleTabs(force = false): number {
    const now = Date.now()
    const activeId = this.activeTabId()
    let slept = 0
    for (const entry of this.tabs.values()) {
      if (!entry.view || entry.id === activeId || this.splitTabs.includes(entry.id)) continue
      if (!force && (this.sleepAfterMs === 0 || now - entry.lastActiveAt < this.sleepAfterMs)) continue
      const wc = entry.view.webContents
      if (wc.isCurrentlyAudible()) continue
      // Keep the freshest url/title before dropping the contents.
      entry.url = wc.getURL() || entry.url
      entry.title = wc.getTitle() || entry.title
      try {
        this.win.contentView.removeChildView(entry.view)
      } catch {
        /* not attached */
      }
      wc.close()
      entry.view = null
      slept++
    }
    if (slept > 0) this.broadcast()
    return slept
  }

  private destroyTab(id: string): void {
    const entry = this.tabs.get(id)
    if (!entry) return
    this.splitTabs = this.splitTabs.filter((t) => t !== id)
    if (entry.view) {
      try {
        this.win.contentView.removeChildView(entry.view)
      } catch {
        /* not attached */
      }
      entry.view.webContents.close()
    }
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
    const id = this.activeTabId()
    const entry = id ? this.tabs.get(id) : null
    if (!entry) return
    entry.lastActiveAt = Date.now()
    if (!entry.view) this.wake(entry)
    if (!entry.view) return
    this.win.contentView.addChildView(entry.view)
    entry.view.setBounds(this.bounds)
    entry.view.setVisible(this.visible)
  }

  private wireEvents(entry: TabEntry): void {
    const wc = entry.view!.webContents
    const sync = (): void => {
      entry.url = wc.getURL() || entry.url
      entry.title = wc.getTitle() || entry.title
      this.broadcast()
    }
    const visit = (): void => {
      const url = wc.getURL()
      if (/^https?:/i.test(url)) {
        this.onVisit(entry.roomId, { url, title: wc.getTitle() || url, favicon: entry.favicon })
      }
    }
    wc.on('did-navigate', () => {
      sync()
      this.persist(entry.roomId)
      visit()
    })
    wc.on('did-navigate-in-page', () => {
      sync()
      visit()
    })
    wc.on('page-title-updated', () => {
      sync()
      visit()
    })
    wc.on('did-start-loading', () => this.broadcast())
    wc.on('did-stop-loading', () => this.broadcast())
    wc.on('media-started-playing', () => {
      this.lastMediaTab = entry.id
      this.onMediaChange()
    })
    wc.on('media-paused', () => this.onMediaChange())
    wc.on('page-favicon-updated', (_e, favicons) => {
      entry.favicon = favicons[0]
      this.broadcast()
      visit()
    })
    // App shortcuts fire even while the page has key focus.
    wc.on('before-input-event', (event, input) => {
      const name = shortcutFor(input)
      if (name) {
        event.preventDefault()
        if (!this.win.isDestroyed()) this.win.webContents.send('shortcut', name)
      }
    })
    wc.setWindowOpenHandler(({ url }) => {
      if (isSafeTabUrl(url)) this.openTab(entry.roomId, url, true)
      else openExternalSafe(url)
      return { action: 'deny' }
    })
  }
}
