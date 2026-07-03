// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { ipcMain, net } from 'electron'
import type { RoomSearchHit, SearchResults, SourceItem } from '@shared/types'
import * as store from './storage'
import { runSearch } from './search'
import type { WispContext } from './ipc'

/** A short window of text around the first case-insensitive match. */
function snippetAround(text: string, queryLower: string): string | null {
  const idx = text.toLowerCase().indexOf(queryLower)
  if (idx < 0) return null
  const from = Math.max(0, idx - 60)
  const to = Math.min(text.length, idx + queryLower.length + 90)
  return (
    (from > 0 ? '…' : '') +
    text.slice(from, to).replace(/\s+/g, ' ').trim() +
    (to < text.length ? '…' : '')
  )
}

/** Full-text search across everything the room holds on disk. */
export function searchRoom(roomId: string, query: string): RoomSearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const hits: RoomSearchHit[] = []

  for (const n of store.listNotes(roomId)) {
    const snippet = snippetAround(`${n.title}\n${n.body}`, q)
    if (snippet) hits.push({ type: 'note', id: n.id, title: n.title, snippet })
  }

  for (const s of store.loadSources(roomId)) {
    const own = snippetAround(
      [s.title, s.abstract, s.excerpt, s.authors?.join(' ')].filter(Boolean).join('\n'),
      q
    )
    if (own) {
      hits.push({ type: 'source', id: s.id, title: s.title, snippet: own, url: s.url })
      continue
    }
    // Clipped page contents live in .md files under clips/.
    if (s.clipFile?.endsWith('.md')) {
      try {
        const body = fs.readFileSync(join(store.clipsDir(roomId), s.clipFile), 'utf8')
        const snippet = snippetAround(body, q)
        if (snippet) hits.push({ type: 'clip', id: s.id, title: s.title, snippet, url: s.url })
      } catch {
        /* clip file missing — skip */
      }
    }
  }

  const history = store.loadHistory(roomId)
  for (let i = history.length - 1; i >= 0 && hits.length < 80; i--) {
    const h = history[i]
    if (`${h.title} ${h.url}`.toLowerCase().includes(q)) {
      hits.push({ type: 'history', id: h.at, title: h.title || h.url, snippet: h.url, url: h.url })
    }
  }

  return hits.slice(0, 80)
}

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

  // Search only *shows* results — nothing is saved until the user explicitly
  // adds a result to the room. This keeps sources a curated library instead of
  // a dump of every query ever run.
  ipcMain.handle('search:run', async (_e, query: string) => {
    const roomId = ctx.tabs.currentRoomId()
    const results = await runSearch(query, (url, init) => net.fetch(url, init))
    if (roomId) lastResults.set(roomId, results)
    return results
  })

  ipcMain.handle('search:last', (_e, roomId: string) => lastResults.get(roomId) ?? null)

  ipcMain.handle('room:search', (_e, roomId: string, query: string) => searchRoom(roomId, query))

  // Explicit save of a single result (the ＋ button on a result card).
  ipcMain.handle('sources:add', (_e, roomId: string, item: SourceItem) => {
    const sources = addSources(roomId, [item])
    notify(roomId)
    return sources
  })

  // Rename from the map (or anywhere) — the source's title is its map label.
  ipcMain.handle('sources:rename', (_e, roomId: string, sourceId: string, title: string) => {
    const sources = store.loadSources(roomId)
    const source = sources.find((s) => s.id === sourceId)
    if (source && title.trim()) {
      source.title = title.trim()
      store.saveSources(roomId, sources)
      notify(roomId)
    }
    return sources
  })

  ipcMain.handle('sources:delete', (_e, roomId: string, sourceId: string) => {
    const sources = store.loadSources(roomId).filter((s) => s.id !== sourceId)
    store.saveSources(roomId, sources)
    notify(roomId)
    return sources
  })
}
