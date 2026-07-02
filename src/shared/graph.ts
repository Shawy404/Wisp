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
  const byTag = new Map<string, string[]>()
  for (const node of nodes) {
    for (const tag of node.tags) {
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag)!.push(node.id)
    }
  }
  for (const [tag, ids] of byTag) {
    if (ids.length < 2 || ids.length > 8) continue // skip noise-hub tags
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) pushEdge(ids[i], ids[j], 'tag', `#${tag}`)
    }
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
