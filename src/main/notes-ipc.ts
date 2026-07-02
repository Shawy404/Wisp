// Wisp — © Shawy404. All rights reserved.
import { ipcMain } from 'electron'
import type { NoteInfo } from '@shared/types'
import { noteSlug } from '@shared/wikilink'
import * as store from './storage'
import type { WispContext } from './ipc'

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
    notify(roomId)
    return store.listNotes(roomId).find((n) => n.id === newId) ?? null
  })
}
