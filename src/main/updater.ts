// Wisp — © Shawy404. All rights reserved.
import { ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { WispContext } from './ipc'

const { autoUpdater } = electronUpdater

/**
 * Auto-update against GitHub releases (electron-updater reads the `publish`
 * block in electron-builder.yml). Full support is Windows/NSIS: a new release
 * downloads in the background and installs on the next quit. The renderer gets
 * status events and drives a small "update ready — restart" banner; the user
 * always chooses when to restart. Nothing installs silently.
 */
export function registerUpdater(ctx: WispContext): void {
  const send = (channel: string, payload?: unknown): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send(channel, payload)
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => send('update:available', { version: info.version }))
  autoUpdater.on('update-downloaded', (info) => send('update:ready', { version: info.version }))
  autoUpdater.on('error', () => {
    /* offline / no releases yet / dev build — silent, updates are optional */
  })

  // Restart into the freshly downloaded version (the banner's button).
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall())
  // Manual check from Settings; returns whether one is being downloaded.
  ipcMain.handle('update:check', async () => {
    try {
      const res = await autoUpdater.checkForUpdates()
      return { updateAvailable: !!res?.updateInfo && res.updateInfo.version !== autoUpdater.currentVersion.version }
    } catch {
      return { updateAvailable: false }
    }
  })

  // Check shortly after launch, then hourly — but never in dev.
  const startChecks = (): void => {
    void autoUpdater.checkForUpdates().catch(() => {})
    setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000)
  }
  if (!process.env.ELECTRON_RENDERER_URL && !process.env.WISP_SMOKE) {
    setTimeout(startChecks, 8000)
  }
}

export type UpdaterWin = BrowserWindow
