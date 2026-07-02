// Wisp — © Shawy404. All rights reserved.
import type { MapData, MapEdge, NoteInfo, RoomData, SourceItem } from './types'
import { extractSourceEmbeds, extractWikilinks, noteSlug } from './wikilink'

export interface GraphNode {
  id: string
  label: string
  type: 'source' | 'note' | 'concept'
  kind?: SourceItem['kind']
  tags: string[]
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

const noteNodeId = (id: string): string => `note:${id}`
const conceptNodeId = (id: string): string => `concept:${id}`

/**
 * The single source of truth for the map. Notes, sources and concept nodes are
 * the *same* objects the sidebar shows — here they become graph nodes. Edges
 * come from three places, unified:
 *   1. wikilink   — [[note]] / ![[src-id]] references in note bodies
 *   2. tag        — two nodes sharing a tag get a soft "suggested" edge
 *   3. manual/ai  — persisted edges from map.json (drag-to-link, AI suggestions)
 * Editing any underlying object and rebuilding keeps all three views in sync.
 */
export function buildGraph(data: RoomData): Graph {
  const nodes: GraphNode[] = []
  const nodeIds = new Set<string>()
  const add = (n: GraphNode): void => {
    if (!nodeIds.has(n.id)) {
      nodeIds.add(n.id)
      nodes.push(n)
    }
  }

  for (const s of data.sources) {
    add({ id: s.id, label: s.title, type: 'source', kind: s.kind, tags: s.tags })
  }
  const noteBySlug = new Map<string, NoteInfo>()
  for (const n of data.notes) {
    noteBySlug.set(n.id, n)
    add({ id: noteNodeId(n.id), label: n.title, type: 'note', tags: n.tags })
  }
  for (const c of data.map.concepts) {
    add({ id: conceptNodeId(c.id), label: c.title, type: 'concept', tags: c.tags })
  }

  const edges: GraphEdge[] = []
  const edgeKeys = new Set<string>()
  const pushEdge = (from: string, to: string, kind: MapEdge['kind'], label?: string): void => {
    if (from === to || !nodeIds.has(from) || !nodeIds.has(to)) return
    // Undirected de-dupe for tag/manual; keep direction for wikilink/ai.
    const key = kind === 'tag' ? [from, to].sort().join('|') + '|tag' : `${from}|${to}|${kind}`
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

  // 2. Tag-based suggested edges (free, deterministic, live).
  //
  // A single shared keyword is weak evidence — titles share generic words all
  // the time and the map drowned in junk edges. Instead every co-occurring tag
  // contributes a specificity score (multi-word tags count double, tags shared
  // by many nodes count less), a pair needs enough accumulated evidence to get
  // an edge at all, and each node keeps only its strongest few suggestions.
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

  // 3. Persisted manual + AI edges from map.json (highest authority — added last
  //    so a manual link on a pair also carrying a tag edge still renders solid).
  for (const e of data.map.edges) pushEdge(e.from, e.to, e.kind, e.label)

  return { nodes, edges }
}

/** Node ids the map exposes for manual linking, keyed for map.json persistence. */
export function graphNodeSummaries(graph: Graph): { id: string; label: string; tags: string[] }[] {
  return graph.nodes.map((n) => ({ id: n.id, label: n.label, tags: n.tags }))
}
