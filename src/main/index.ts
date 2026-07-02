// Wisp — © Shawy404. All rights reserved.
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { loadConfig } from './storage'
import { TabManager } from './tabs'
import { registerCoreIpc, type WispContext } from './ipc'

// Wayland/Hyprland friendliness: let Chromium pick the native platform.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')

let ctx: WispContext | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e12',
    // Frameless with in-app window controls; tiling WMs (Hyprland) manage
    // geometry themselves so no server-side decorations are needed.
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  ctx = { win, tabs: new TabManager(win), config: loadConfig() }
  registerCoreIpc(ctx)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  if (process.env.WISP_SMOKE) {
    console.log('WISP_READY')
    setTimeout(() => app.quit(), 2500)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
