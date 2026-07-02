// Wisp — © Shawy404. All rights reserved.
import { ipcMain, net } from 'electron'
import type { SearchResults, SourceItem } from '@shared/types'
import * as store from './storage'
import { runSearch } from './search'
import type { WispContext } from './ipc'

const lastResults = new Map<string, SearchResults>()

/** Merge new sources into a room's sources.json, skipping already-known ids. */
export function addSources(roomId: string, items: SourceItem[]): SourceItem[] {
  const existing = store.loadSources(roomId)
  const known = new Set(existing.map((s) => s.id))
  const fresh = items.filter((s) => !known.has(s.id))
  if (fresh.length > 0) store.saveSources(roomId, [...existing, ...fresh])
  return store.loadSources(roomId)
}

export function registerSearchIpc(ctx: WispContext): void {
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }

  ipcMain.handle('search:run', async (_e, query: string) => {
    const roomId = ctx.tabs.currentRoomId()
    const results = await runSearch(query, (url, init) => net.fetch(url, init))
    if (roomId) {
      lastResults.set(roomId, results)
      // Search capture: academic + wiki + images auto-save to the room.
      addSources(roomId, [...results.academic, ...results.wiki, ...results.images])
      notify(roomId)
    }
    return results
  })

  ipcMain.handle('search:last', (_e, roomId: string) => lastResults.get(roomId) ?? null)

  ipcMain.handle('sources:delete', (_e, roomId: string, sourceId: string) => {
    const sources = store.loadSources(roomId).filter((s) => s.id !== sourceId)
    store.saveSources(roomId, sources)
    notify(roomId)
    return sources
  })
}
