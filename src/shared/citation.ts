// Wisp — © Shawy404. All rights reserved.
import type { SourceItem } from './types'

export type CitationFormat = 'bibtex' | 'apa' | 'mla'

function citeKey(s: SourceItem): string {
  const author = (s.authors?.[0] ?? 'anon').split(/\s+/).pop() ?? 'anon'
  const year = s.year ?? 'nd'
  const word = s.title.split(/\s+/)[0]?.replace(/[^\p{L}\p{N}]/gu, '') ?? 'ref'
  return `${author}${year}${word}`.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function authorsBibtex(authors?: string[]): string {
  return (authors ?? []).join(' and ')
}

/** "Family, F." style used by APA. */
function apaAuthors(authors?: string[]): string {
  if (!authors || authors.length === 0) return ''
  const fmt = (name: string): string => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0]
    const family = parts.pop()!
    const initials = parts.map((p) => `${p[0].toUpperCase()}.`).join(' ')
    return `${family}, ${initials}`
  }
  const list = authors.map(fmt)
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`
}

/** "Family, First" for the first author, "First Family" for the rest (MLA). */
function mlaAuthors(authors?: string[]): string {
  if (!authors || authors.length === 0) return ''
  const first = authors[0].trim().split(/\s+/)
  const firstFmt =
    first.length > 1 ? `${first.pop()}, ${first.join(' ')}` : authors[0]
  if (authors.length === 1) return firstFmt
  if (authors.length === 2) return `${firstFmt}, and ${authors[1]}`
  return `${firstFmt}, et al`
}

const entryType = (s: SourceItem): string => (s.venue === 'arXiv' ? 'misc' : s.kind === 'academic' ? 'article' : 'online')

export function formatCitation(s: SourceItem, format: CitationFormat): string {
  const year = s.year ? String(s.year) : 'n.d.'
  switch (format) {
    case 'bibtex': {
      const fields: [string, string | undefined][] = [
        ['title', s.title],
        ['author', authorsBibtex(s.authors) || undefined],
        ['year', s.year ? String(s.year) : undefined],
        ['journal', s.venue],
        ['doi', s.doi],
        ['url', s.url],
        ['note', s.excerpt ? s.excerpt.slice(0, 200) : undefined]
      ]
      const body = fields
        .filter(([, v]) => v)
        .map(([k, v]) => `  ${k} = {${v}}`)
        .join(',\n')
      return `@${entryType(s)}{${citeKey(s)},\n${body}\n}`
    }
    case 'apa': {
      const authors = apaAuthors(s.authors)
      // No-author APA: title moves to the author position, year follows.
      const lead = authors ? `${authors} (${year}). ` : `${s.title}. (${year}). `
      const title = authors ? `${s.title}. ` : ''
      const venue = s.venue ? `${s.venue}.` : ''
      const link = s.doi ? ` https://doi.org/${s.doi}` : s.url ? ` ${s.url}` : ''
      return `${lead}${title}${venue}${link}`.replace(/\s+/g, ' ').trim()
    }
    case 'mla': {
      const authors = mlaAuthors(s.authors)
      const lead = authors ? `${authors}. ` : ''
      const venue = s.venue ? ` ${s.venue},` : ''
      const link = s.url ? ` ${s.url}.` : ''
      return `${lead}"${s.title}."${venue} ${year}.${link}`.replace(/\s+/g, ' ').trim()
    }
  }
}
