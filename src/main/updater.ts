// Wisp. © Shawy404, MIT.
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
 * block in electron-builder.yml). Nothing installs silently and nothing pops
 * an installer window in the user's face: a new release is only *announced* in
 * the background. The renderer's update banner then drives the whole flow —
 * download on demand, with a live progress bar shown inside the app, and a
 * silent install + relaunch when the user chooses to restart. Full install
 * support is Windows/NSIS; on Linux the check works and points at the release.
 */
export function registerUpdater(ctx: WispContext): void {
  const send = (channel: string, payload?: unknown): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send(channel, payload)
  }
  const autoEnabled = (): boolean => ctx.config.autoUpdate !== false

  // Never pull bytes on our own — the in-app menu asks first. And never run the
  // installer on quit; the user triggers the (silent) install explicitly.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) =>
    send('update:available', { version: info.version, notes: notesToText(info.releaseNotes) })
  )
  autoUpdater.on('download-progress', (p) =>
    send('update:progress', { percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond })
  )
  autoUpdater.on('update-downloaded', (info) =>
    send('update:ready', { version: info.version, notes: notesToText(info.releaseNotes) })
  )
  autoUpdater.on('error', (err) => {
    // Offline / no releases yet / dev build — surface it to the banner so a
    // user-initiated download can show "failed" instead of hanging forever.
    send('update:error', { message: err instanceof Error ? err.message : String(err) })
  })

  // Start the on-demand download (the banner's "Download" button). Progress
  // streams over update:progress; completion fires update:ready.
  ipcMain.handle('update:download', () => {
    autoUpdater.downloadUpdate().catch((err) =>
      send('update:error', { message: err instanceof Error ? err.message : String(err) })
    )
  })

  // Install the downloaded update and relaunch. isSilent + isForceRunAfter so
  // no NSIS wizard window appears — the app just closes and reopens updated.
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall(true, true))

  // Manual check from Settings; returns whether one is available (download is
  // still user-driven, so this never pulls bytes by itself).
  ipcMain.handle('update:check', async () => {
    try {
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
    }
  })

  // Check shortly after launch, then hourly — but never in dev, and only while
  // the setting is on. This only *announces*; the download waits for the user.
  const check = (): void => {
    if (!autoEnabled()) return
    void autoUpdater.checkForUpdates().catch(() => {})
  }
  if (!process.env.ELECTRON_RENDERER_URL && !process.env.WISP_SMOKE) {
    setTimeout(check, 8000)
    setInterval(check, 60 * 60 * 1000)
  }
}

export type UpdaterWin = BrowserWindow
