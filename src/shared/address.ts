// Wisp — © Shawy404. All rights reserved.
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
