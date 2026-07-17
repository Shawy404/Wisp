// Wisp. © Shawy404, MIT.
import { ipcMain, dialog, nativeImage } from 'electron'
import * as fs from 'fs'
import { createHash } from 'crypto'
import { join, extname } from 'path'
import { wispRoot, saveConfig } from './storage'
import type { WispContext } from './ipc'

/**
 * Custom background images. A picked file is copied into ~/Wisp/backgrounds so
 * it survives and stays local, then served to the sandboxed renderer as a data
 * URL (the renderer can't read arbitrary files itself). The default background
 * is the app's own icon as a faint watermark.
 */
const bgDir = (): string => join(wispRoot(), 'backgrounds')
const iconDir = (): string => join(wispRoot(), 'icons')

function dataUrlFor(file: string): string | null {
  try {
    const buf = fs.readFileSync(file)
    const ext = extname(file).slice(1).toLowerCase()
    const mime =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Copy a picked image into a wisp dir, named after its content hash. Pick the
 * same photo five times, get one file. (i had 9 copies of the same wallpaper
 * before this. nine.)
 */
function importImage(dir: string, sourcePath: string, prefix: string): string | null {
  try {
    const buf = fs.readFileSync(sourcePath)
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12)
    const name = `${prefix}-${hash}${extname(sourcePath).toLowerCase()}`
    fs.mkdirSync(dir, { recursive: true })
    const dest = join(dir, name)
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf)
    return name
  } catch {
    return null
  }
}

function currentBackground(ctx: WispContext): string | null {
  const bg = ctx.config.backgroundImage
  // the old mascot watermark mode ('icon') is gone. old configs may still say
  // 'icon'; they just mean "no background" now.
  if (!bg || bg === 'none' || bg === 'icon') return null
  return dataUrlFor(join(bgDir(), bg))
}

/** The custom app icon's absolute path, or null when using the built-in one. */
export function customIconPath(config: { appIcon?: string }): string | null {
  if (!config.appIcon || config.appIcon.includes('/') || config.appIcon.includes('..')) return null
  // configs from before the png/jpeg-only rule may still point at a webp,
  // which nativeImage can't decode — fall back to the built-in icon.
  if (config.appIcon.endsWith('.webp')) return null
  const file = join(iconDir(), config.appIcon)
  return fs.existsSync(file) ? file : null
}

export function registerBackground(ctx: WispContext): void {
  ipcMain.handle('bg:get', () => currentBackground(ctx))

  ipcMain.handle('bg:pick', async () => {
    const res = await dialog.showOpenDialog(ctx.win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const name = importImage(bgDir(), res.filePaths[0], 'bg')
    if (!name) return null
    ctx.config.backgroundImage = name
    saveConfig(ctx.config)
    return { dataUrl: dataUrlFor(join(bgDir(), name)), config: ctx.config }
  })

  ipcMain.handle('bg:reset', () => {
    ctx.config.backgroundImage = 'none'
    saveConfig(ctx.config)
    return { dataUrl: null, config: ctx.config }
  })

  // ---- the window icon. picking an image swaps it live and remembers it. ----
  // png/jpeg only: nativeImage can't decode webp, so a webp pick used to save
  // fine and then change absolutely nothing (the windows report). now the
  // dialog won't offer it, and an undecodable file is rejected instead of
  // silently pretending it worked.
  ipcMain.handle('appicon:pick', async () => {
    const res = await dialog.showOpenDialog(ctx.win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const img = nativeImage.createFromPath(res.filePaths[0])
    if (img.isEmpty()) return null
    const name = importImage(iconDir(), res.filePaths[0], 'icon')
    if (!name) return null
    ctx.config.appIcon = name
    saveConfig(ctx.config)
    try {
      ctx.win.setIcon(img)
    } catch {
      /* a broken image should not take the settings panel down with it */
    }
    return ctx.config
  })

  ipcMain.handle('appicon:reset', () => {
    delete ctx.config.appIcon
    saveConfig(ctx.config)
    try {
      ctx.win.setIcon(nativeImage.createFromPath(join(__dirname, '../../build/icon.png')))
    } catch {
      /* same story as above */
    }
    return ctx.config
  })
}
