// Wisp. © Shawy404, MIT.
import type { SearchResults, SourceItem } from '@shared/types'
import { classifyQuery, extractKeywords, stableId, tagSlug } from '@shared/tags'

type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

const UA = { 'User-Agent': 'Wisp/0.1 (research browser; local-first)' }

function makeSource(
  partial: Omit<SourceItem, 'id' | 'tags' | 'addedAt' | 'origin'>,
  query: string
): SourceItem {
  const keyText = partial.doi || partial.url || partial.title
  const tags = [
    tagSlug(query),
    ...extractKeywords(`${partial.title} ${partial.abstract ?? ''}`, 4).map(tagSlug)
  ].filter((t, i, a) => t && a.indexOf(t) === i)
  return {
    ...partial,
    id: `src-${stableId(keyText)}`,
    tags,
    addedAt: new Date().toISOString(),
    origin: 'search'
  }
}

async function semanticScholar(query: string, f: FetchFn): Promise<SourceItem[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=100&fields=title,authors,year,venue,abstract,externalIds,url`
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}`)
  const data = (await res.json()) as {
    data?: {
      title: string
      authors?: { name: string }[]
      year?: number
      venue?: string
      abstract?: string
      url?: string
      externalIds?: { DOI?: string }
    }[]
  }
  return (data.data ?? []).map((p) =>
    makeSource(
      {
        kind: 'academic',
        title: p.title,
        authors: p.authors?.map((a) => a.name),
        year: p.year,
        venue: p.venue || undefined,
        abstract: p.abstract || undefined,
        doi: p.externalIds?.DOI,
        url: p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : undefined)
      },
      query
    )
  )
}

async function crossref(query: string, f: FetchFn): Promise<SourceItem[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=50&select=title,author,issued,container-title,DOI,URL,abstract`
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`Crossref ${res.status}`)
  const data = (await res.json()) as {
    message?: {
      items?: {
        title?: string[]
        author?: { given?: string; family?: string }[]
        issued?: { 'date-parts'?: number[][] }
        'container-title'?: string[]
        DOI?: string
        URL?: string
        abstract?: string
      }[]
    }
  }
  return (data.message?.items ?? [])
    .filter((w) => w.title?.[0])
    .map((w) =>
      makeSource(
        {
          kind: 'academic',
          title: w.title![0],
          authors: w.author?.map((a) => [a.given, a.family].filter(Boolean).join(' ')),
          year: w.issued?.['date-parts']?.[0]?.[0],
          venue: w['container-title']?.[0],
          abstract: w.abstract?.replace(/<[^>]+>/g, '').slice(0, 600) || undefined,
          doi: w.DOI,
          url: w.URL
        },
        query
      )
    )
}

async function arxiv(query: string, f: FetchFn): Promise<SourceItem[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=50`
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`arXiv ${res.status}`)
  const xml = await res.text()
  const entries = xml.split('<entry>').slice(1)
  const pick = (chunk: string, tag: string): string =>
    (chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) ?? [])[1]?.trim() ?? ''
  return entries.map((chunk) => {
    const title = pick(chunk, 'title').replace(/\s+/g, ' ')
    const link = pick(chunk, 'id')
    const authors = [...chunk.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => m[1].trim())
    const year = Number(pick(chunk, 'published').slice(0, 4)) || undefined
    return makeSource(
      {
        kind: 'academic',
        title,
        authors,
        year,
        venue: 'arXiv',
        abstract: pick(chunk, 'summary').replace(/\s+/g, ' ').slice(0, 600) || undefined,
        url: link
      },
      query
    )
  })
}

async function wikipedia(query: string, lang: string, f: FetchFn): Promise<SourceItem[]> {
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=25`
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`Wikipedia(${lang}) ${res.status}`)
  const data = (await res.json()) as {
    pages?: { title: string; description?: string | null; excerpt?: string; key: string }[]
  }
  return (data.pages ?? []).map((p) =>
    makeSource(
      {
        kind: 'wiki',
        title: p.title,
        abstract:
          [p.description, p.excerpt?.replace(/<[^>]+>/g, '')].filter(Boolean).join(' — ') ||
          undefined,
        venue: `${lang}.wikipedia.org`,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.key)}`
      },
      query
    )
  )
}

async function openverse(query: string, f: FetchFn): Promise<SourceItem[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=50`
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`Openverse ${res.status}`)
  const data = (await res.json()) as {
    results?: {
      title?: string
      url?: string
      thumbnail?: string
      foreign_landing_url?: string
      creator?: string
      license?: string
    }[]
  }
  return (data.results ?? [])
    .filter((r) => r.url || r.thumbnail)
    .map((r) =>
      makeSource(
        {
          kind: 'image',
          title: r.title || query,
          authors: r.creator ? [r.creator] : undefined,
          venue: r.license ? `openverse · ${r.license.toUpperCase()}` : 'openverse',
          url: r.foreign_landing_url || r.url,
          imageUrl: r.thumbnail || r.url
        },
        query
      )
    )
}

/** Optional clean general web via DuckDuckGo's HTML endpoint (best effort). */
async function duckduckgo(
  query: string,
  f: FetchFn,
  opts: { kind: 'web' | 'pdf'; region?: string } = { kind: 'web' }
): Promise<SourceItem[]> {
  // kl is ddg's region knob ("tr-tr", "us-en"…) — without it the endpoint
  // guesses from the server's side and everyone gets someone else's internet.
  const kl = opts.region ? `&kl=${encodeURIComponent(opts.region)}` : ''
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}${kl}`
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`)
  const html = await res.text()
  const out: SourceItem[] = []
  const re =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 30) {
    let href = m[1]
    const redirect = href.match(/uddg=([^&]+)/)
    if (redirect) href = decodeURIComponent(redirect[1])
    if (!/^https?:\/\//.test(href)) continue
    const strip = (s: string): string =>
      s
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
    out.push(
      makeSource(
        {
          kind: opts.kind,
          title: strip(m[2]),
          abstract: m[3] ? strip(m[3]).slice(0, 400) : undefined,
          venue: new URL(href).hostname,
          url: href
        },
        query
      )
    )
  }
  return out
}

/** The PDF bucket: same ddg endpoint, query pinned to filetype:pdf. */
async function duckduckgoPdfs(query: string, f: FetchFn, region?: string): Promise<SourceItem[]> {
  const items = await duckduckgo(`${query} filetype:pdf`, f, { kind: 'pdf', region })
  // ddg mostly honors filetype:, but the odd html page sneaks through — keep
  // the tab honest and only show links that actually end in .pdf.
  return items.filter((s) => s.url && /\.pdf(\?|#|$)/i.test(s.url))
}

async function settle(
  label: string,
  p: Promise<SourceItem[]>,
  errors: string[]
): Promise<SourceItem[]> {
  try {
    return await p
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }
}

/**
 * Fires every backend in parallel and aggregates. Never throws.
 * `locale` is the OS locale ("tr-TR", "en-US", "de-DE"…) — it used to be
 * hardcoded to turkish-first, which was great for exactly one person (me).
 * Now the local-language wikipedia leads (english still tags along) and
 * duckduckgo gets the matching region.
 */
export async function runSearch(
  query: string,
  fetchFn: FetchFn,
  locale?: string
): Promise<SearchResults> {
  const errors: string[] = []
  const lang = (locale?.split('-')[0] ?? 'en').toLowerCase() || 'en'
  const country = locale?.split('-')[1]?.toLowerCase()
  const region = lang && country ? `${country}-${lang}` : undefined
  // Local-language wiki first, english as the fallback column; when the system
  // already speaks english that's just one wiki instead of a duplicate pair.
  const wikiLangs = [...new Set([lang, 'en'])]
  const [s2, cr, ax, img, web, pdfs, ...wikis] = await Promise.all([
    settle('semantic-scholar', semanticScholar(query, fetchFn), errors),
    settle('crossref', crossref(query, fetchFn), errors),
    settle('arxiv', arxiv(query, fetchFn), errors),
    settle('openverse', openverse(query, fetchFn), errors),
    settle('duckduckgo', duckduckgo(query, fetchFn, { kind: 'web', region }), errors),
    settle('duckduckgo-pdf', duckduckgoPdfs(query, fetchFn, region), errors),
    ...wikiLangs.map((wl) => settle(`wikipedia-${wl}`, wikipedia(query, wl, fetchFn), errors))
  ])
  const dedupe = (items: SourceItem[]): SourceItem[] => {
    const seen = new Set<string>()
    return items.filter((s) => !seen.has(s.id) && seen.add(s.id))
  }
  return {
    query,
    classification: classifyQuery(query),
    academic: dedupe([...s2, ...ax, ...cr]),
    wiki: dedupe(wikis.flat()),
    images: dedupe(img),
    web: dedupe(web),
    pdfs: dedupe(pdfs),
    errors
  }
}
