// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { ipcMain } from 'electron'
import type { NoteInfo } from '@shared/types'
import { noteSlug } from '@shared/wikilink'
import { stableId } from '@shared/tags'
import * as store from './storage'
import type { WispContext } from './ipc'

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp'
}

/** Store pasted/dropped image bytes under the room's clips dir. */
export function saveClipImage(roomId: string, name: string, bytes: Uint8Array): string {
  const ext = (name.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i)?.[1] ?? 'png').toLowerCase()
  const file = `img-${stableId(name + Date.now())}.${ext === 'jpeg' ? 'jpg' : ext}`
  fs.mkdirSync(store.clipsDir(roomId), { recursive: true })
  fs.writeFileSync(join(store.clipsDir(roomId), file), Buffer.from(bytes))
  return file
}

export function registerNotesIpc(ctx: WispContext): void {
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }

  ipcMain.handle('notes:list', (_e, roomId: string) => store.listNotes(roomId))

  ipcMain.handle('notes:create', (_e, roomId: string, title: string) => {
    let id = noteSlug(title)
    const existing = new Set(store.listNotes(roomId).map((n) => n.id))
    if (existing.has(id)) {
      let n = 2
      while (existing.has(`${id} ${n}`)) n++
      id = `${id} ${n}`
    }
    const note = store.writeNote(roomId, id, `# ${title}\n\n`)
    notify(roomId)
    return note
  })

  // Renderer debounces saves; this writes to disk and re-derives tags.
  ipcMain.handle('notes:save', (_e, roomId: string, noteId: string, body: string) => {
    const note = store.writeNote(roomId, noteId, body)
    notify(roomId)
    return note
  })

  ipcMain.handle('notes:delete', (_e, roomId: string, noteId: string) => {
    store.deleteNote(roomId, noteId)
    notify(roomId)
  })

  ipcMain.handle('notes:rename', (_e, roomId: string, oldId: string, newTitle: string): NoteInfo | null => {
    const newId = noteSlug(newTitle)
    if (newId === oldId) return store.listNotes(roomId).find((n) => n.id === oldId) ?? null
    if (!store.renameNote(roomId, oldId, newId)) return null
    // The note's map identity is `note:<id>` — carry its edges, hand-placed
    // position and hidden flag over so a rename doesn't orphan them.
    const oldNode = `note:${oldId}`
    const newNode = `note:${newId}`
    const map = store.loadMap(roomId)
    let changed = false
    for (const edge of map.edges) {
      if (edge.from === oldNode) {
        edge.from = newNode
        changed = true
      }
      if (edge.to === oldNode) {
        edge.to = newNode
        changed = true
      }
    }
    if (map.positions?.[oldNode]) {
      map.positions[newNode] = map.positions[oldNode]
      delete map.positions[oldNode]
      changed = true
    }
    if (map.hidden?.includes(oldNode)) {
      map.hidden = map.hidden.map((id) => (id === oldNode ? newNode : id))
      changed = true
    }
    if (changed) store.saveMap(roomId, map)
    notify(roomId)
    return store.listNotes(roomId).find((n) => n.id === newId) ?? null
  })

  // Image pasted/dropped into a note — saved under clips/, referenced as
  // ../clips/<file> in the markdown (Obsidian-style relative path).
  ipcMain.handle('notes:saveImage', (_e, roomId: string, name: string, bytes: Uint8Array) => {
    try {
      return saveClipImage(roomId, String(name), bytes)
    } catch {
      return null
    }
  })

  // Local clip file → data URL, for the note editor's inline previews and the
  // map's photo nodes (the sandboxed renderer can't read files itself).
  ipcMain.handle('clips:dataUrl', (_e, roomId: string, file: string) => {
    if (!file || file.includes('/') || file.includes('\\') || file.includes('..')) return null
    try {
      const buf = fs.readFileSync(join(store.clipsDir(roomId), file))
      const ext = file.split('.').pop()?.toLowerCase() ?? ''
      return `data:${IMAGE_MIME[ext] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })
}
