// Wisp — © Shawy404. All rights reserved.
import { ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { WispContext } from './ipc'

const { autoUpdater } = electronUpdater

/** GitHub release bodies arrive as a string or as per-version note objects. */
function notesToText(notes: unknown): string {
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    return notes
      .map((n) => (typeof n === 'string' ? n : `${n.version}\n${n.note ?? ''}`))
      .join('\n\n')
  }
  return ''
}

/**
 * Auto-update against GitHub releases (electron-updater reads the `publish`
 * block in electron-builder.yml). Full support is Windows/NSIS: a new release
 * downloads in the background and installs on the next quit. The renderer gets
 * status events (version + release notes) and drives the update banner; the
 * user always chooses when to restart. Nothing installs silently. Background
 * checks respect the `autoUpdate` setting; the manual check in Settings works
 * regardless.
 */
export function registerUpdater(ctx: WispContext): void {
  const send = (channel: string, payload?: unknown): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send(channel, payload)
  }
  const autoEnabled = (): boolean => ctx.config.autoUpdate !== false

  autoUpdater.autoDownload = autoEnabled()
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) =>
    send('update:available', { version: info.version, notes: notesToText(info.releaseNotes) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    send('update:ready', { version: info.version, notes: notesToText(info.releaseNotes) })
  )
  autoUpdater.on('error', () => {
    /* offline / no releases yet / dev build — silent, updates are optional */
  })

  // Restart into the freshly downloaded version (the banner's button).
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall())
  // Manual check from Settings; the user asked, so download even if the
  // background auto-update toggle is off.
  ipcMain.handle('update:check', async () => {
    try {
      autoUpdater.autoDownload = true
      const res = await autoUpdater.checkForUpdates()
      const updateAvailable =
        !!res?.updateInfo && res.updateInfo.version !== autoUpdater.currentVersion.version
      return {
        updateAvailable,
        version: res?.updateInfo?.version,
        notes: updateAvailable ? notesToText(res?.updateInfo?.releaseNotes) : ''
      }
    } catch {
      return { updateAvailable: false }
    } finally {
      autoUpdater.autoDownload = autoEnabled()
    }
  })

  // Check shortly after launch, then hourly — but never in dev, and only
  // while the setting is on (flipping it takes effect on the next tick).
  const check = (): void => {
    if (!autoEnabled()) return
    autoUpdater.autoDownload = true
    void autoUpdater.checkForUpdates().catch(() => {})
  }
  if (!process.env.ELECTRON_RENDERER_URL && !process.env.WISP_SMOKE) {
    setTimeout(check, 8000)
    setInterval(check, 60 * 60 * 1000)
  }
}

export type UpdaterWin = BrowserWindow
