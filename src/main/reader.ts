// Wisp. © Shawy404, MIT.
import * as fs from 'fs'
import { join } from 'path'
import { ipcMain } from 'electron'
import type { SourceItem } from '@shared/types'
import { extractKeywords, stableId, tagSlug } from '@shared/tags'
import * as store from './storage'
import { addSources } from './search-ipc'
import type { WispContext } from './ipc'

interface ExtractedArticle {
  title: string
  byline?: string
  textContent: string
  content: string
  excerpt?: string
  siteName?: string
  length: number
}

/**
 * Runs Mozilla Readability inside the tab's own web contents (where the DOM
 * lives), returning clean article text. Executed in the page context via a
 * bundled UMD build of readability injected as a string.
 */
export async function extractReadable(
  ctx: WispContext,
  tabId: string
): Promise<{ article: ExtractedArticle | null; url: string; title: string } | null> {
  const tab = ctx.tabs.getTab(tabId)
  if (!tab?.view) return null
  const wc = tab.view.webContents
  const readabilitySrc = fs.readFileSync(
    require.resolve('@mozilla/readability/Readability.js'),
    'utf8'
  )
  const script = `
    (function () {
      try {
        ${readabilitySrc}
        var docClone = document.cloneNode(true);
        var article = new Readability(docClone).parse();
        if (!article) return null;
        return {
          title: article.title,
          byline: article.byline,
          textContent: article.textContent,
          content: article.content,
          excerpt: article.excerpt,
          siteName: article.siteName,
          length: article.length
        };
      } catch (e) { return null; }
    })();
  `
  const article = (await wc.executeJavaScript(script, true).catch(() => null)) as
    | ExtractedArticle
    | null
  return { article, url: wc.getURL(), title: wc.getTitle() }
}

function makeReaderSource(
  article: ExtractedArticle,
  url: string,
  clipFile?: string,
  excerpt?: string
): SourceItem {
  const tags = extractKeywords(`${article.title} ${article.textContent.slice(0, 2000)}`, 5).map(
    tagSlug
  )
  return {
    id: `src-${stableId(url + (excerpt ?? ''))}`,
    kind: 'clip',
    title: article.title || url,
    url,
    authors: article.byline ? [article.byline] : undefined,
    venue: article.siteName,
    abstract: article.excerpt,
    excerpt,
    clipFile,
    tags,
    addedAt: new Date().toISOString(),
    origin: excerpt ? 'clip' : 'reader'
  }
}

export function registerReaderIpc(ctx: WispContext): void {
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }

  // Return clean article text for the reader overlay.
  ipcMain.handle('reader:extract', async (_e, tabId: string) => {
    const res = await extractReadable(ctx, tabId)
    if (!res || !res.article) return null
    return {
      title: res.article.title || res.title,
      byline: res.article.byline,
      siteName: res.article.siteName,
      html: res.article.content,
      text: res.article.textContent,
      url: res.url,
      words: Math.round(res.article.length / 5)
    }
  })

  // Reader capture: save the cleaned article as a source (+ .md clip file).
  ipcMain.handle('reader:save', async (_e, tabId: string) => {
    const roomId = ctx.tabs.currentRoomId()
    const res = await extractReadable(ctx, tabId)
    if (!roomId || !res || !res.article) return null
    const clipName = `${stableId(res.url)}.md`
    const clipPath = join(store.clipsDir(roomId), clipName)
    fs.mkdirSync(store.clipsDir(roomId), { recursive: true })
    fs.writeFileSync(
      clipPath,
      `# ${res.article.title}\n\n> ${res.url}\n\n${res.article.textContent}`
    )
    const source = makeReaderSource(res.article, res.url, clipName)
    addSources(roomId, [source])
    notify(roomId)
    return source
  })
}
