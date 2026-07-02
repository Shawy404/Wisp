// Wisp — © Shawy404. All rights reserved.
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

// Wayland/Hyprland friendliness: let Chromium pick the native platform.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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
  if (process.platform !== 'darwin') app.quit()
})
