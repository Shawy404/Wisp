// Wisp. © Shawy404, MIT.
import * as fs from 'fs'
import { basename, join } from 'path'
import { app, ipcMain, shell, type DownloadItem } from 'electron'
import type { DownloadInfo } from '@shared/types'
import { webSession } from './security'
import type { WispContext } from './ipc'

/**
 * Download manager. Page downloads land in ~/Downloads with a unique name;
 * progress is streamed to the renderer's downloads panel. Video clips
 * (yt-dlp) register themselves here too via trackExternal, so everything
 * that transfers bytes shows up in one place.
 */

let nextId = 1
const items = new Map<string, DownloadInfo>()
const order: string[] = []
const native = new Map<string, DownloadItem>()

let broadcast: () => void = () => {}
let lastBroadcast = 0

function push(info: DownloadInfo): void {
  items.set(info.id, info)
  order.unshift(info.id)
  // The list stays short — finished entries older than the last 40 drop off.
  while (order.length > 40) {
    const dropped = order.pop()!
    items.delete(dropped)
    native.delete(dropped)
  }
}

function throttledBroadcast(): void {
  const now = Date.now()
  if (now - lastBroadcast < 400) return
  lastBroadcast = now
  broadcast()
}

export function listDownloads(): DownloadInfo[] {
  return order.map((id) => items.get(id)!).filter(Boolean)
}

/**
 * Register an externally-driven transfer (yt-dlp). Returns callbacks the
 * driver uses to report progress and the final state.
 */
export function trackExternal(
  filename: string,
  url: string
): {
  id: string
  update: (received: number, total: number) => void
  done: (path: string) => void
  fail: () => void
} {
  const id = `dl-${nextId++}`
  push({
    id,
    filename,
    path: '',
    url,
    state: 'progress',
    received: 0,
    total: 0,
    startedAt: new Date().toISOString()
  })
  broadcast()
  const get = (): DownloadInfo | undefined => items.get(id)
  return {
    id,
    update: (received, total) => {
      const it = get()
      if (!it || it.state !== 'progress') return
      it.received = received
      it.total = total
      throttledBroadcast()
    },
    done: (path) => {
      const it = get()
      if (!it) return
      it.state = 'done'
      it.path = path
      it.filename = basename(path)
      broadcast()
    },
    fail: () => {
      const it = get()
      if (!it) return
      if (it.state === 'progress') it.state = 'failed'
      broadcast()
    }
  }
}

/** Mark an external transfer canceled (yt-dlp process killed). */
export function cancelExternalMark(id: string): void {
  const it = items.get(id)
  if (it && it.state === 'progress') {
    it.state = 'canceled'
    broadcast()
  }
}

/** Cancel hooks for external transfers, keyed by download id. */
export const externalCancel = new Map<string, () => void>()

function uniquePath(dir: string, name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let candidate = join(dir, name)
  let n = 1
  while (fs.existsSync(candidate)) candidate = join(dir, `${stem} (${n++})${ext}`)
  return candidate
}

export function registerDownloads(ctx: WispContext): void {
  broadcast = () => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('downloads:state', listDownloads())
  }

  webSession().on('will-download', (_e, item) => {
    const id = `dl-${nextId++}`
    const path = uniquePath(app.getPath('downloads'), item.getFilename() || 'download')
    item.setSavePath(path)
    push({
      id,
      filename: basename(path),
      path,
      url: item.getURL(),
      state: 'progress',
      received: 0,
      total: item.getTotalBytes(),
      startedAt: new Date().toISOString()
    })
    native.set(id, item)
    broadcast()

    item.on('updated', () => {
      const it = items.get(id)
      if (!it) return
      it.received = item.getReceivedBytes()
      it.total = item.getTotalBytes()
      throttledBroadcast()
    })
    item.once('done', (_ev, state) => {
      const it = items.get(id)
      native.delete(id)
      if (!it) return
      it.received = item.getReceivedBytes()
      it.state = state === 'completed' ? 'done' : state === 'cancelled' ? 'canceled' : 'failed'
      broadcast()
    })
  })

  ipcMain.handle('downloads:list', () => listDownloads())
  ipcMain.handle('downloads:cancel', (_e, id: string) => {
    native.get(id)?.cancel()
    externalCancel.get(id)?.()
  })
  ipcMain.handle('downloads:open', (_e, id: string) => {
    const it = items.get(id)
    if (it?.state === 'done' && it.path) void shell.openPath(it.path)
  })
  ipcMain.handle('downloads:show', (_e, id: string) => {
    const it = items.get(id)
    if (it?.path) shell.showItemInFolder(it.path)
  })
  ipcMain.handle('downloads:clear', () => {
    for (const id of [...order]) {
      const it = items.get(id)
      if (it && it.state !== 'progress') {
        items.delete(id)
        native.delete(id)
        externalCancel.delete(id)
        order.splice(order.indexOf(id), 1)
      }
    }
    broadcast()
  })
}
