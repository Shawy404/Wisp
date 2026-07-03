// Wisp — © Shawy404. All rights reserved.
import type { MapData, MapEdge, NoteInfo, RoomData, SourceItem } from './types'
import { extractSourceEmbeds, extractWikilinks, noteSlug } from './wikilink'

export interface GraphNode {
  id: string
  label: string
  type: 'source' | 'note' | 'concept'
  kind?: SourceItem['kind']
  tags: string[]
  /** Custom accent color (concepts created from templates). */
  color?: string
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  kind: MapEdge['kind']
  label?: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const noteNodeId = (id: string): string => `note:${id}`
export const conceptNodeId = (id: string): string => `concept:${id}`

export interface GraphOptions {
  /**
   * Include tag-similarity edges. Off by default — like Logseq/Obsidian, the
   * map is built from *explicit* links (wikilinks, manual, accepted AI), not
   * from guessed keyword overlap, so you don't get connections you never made.
   */
  tagLinks?: boolean
  /**
   * Auto-link nodes when one *names* another: a note whose text mentions
   * "monosodium" links to the monosodium concept/note without any [[...]].
   * On by default — these are real references, just not marked up.
   */
  mentionLinks?: boolean
  /** Node ids the user has hidden from the map (persisted per room). */
  hidden?: Set<string>
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-word (unicode-aware) containment: "monosodium" in "…monosodium is…". */
function mentions(haystackLower: string, labelLower: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(labelLower)}($|[^\\p{L}\\p{N}])`, 'u')
  return re.test(haystackLower)
}

/**
 * The single source of truth for the map. Notes and concept nodes always show
 * (they're deliberate creations); sources only show once the user has placed
 * them on the map (map.included) — dragged in from the library panel. Edges:
 *   1. wikilink   — [[note]] / ![[src-id]] references in note bodies
 *   2. manual/ai  — persisted edges from map.json (drag-to-link, accepted AI)
 *   3. tag        — OPTIONAL soft "shares a tag" edges, off unless asked for
 * Editing any underlying object and rebuilding keeps every view in sync.
 */
export function buildGraph(data: RoomData, opts: GraphOptions = {}): Graph {
  const hidden = opts.hidden ?? new Set<string>()
  const nodes: GraphNode[] = []
  const nodeIds = new Set<string>()
  const add = (n: GraphNode): void => {
    if (hidden.has(n.id)) return
    if (!nodeIds.has(n.id)) {
      nodeIds.add(n.id)
      nodes.push(n)
    }
  }

  // Placed on the map explicitly, or embedded in a note (![[src]]) — both are
  // deliberate acts, so both count as "on the map".
  const included = new Set(data.map.included ?? [])
  for (const n of data.notes) {
    for (const embedId of extractSourceEmbeds(n.body)) included.add(embedId)
  }
  for (const s of data.sources) {
    if (!included.has(s.id)) continue
    add({ id: s.id, label: s.title, type: 'source', kind: s.kind, tags: s.tags })
  }
  const noteBySlug = new Map<string, NoteInfo>()
  for (const n of data.notes) {
    noteBySlug.set(n.id, n)
    add({ id: noteNodeId(n.id), label: n.title, type: 'note', tags: n.tags })
  }
  for (const c of data.map.concepts) {
    add({ id: conceptNodeId(c.id), label: c.title, type: 'concept', tags: c.tags, color: c.color })
  }

  const edges: GraphEdge[] = []
  const edgeKeys = new Set<string>()
  const pushEdge = (from: string, to: string, kind: MapEdge['kind'], label?: string): void => {
    if (from === to || !nodeIds.has(from) || !nodeIds.has(to)) return
    // Undirected de-dupe for tag/mention; keep direction for wikilink/ai.
    const key =
      kind === 'tag' || kind === 'mention'
        ? [from, to].sort().join('|') + `|${kind}`
        : `${from}|${to}|${kind}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ id: `e-${edges.length}-${kind}`, from, to, kind, label })
  }

  // 1. Wikilink + embed edges from note bodies.
  for (const n of data.notes) {
    const src = noteNodeId(n.id)
    for (const target of extractWikilinks(n.body)) {
      const targetSlug = noteSlug(target)
      if (noteBySlug.has(targetSlug)) pushEdge(src, noteNodeId(targetSlug), 'wikilink')
    }
    for (const embedId of extractSourceEmbeds(n.body)) {
      if (nodeIds.has(embedId)) pushEdge(src, embedId, 'wikilink')
    }
  }

  // 2. Persisted manual + AI edges from map.json (explicit user connections).
  for (const e of data.map.edges) pushEdge(e.from, e.to, e.kind, e.label)

  // 2b. Name mentions: a note whose text contains another node's title links
  //     to it automatically (concepts and notes; plus concepts named in source
  //     titles). Pairs already joined by a wikilink are skipped.
  if (opts.mentionLinks !== false) {
    const alreadyLinked = (a: string, b: string): boolean =>
      edgeKeys.has(`${a}|${b}|wikilink`) || edgeKeys.has(`${b}|${a}|wikilink`)
    const targets = nodes
      .filter((n) => n.type === 'concept' || n.type === 'note')
      .map((n) => ({ id: n.id, label: n.label.toLowerCase().trim() }))
      .filter((t) => t.label.length >= 3)
    for (const n of data.notes) {
      const from = noteNodeId(n.id)
      if (!nodeIds.has(from)) continue
      const hay = `${n.title}\n${n.body}`.toLowerCase()
      for (const target of targets) {
        if (target.id === from || alreadyLinked(from, target.id)) continue
        if (mentions(hay, target.label)) pushEdge(from, target.id, 'mention')
      }
    }
    const concepts = targets.filter((t) => t.id.startsWith('concept:'))
    for (const s of data.sources) {
      if (!nodeIds.has(s.id)) continue
      const hay = s.title.toLowerCase()
      for (const target of concepts) {
        if (mentions(hay, target.label)) pushEdge(s.id, target.id, 'mention')
      }
    }
  }

  // 3. Optional tag-similarity edges — only when the user turns them on, and
  //    even then kept conservative: each shared tag scores by specificity
  //    (multi-word and rarer tags count more), a pair needs real accumulated
  //    evidence to link, and every node keeps only its few strongest links.
  if (opts.tagLinks) {
    const byTag = new Map<string, string[]>()
    for (const node of nodes) {
      for (const tag of node.tags) {
        if (tag.length < 3) continue
        if (!byTag.has(tag)) byTag.set(tag, [])
        byTag.get(tag)!.push(node.id)
      }
    }
    interface PairScore {
      a: string
      b: string
      score: number
      bestTag: string
      bestSpec: number
    }
    const pairs = new Map<string, PairScore>()
    for (const [tag, ids] of byTag) {
      if (ids.length < 2 || ids.length > 8) continue // hub tags are noise, skip
      const multiWord = tag.includes('-') || tag.includes(' ')
      const specificity = (multiWord ? 2 : 1) / Math.log2(1 + ids.length)
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join('|')
          const p = pairs.get(key) ?? { a: ids[i], b: ids[j], score: 0, bestTag: tag, bestSpec: 0 }
          p.score += specificity
          if (specificity > p.bestSpec) {
            p.bestSpec = specificity
            p.bestTag = tag
          }
          pairs.set(key, p)
        }
      }
    }
    const MIN_PAIR_SCORE = 0.85 // one specific multi-word tag, or ~two shared unigrams
    const MAX_TAG_EDGES_PER_NODE = 3
    const tagDegree = new Map<string, number>()
    const ranked = [...pairs.values()]
      .filter((p) => p.score >= MIN_PAIR_SCORE)
      .sort((x, y) => y.score - x.score)
    for (const p of ranked) {
      const da = tagDegree.get(p.a) ?? 0
      const db = tagDegree.get(p.b) ?? 0
      if (da >= MAX_TAG_EDGES_PER_NODE || db >= MAX_TAG_EDGES_PER_NODE) continue
      pushEdge(p.a, p.b, 'tag', `#${p.bestTag}`)
      tagDegree.set(p.a, da + 1)
      tagDegree.set(p.b, db + 1)
    }
  }

  return { nodes, edges }
}

/** Node ids the map exposes for manual linking, keyed for map.json persistence. */
export function graphNodeSummaries(graph: Graph): { id: string; label: string; tags: string[] }[] {
  return graph.nodes.map((n) => ({ id: n.id, label: n.label, tags: n.tags }))
}
