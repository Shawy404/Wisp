// Wisp — © Shawy404. All rights reserved.

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
