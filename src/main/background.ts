// Wisp — © Shawy404. All rights reserved.
import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
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

function currentBackground(ctx: WispContext): string | null {
  const bg = ctx.config.backgroundImage
  if (bg === 'none') return null
  if (!bg || bg === 'icon') {
    // Built-in default: the app icon (packaged at ../../build/icon.png).
    return dataUrlFor(join(__dirname, '../../build/icon.png'))
  }
  return dataUrlFor(join(bgDir(), bg))
}

export function registerBackground(ctx: WispContext): void {
  ipcMain.handle('bg:get', () => currentBackground(ctx))

  ipcMain.handle('bg:pick', async () => {
    const res = await dialog.showOpenDialog(ctx.win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    fs.mkdirSync(bgDir(), { recursive: true })
    const name = `bg-${Date.now()}${extname(res.filePaths[0])}`
    fs.copyFileSync(res.filePaths[0], join(bgDir(), name))
    ctx.config.backgroundImage = name
    saveConfig(ctx.config)
    return { dataUrl: dataUrlFor(join(bgDir(), name)), config: ctx.config }
  })

  // Reset to the icon watermark (mode 'icon') or nothing (mode 'none').
  ipcMain.handle('bg:reset', (_e, mode: 'icon' | 'none') => {
    ctx.config.backgroundImage = mode
    saveConfig(ctx.config)
    return { dataUrl: currentBackground(ctx), config: ctx.config }
  })
}
