// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { clipboard, Menu, net } from 'electron'
import type { SourceItem } from '@shared/types'
import { extractKeywords, stableId, tagSlug } from '@shared/tags'
import { translate } from '@shared/i18n'
import { noteSlug } from '@shared/wikilink'
import * as store from './storage'
import { addSources } from './search-ipc'
import type { WispContext } from './ipc'
import { extractReadable } from './reader'

function extFromUrl(url: string): string {
  const m = url.match(/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i)
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.img'
}

async function saveImageClip(roomId: string, imageUrl: string): Promise<string | null> {
  try {
    const res = await net.fetch(imageUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const name = `${stableId(imageUrl)}${extFromUrl(imageUrl)}`
    fs.mkdirSync(store.clipsDir(roomId), { recursive: true })
    fs.writeFileSync(join(store.clipsDir(roomId), name), buf)
    return name
  } catch {
    return null
  }
}

/**
 * Wires a right-click context menu onto every tab: clip the whole page
 * (reader-cleaned), a text selection, or an image into the current room.
 */
export function registerClip(ctx: WispContext): void {
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }
  const toast = (text: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('toast', text)
  }

  ctx.tabs.viewHooks.push((view, tabId) => {
    view.webContents.on('context-menu', (_e, params) => {
      const roomId = ctx.tabs.currentRoomId()
      if (!roomId) return
      const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>): string =>
        translate(ctx.config.language ?? 'tr', key, vars)
      const roomName = store.loadRoomMeta(roomId)?.name ?? t('main.clip.defaultRoomName')
      const pageUrl = view.webContents.getURL()
      const pageTitle = view.webContents.getTitle()

      const template: Electron.MenuItemConstructorOptions[] = []

      // Standard edit actions first — a browser context menu is expected to
      // copy/paste before anything Wisp-specific.
      const ef = params.editFlags
      const wc = view.webContents
      const editItems: Electron.MenuItemConstructorOptions[] = []
      if (ef.canCut && params.isEditable) {
        editItems.push({ label: t('main.ctx.cut'), accelerator: 'CmdOrCtrl+X', click: () => wc.cut() })
      }
      if (ef.canCopy && params.selectionText) {
        editItems.push({ label: t('main.ctx.copy'), accelerator: 'CmdOrCtrl+C', click: () => wc.copy() })
      }
      if (ef.canPaste && params.isEditable) {
        editItems.push({ label: t('main.ctx.paste'), accelerator: 'CmdOrCtrl+V', click: () => wc.paste() })
      }
      if (ef.canSelectAll) {
        editItems.push({ label: t('main.ctx.selectAll'), accelerator: 'CmdOrCtrl+A', click: () => wc.selectAll() })
      }
      if (params.linkURL) {
        editItems.push({ label: t('main.ctx.copyLink'), click: () => clipboard.writeText(params.linkURL) })
      }
      if (params.mediaType === 'image' && params.srcURL) {
        editItems.push({ label: t('main.ctx.copyImage'), click: () => wc.copyImageAt(params.x, params.y) })
        editItems.push({ label: t('main.ctx.copyImageUrl'), click: () => clipboard.writeText(params.srcURL) })
      }
      if (editItems.length > 0) {
        template.push(...editItems, { type: 'separator' })
      }

      // The primary way to collect sources while researching: right-click a
      // page and take it as a source. Lightweight — title + URL, no clip file.
      if (pageUrl && !pageUrl.startsWith('about:')) {
        template.push({
          label: t('main.clip.addSourceLabel', { room: roomName }),
          click: () => {
            const source: SourceItem = {
              id: `src-${stableId(pageUrl)}`,
              kind: 'web',
              title: pageTitle || pageUrl,
              url: pageUrl,
              venue: (() => {
                try {
                  return new URL(pageUrl).hostname
                } catch {
                  return undefined
                }
              })(),
              tags: extractKeywords(pageTitle || '', 4).map(tagSlug),
              addedAt: new Date().toISOString(),
              origin: 'manual'
            }
            addSources(roomId, [source])
            notify(roomId)
            toast(t('main.clip.addSourceToast'))
          }
        })
        template.push({ type: 'separator' })
      }

      // Selected text becomes a real note (quote + source link) instead of a
      // "section clip" source — a note is editable, linkable and shows on the map.
      if (params.selectionText && params.selectionText.trim()) {
        template.push({
          label: t('main.clip.selectionNoteLabel', { room: roomName }),
          click: () => {
            const excerpt = params.selectionText.trim()
            const base = noteSlug(pageTitle || excerpt.slice(0, 60) || t('main.clip.defaultNoteTitle'))
            const existing = new Set(store.listNotes(roomId).map((n) => n.id))
            let id = base
            let n = 2
            while (existing.has(id)) id = `${base} ${n++}`
            const quoted = excerpt
              .split('\n')
              .map((line) => `> ${line}`)
              .join('\n')
            store.writeNote(roomId, id, `# ${id}\n\n${quoted}\n\n— [${pageTitle || pageUrl}](${pageUrl})\n`)
            notify(roomId)
            toast(t('main.clip.selectionNoteToast'))
          }
        })
        // Clip a *picture* of the selection: screenshot its bounding box into
        // the room. The saved excerpt doubles as a text fragment, so opening
        // the source later lands on the page with the section highlighted.
        template.push({
          label: t('main.clip.shotLabel', { room: roomName }),
          click: async () => {
            try {
              const rect = (await wc.executeJavaScript(
                '(() => { const s = getSelection(); if (!s || s.rangeCount === 0) return null;' +
                  ' const r = s.getRangeAt(0).getBoundingClientRect();' +
                  ' return { x: r.x, y: r.y, width: r.width, height: r.height } })()',
                true
              )) as { x: number; y: number; width: number; height: number } | null
              if (!rect || rect.width < 4 || rect.height < 4) return
              const image = await wc.capturePage({
                x: Math.max(0, Math.round(rect.x)),
                y: Math.max(0, Math.round(rect.y)),
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height)
              })
              const excerpt = params.selectionText.trim()
              const file = `sel-${stableId(pageUrl + excerpt)}.png`
              fs.mkdirSync(store.clipsDir(roomId), { recursive: true })
              fs.writeFileSync(join(store.clipsDir(roomId), file), image.toPNG())
              const source: SourceItem = {
                id: `src-${stableId(pageUrl + excerpt)}`,
                kind: 'image',
                title: pageTitle || pageUrl,
                url: pageUrl,
                excerpt,
                clipFile: file,
                tags: extractKeywords(excerpt, 5).map(tagSlug),
                addedAt: new Date().toISOString(),
                origin: 'clip'
              }
              addSources(roomId, [source])
              notify(roomId)
              toast(t('main.clip.shotToast'))
            } catch {
              /* tab navigated away mid-capture */
            }
          }
        })
      }

      if (params.mediaType === 'image' && params.srcURL) {
        template.push({
          label: t('main.clip.imageLabel', { room: roomName }),
          click: async () => {
            const clipFile = await saveImageClip(roomId, params.srcURL)
            const source: SourceItem = {
              id: `src-${stableId(params.srcURL)}`,
              kind: 'image',
              title: params.titleText || pageTitle || t('main.clip.imageDefaultTitle'),
              url: pageUrl,
              imageUrl: params.srcURL,
              clipFile: clipFile ?? undefined,
              tags: extractKeywords(params.titleText || pageTitle || '', 3).map(tagSlug),
              addedAt: new Date().toISOString(),
              origin: 'clip'
            }
            addSources(roomId, [source])
            notify(roomId)
            toast(t('main.clip.imageToast'))
          }
        })
      }

      template.push({
        label: t('main.clip.pageLabel', { room: roomName }),
        click: async () => {
          const res = await extractReadable(ctx, tabId)
          const text = res?.article?.textContent ?? ''
          const clipName = `${stableId(pageUrl)}.md`
          fs.mkdirSync(store.clipsDir(roomId), { recursive: true })
          fs.writeFileSync(
            join(store.clipsDir(roomId), clipName),
            `# ${res?.article?.title ?? pageTitle}\n\n> ${pageUrl}\n\n${text}`
          )
          const source: SourceItem = {
            id: `src-${stableId(pageUrl)}`,
            kind: 'clip',
            title: res?.article?.title || pageTitle || pageUrl,
            url: pageUrl,
            abstract: res?.article?.excerpt,
            clipFile: clipName,
            tags: extractKeywords(
              `${res?.article?.title ?? pageTitle} ${text.slice(0, 1500)}`,
              5
            ).map(tagSlug),
            addedAt: new Date().toISOString(),
            origin: 'clip'
          }
          addSources(roomId, [source])
          notify(roomId)
          toast(t('main.clip.pageToast'))
        }
      })

      template.push({ type: 'separator' })
      if (params.linkURL) {
        template.push({
          label: t('main.clip.openLink'),
          click: () => ctx.tabs.openTab(roomId, params.linkURL, true)
        })
      }
      template.push({
        label: t('main.clip.back'),
        enabled: view.webContents.navigationHistory.canGoBack(),
        click: () => view.webContents.navigationHistory.goBack()
      })
      template.push({ label: t('main.clip.reload'), click: () => view.webContents.reload() })

      Menu.buildFromTemplate(template).popup()
    })
  })
}
