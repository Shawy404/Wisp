// Wisp. © Shawy404, MIT.

/**
 * Pull every [[wikilink]] target out of markdown (target only, alias dropped).
 * Excludes ![[embeds]] — the leading `!` marks a source embed, not a note link.
 */
export function extractWikilinks(text: string): string[] {
  const links = new Set<string>()
  for (const m of text.matchAll(/(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = m[1].trim()
    if (target) links.add(target)
  }
  return [...links]
}

/** Pull embedded source references: ![[src-<id>]] embeds a source card in a note. */
export function extractSourceEmbeds(text: string): string[] {
  const ids = new Set<string>()
  for (const m of text.matchAll(/!\[\[(src-[a-z0-9]+)\]\]/gi)) ids.add(m[1])
  return [...ids]
}

/** A note id/title is a filesystem-safe slug of the display title. */
export function noteSlug(title: string): string {
  return (
    title
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 120) || 'not'
  )
}
