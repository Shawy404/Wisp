// Wisp. © Shawy404, MIT.
import { ipcMain } from 'electron'
import type { WispContext } from './ipc'

/** Find-in-page for the active tab; match counts stream back to the find bar. */
export function registerFind(ctx: WispContext): void {
  let lastText = ''

  ctx.tabs.viewHooks.push((view) => {
    view.webContents.on('found-in-page', (_e, result) => {
      if (!ctx.win.isDestroyed()) {
        ctx.win.webContents.send('find:result', {
          matches: result.matches,
          active: result.activeMatchOrdinal
        })
      }
    })
  })

  ipcMain.handle('find:start', (_e, text: string) => {
    const wc = ctx.tabs.activeView()?.webContents
    if (!wc) return
    lastText = text
    if (!text) {
      wc.stopFindInPage('clearSelection')
      if (!ctx.win.isDestroyed()) {
        ctx.win.webContents.send('find:result', { matches: 0, active: 0 })
      }
      return
    }
    wc.findInPage(text)
  })

  ipcMain.handle('find:next', (_e, forward: boolean) => {
    const wc = ctx.tabs.activeView()?.webContents
    if (wc && lastText) wc.findInPage(lastText, { forward, findNext: true })
  })

  ipcMain.handle('find:stop', () => {
    ctx.tabs.activeView()?.webContents.stopFindInPage('clearSelection')
    lastText = ''
  })
}
