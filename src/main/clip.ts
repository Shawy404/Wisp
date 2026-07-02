// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { Menu, net } from 'electron'
import type { SourceItem } from '@shared/types'
import { extractKeywords, stableId, tagSlug } from '@shared/tags'
import { translate } from '@shared/i18n'
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

      if (params.selectionText && params.selectionText.trim()) {
        template.push({
          label: t('main.clip.selectionLabel', { room: roomName }),
          click: () => {
            const excerpt = params.selectionText.trim()
            const source: SourceItem = {
              id: `src-${stableId(pageUrl + excerpt)}`,
              kind: 'clip',
              title: pageTitle || pageUrl,
              url: pageUrl,
              excerpt,
              tags: [...extractKeywords(excerpt, 5).map(tagSlug)],
              addedAt: new Date().toISOString(),
              origin: 'clip'
            }
            addSources(roomId, [source])
            notify(roomId)
            toast(t('main.clip.selectionToast'))
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
