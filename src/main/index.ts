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
import { registerDownloads } from './downloads'
import { registerFind } from './find'
import { registerVideo } from './video'
import { registerVault } from './vault'
import { registerUpdater } from './updater'
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

  // Show on first paint — the renderer's static boot splash (index.html) is the
  // first thing drawn, so the window comes up already showing the animated wisp
  // rather than a blank frame. A fallback timer covers compositors where
  // ready-to-show fires late, so the window never stays hidden.
  win.on('ready-to-show', () => win.show())
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }, 1500)

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url)
    return { action: 'deny' }
  })

  // Sites should see a browser called Wisp, not "Electron/43": swap the
  // Electron token for Wisp and drop the lowercase package-name token.
  const ses = webSession()
  ses.setUserAgent(
    ses
      .getUserAgent()
      .replace(/ wisp\/[\d.a-z-]+/i, '')
      .replace(/Electron\/[\d.]+/, `Wisp/${app.getVersion()}`)
  )
  // Client hints are what most "which browser is this" checks read nowadays,
  // and Chromium only advertises its own brands there. Rewrite the header so
  // Wisp leads the brand list (Chromium stays for compatibility checks).
  const chromeMajor = process.versions.chrome.split('.')[0]
  const brandHeader =
    `"Wisp";v="${app.getVersion().split('-')[0]}", ` +
    `"Chromium";v="${chromeMajor}", "Not?A_Brand";v="99"`
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'sec-ch-ua') headers[key] = brandHeader
    }
    callback({ requestHeaders: headers })
  })

  ctx = { win, tabs: new TabManager(win), config }
  ctx.tabs.setSleepMinutes(config.tabSleepMinutes ?? 20)
  registerCoreIpc(ctx)
  registerSearchIpc(ctx)
  registerReaderIpc(ctx)
  registerClip(ctx)
  registerNotesIpc(ctx)
  registerMapIpc(ctx)
  registerZapper(ctx)
  registerTooltip(ctx)
  registerDownloads(ctx)
  registerFind(ctx)
  registerVideo(ctx)
  registerVault(() => ctx?.win ?? null)
  registerUpdater(ctx)
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

    // Dev tooling for README/store screenshots: WISP_SHOT="<overlay>:<file>"
    // boots, tells the renderer to open an overlay, captures the shell as a
    // PNG and quits. Not reachable in normal use.
    if (process.env.WISP_SHOT) {
      const [overlay, file] = process.env.WISP_SHOT.split(/:(.+)/)
      const wait = overlay === 'search-run' ? 12_000 : 3500
      setTimeout(() => {
        ctx?.win.webContents.send('shot:overlay', overlay)
        setTimeout(() => {
          void ctx?.win.webContents.capturePage().then((image) => {
            require('fs').writeFileSync(file, image.toPNG())
            app.quit()
          })
        }, wait)
      }, 3000)
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
