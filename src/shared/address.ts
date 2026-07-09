// Wisp. © Shawy404, MIT.
import type { SearchEngineId } from './types'

/** Address-bar web searches land on a regular engine, like any browser. */
const SEARCH_ENGINE_URLS: Record<SearchEngineId, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q='
}

export function webSearchUrl(engine: SearchEngineId | undefined, query: string): string {
  return `${SEARCH_ENGINE_URLS[engine ?? 'google']}${encodeURIComponent(query)}`
}

/**
 * Open a clipped source with its section highlighted: Chromium text fragments
 * (#:~:text=…) scroll to and mark the excerpt on the page.
 */
export function highlightUrl(url: string, excerpt?: string): string {
  const words = excerpt?.trim().replace(/\s+/g, ' ')
  if (!words) return url
  // dashes and commas mean things inside a text fragment, so they get encoded
  // by hand. found that out the hard way with an excerpt full of dates.
  const enc = (s: string): string =>
    encodeURIComponent(s).replace(/-/g, '%2D').replace(/,/g, '%2C')
  const tokens = words.split(' ')
  // long clips become a start,end range so the whole saved section lights up,
  // not just the first line of it
  const frag =
    tokens.length > 10
      ? `${enc(tokens.slice(0, 5).join(' '))},${enc(tokens.slice(-4).join(' '))}`
      : enc(words)
  // whatever hash the url already had loses the argument. the highlight wins.
  return `${url.split('#')[0]}#:~:text=${frag}`
}

/** Decide whether address-bar input is a URL to visit or a search query. */
export function resolveAddress(
  input: string
): { type: 'url'; url: string } | { type: 'search'; query: string } {
  const text = input.trim()
  if (!text) return { type: 'search', query: '' }
  if (/^(https?|file|wisp):\/\//i.test(text)) return { type: 'url', url: text }
  if (/^about:/i.test(text)) return { type: 'url', url: text }
  if (/^localhost(:\d+)?(\/|$)/i.test(text)) return { type: 'url', url: `http://${text}` }
  // domain-like: no spaces, contains a dot, valid host chars
  if (!/\s/.test(text) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(text)) {
    return { type: 'url', url: `https://${text}` }
  }
  return { type: 'search', query: text }
}
