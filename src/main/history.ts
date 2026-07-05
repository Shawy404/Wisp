// Wisp. © Shawy404, MIT.
import { ipcMain } from 'electron'
import type { HistoryEntry } from '@shared/types'
import * as store from './storage'
import type { WispContext } from './ipc'

/**
 * Per-room browsing history. The room *is* the research context, so each room
 * keeps its own trail (rooms/<slug>/history.json). Navigation events upsert:
 * a repeat event for the page just visited (title/favicon arriving late)
 * updates the entry in place instead of stacking duplicates.
 */
export function registerHistory(ctx: WispContext): void {
  ctx.tabs.onVisit = (roomId, visit) => {
    const entries = store.loadHistory(roomId)
    const last = entries[entries.length - 1]
    if (last && last.url === visit.url) {
      last.title = visit.title || last.title
      last.favicon = visit.favicon ?? last.favicon
    } else {
      entries.push({
        url: visit.url,
        title: visit.title,
        favicon: visit.favicon,
        at: new Date().toISOString()
      })
    }
    store.saveHistory(roomId, entries)
  }

  // Newest first, optionally filtered — the panel renders this directly.
  ipcMain.handle('history:list', (_e, roomId: string, query?: string): HistoryEntry[] => {
    let entries = store.loadHistory(roomId)
    if (query?.trim()) {
      const q = query.trim().toLowerCase()
      entries = entries.filter(
        (h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
      )
    }
    return entries.reverse()
  })

  ipcMain.handle('history:delete', (_e, roomId: string, at: string) => {
    store.saveHistory(
      roomId,
      store.loadHistory(roomId).filter((h) => h.at !== at)
    )
  })

  ipcMain.handle('history:clear', (_e, roomId: string) => {
    store.saveHistory(roomId, [])
  })
}
