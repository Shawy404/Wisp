// Wisp — © Shawy404. All rights reserved.
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { loadConfig } from './storage'
import { TabManager } from './tabs'
import { registerCoreIpc, type WispContext } from './ipc'
import { registerSearchIpc } from './search-ipc'
import { registerReaderIpc } from './reader'
import { registerClip } from './clip'
import { registerNotesIpc } from './notes-ipc'
import { registerMapIpc } from './map-ipc'
import { registerZapper } from './zapper'
import { registerTooltip } from './tooltip'
import { registerBackground } from './background'
import { registerHistory } from './history'
import { initAdblock } from './adblock'
import { hardenApp, openExternalSafe, webSession } from './security'

// Wayland/Hyprland friendliness: let Chromium pick the native platform.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')

// Real window transparency on Linux/X11 silently fails without this switch
// (the window just stays black/opaque). Harmless on Wayland, so gate it only
// on the setting — it must be set before the app is ready.
if (loadConfig().windowTransparent) {
  app.commandLine.appendSwitch('enable-transparent-visuals')
}

let ctx: WispContext | null = null

function createWindow(): void {
  const config = loadConfig()
  // Real compositor transparency (Zen-style glass): the window itself has no
  // background, so the desktop shows through the shell. Hyprland blur rules
  // make it frosted. Needs to be decided at window creation → restart to flip.
  const transparent = config.windowTransparent === true
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    transparent,
    backgroundColor: transparent ? '#00000000' : '#0e0e12',
    icon: join(__dirname, '../../build/icon.png'),
    // Frameless with in-app window controls; tiling WMs (Hyprland) manage
    // geometry themselves so no server-side decorations are needed.
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url)
    return { action: 'deny' }
  })

  ctx = { win, tabs: new TabManager(win), config }
  registerCoreIpc(ctx)
  registerSearchIpc(ctx)
  registerReaderIpc(ctx)
  registerClip(ctx)
  registerNotesIpc(ctx)
  registerMapIpc(ctx)
  registerZapper(ctx)
  registerTooltip(ctx)
  registerBackground(ctx)
  registerHistory(ctx)
  void initAdblock(ctx.config)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// A second launch focuses the existing window instead of a second instance
// fighting over ~/Wisp state.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = ctx?.win
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    hardenApp(
      (wc) => wc === ctx?.win.webContents,
      () => ctx?.win ?? null,
      () => ctx?.config ?? loadConfig()
    )
    createWindow()

    if (process.env.WISP_SMOKE) {
      console.log('WISP_READY')
      setTimeout(() => app.quit(), 2500)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Chromium writes cookies lazily; force a flush on quit so logins survive
  // even when the app is closed right after signing in somewhere.
  app.on('before-quit', () => {
    try {
      webSession().flushStorageData()
    } catch {
      /* session may not exist yet */
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
