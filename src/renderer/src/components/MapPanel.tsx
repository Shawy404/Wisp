// Wisp — © Shawy404. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { AiEdgeSuggestion, MapData } from '@shared/types'
import { buildGraph, type Graph } from '@shared/graph'
import { THEMES } from '@shared/themes'
import { invoke, useApp, useT } from '@/store'

const TYPE_COLOR: Record<string, string> = {
  source: '#8ab4f8',
  note: '#7dd3a8',
  concept: '#c58af8'
}

/** Cytoscape can't use CSS vars, so mirror the shell palette per theme. */
interface MapColors {
  label: string
  labelOutline: string
  edge: string
  edgeLabel: string
}

function mapColors(themeId: string): MapColors {
  const light = THEMES.find((t) => t.id === themeId)?.light ?? false
  return light
    ? { label: '#3f3d38', labelOutline: 'rgba(250,249,246,0.85)', edge: '#c4bfb2', edgeLabel: '#8a8578' }
    : { label: '#d4d4d4', labelOutline: 'rgba(14,14,18,0.85)', edge: '#3f3f46', edgeLabel: '#8b8b93' }
}

function cyStyle(c: MapColors): cytoscape.StylesheetJson {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        color: c.label,
        'font-size': '10px',
        'text-wrap': 'wrap',
        'text-max-width': '110px',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-outline-width': 2,
        'text-outline-color': c.labelOutline,
        // Well-connected nodes read as more important.
        width: (el: cytoscape.NodeSingular) => 14 + Math.min(el.degree(false), 8) * 2,
        height: (el: cytoscape.NodeSingular) => 14 + Math.min(el.degree(false), 8) * 2,
        'background-color': (el: cytoscape.NodeSingular) => TYPE_COLOR[el.data('type')] ?? '#888',
        'border-width': 0
      }
    },
    { selector: 'node.concept', style: { shape: 'diamond' } },
    { selector: 'node.source', style: { shape: 'round-rectangle' } },
    {
      selector: 'edge',
      style: {
        width: 1.4,
        'line-color': c.edge,
        'target-arrow-color': c.edge,
        'curve-style': 'bezier',
        label: 'data(label)',
        'font-size': '8px',
        color: c.edgeLabel,
        'text-outline-width': 2,
        'text-outline-color': c.labelOutline,
        'text-rotation': 'autorotate'
      }
    },
    { selector: 'edge.tag', style: { 'line-style': 'dashed', opacity: 0.45 } },
    {
      selector: 'edge.wikilink',
      style: {
        'line-color': '#7dd3a8',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#7dd3a8',
        width: 1.6
      }
    },
    {
      selector: 'edge.manual',
      style: {
        'line-color': '#a1a1aa',
        width: 2,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#a1a1aa'
      }
    },
    {
      selector: 'edge.ai-suggested',
      style: {
        'line-color': '#f8b48a',
        'line-style': 'dotted',
        width: 1.8,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#f8b48a'
      }
    },
    {
      selector: 'node.hovered',
      style: { 'z-index': 99, 'font-size': '12px', 'text-outline-width': 3, color: c.label }
    },
    // Focus mode: everything outside the clicked node's neighbourhood dims.
    { selector: '.faded', style: { opacity: 0.12 } },
    { selector: '.link-source', style: { 'border-width': 3, 'border-color': '#f8b48a' } }
  ]
}

// A research room is mostly disconnected nodes with a few linked clusters.
// Plain cose stacks the loose nodes into an unreadable column, so connected
// components get laid out with cose and the leftover singletons are arranged
// in a tidy grid band underneath — nothing overlaps and clusters stay legible.
const COSE_LAYOUT = {
  name: 'cose',
  animate: false,
  nodeRepulsion: 20000,
  idealEdgeLength: 120,
  nodeOverlap: 24,
  componentSpacing: 140,
  gravity: 0.15,
  padding: 50,
  randomize: true
} as const

/**
 * Lays out the graph so it stays readable no matter how sparse it is: linked
 * nodes get a force-directed cluster up top, and the (usually many) unlinked
 * singletons are packed into a neat grid band below instead of collapsing into
 * an overlapping column.
 */
function runLayout(c: Core): void {
  const linked = c.nodes().filter((n) => n.degree(false) > 0)
  const singletons = c.nodes().filter((n) => n.degree(false) === 0)

  if (linked.length > 0) {
    linked.layout({ ...COSE_LAYOUT }).run()
  }

  const box = linked.length > 0 ? linked.boundingBox() : { x1: 0, x2: 0, y1: 0, y2: 0 }
  const clusterWidth = Math.max(box.x2 - box.x1, 600)
  const cols = Math.max(4, Math.round(Math.sqrt(singletons.length) * 1.6))
  const gap = 150
  const startX = box.x1
  const startY = (linked.length > 0 ? box.y2 : 0) + (linked.length > 0 ? 120 : 0)

  singletons.forEach((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    n.position({ x: startX + col * gap, y: startY + row * gap })
  })
  void clusterWidth

  c.fit(undefined, 50)
}

function toElements(graph: Graph): ElementDefinition[] {
  const nodes = graph.nodes.map((n) => ({
    data: {
      id: n.id,
      // Keep labels short so they don't overlap; the full title shows on hover.
      label: n.label.length > 28 ? n.label.slice(0, 27) + '…' : n.label,
      fullLabel: n.label,
      type: n.type
    },
    classes: n.type
  }))
  const edges = graph.edges.map((e) => ({
    data: { id: e.id, source: e.from, target: e.to, label: e.label ?? '', kind: e.kind },
    classes: e.kind
  }))
  return [...nodes, ...edges]
}

type NodeType = 'source' | 'note' | 'concept'

interface CtxMenu {
  x: number
  y: number
  nodeId?: string
  nodeType?: NodeType
  edgeId?: string
  edgeKind?: string
}

export default function MapPanel(): React.JSX.Element {
  const sources = useApp((s) => s.sources)
  const notes = useApp((s) => s.notes)
  const map = useApp((s) => s.map)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const themeId = useApp((s) => s.config?.theme ?? 'dark')
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const linkFrom = useRef<string | null>(null)

  const [suggestions, setSuggestions] = useState<AiEdgeSuggestion[]>([])
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiError, setAiError] = useState('')
  const [addingConcept, setAddingConcept] = useState(false)
  const [conceptName, setConceptName] = useState('')
  const [hint, setHint] = useState('')

  // View filters — edges stay explicit by default; tag links are opt-in.
  const [showTypes, setShowTypes] = useState<Record<NodeType, boolean>>({
    source: true,
    note: true,
    concept: true
  })
  const [showTagLinks, setShowTagLinks] = useState(false)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)

  const hiddenCount = map.hidden?.length ?? 0

  // Build with explicit edges only (tag links opt-in), minus hidden nodes, then
  // apply the node-type view filter and drop edges that lose an endpoint.
  const graph = useMemo(() => {
    const g = buildGraph(
      { meta: {} as never, sources, notes, map },
      { tagLinks: showTagLinks, hidden: new Set(map.hidden ?? []) }
    )
    const nodes = g.nodes.filter((n) => showTypes[n.type])
    const kept = new Set(nodes.map((n) => n.id))
    const edges = g.edges.filter((e) => kept.has(e.from) && kept.has(e.to))
    return { nodes, edges }
  }, [sources, notes, map, showTagLinks, showTypes])

  const applyRoomData = (): Promise<void> => useApp.getState().refreshRoomData()

  useEffect(() => {
    if (!host.current) return
    cy.current = cytoscape({
      container: host.current,
      elements: toElements(graph),
      style: cyStyle(mapColors(useApp.getState().config?.theme ?? 'dark')),
      layout: { name: 'preset' },
      wheelSensitivity: 0.2
    })
    runLayout(cy.current)

    const focusNode = (target: cytoscape.NodeSingular): void => {
      const c = cy.current
      if (!c) return
      const hood = target.closedNeighborhood()
      c.elements().addClass('faded')
      hood.removeClass('faded')
      target.removeClass('faded')
    }
    const clearFocus = (): void => {
      cy.current?.elements().removeClass('faded')
    }

    cy.current.on('tap', 'node', (evt) => {
      setCtx(null)
      const id = evt.target.id()
      // Shift-click chains two nodes into a manual link.
      if (evt.originalEvent.shiftKey) {
        if (!linkFrom.current) {
          linkFrom.current = id
          evt.target.addClass('link-source')
          setHint(t('map.hint.shiftSecond'))
        } else if (linkFrom.current !== id && activeRoomId) {
          void invoke('map:addEdge', activeRoomId, linkFrom.current, id, 'manual').then(applyRoomData)
          linkFrom.current = null
          cy.current?.nodes().removeClass('link-source')
          setHint('')
        }
        return
      }
      // Plain click focuses the node and its neighbours (Obsidian-style).
      linkFrom.current = null
      cy.current?.nodes().removeClass('link-source')
      focusNode(evt.target as cytoscape.NodeSingular)
    })

    // Click empty canvas: clear focus and any open menu.
    cy.current.on('tap', (evt) => {
      if (evt.target === cy.current) {
        clearFocus()
        setCtx(null)
      }
    })

    // Right-click a node or edge → context menu (hide / delete).
    cy.current.on('cxttap', 'node', (evt) => {
      evt.originalEvent.preventDefault()
      const p = evt.renderedPosition
      setCtx({
        x: p.x,
        y: p.y,
        nodeId: evt.target.id(),
        nodeType: evt.target.data('type') as NodeType
      })
    })
    cy.current.on('cxttap', 'edge', (evt) => {
      evt.originalEvent.preventDefault()
      const p = evt.renderedPosition
      setCtx({ x: p.x, y: p.y, edgeId: evt.target.id(), edgeKind: evt.target.data('kind') })
    })

    // Hover shows the full title and lifts the node.
    cy.current.on('mouseover', 'node', (evt) => {
      evt.target.data('label', evt.target.data('fullLabel'))
      evt.target.addClass('hovered')
    })
    cy.current.on('mouseout', 'node', (evt) => {
      const full = evt.target.data('fullLabel') as string
      evt.target.data('label', full.length > 28 ? full.slice(0, 27) + '…' : full)
      evt.target.removeClass('hovered')
    })

    return () => {
      cy.current?.destroy()
      cy.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild elements when the underlying room data or filters change.
  useEffect(() => {
    if (!cy.current) return
    const c = cy.current
    c.batch(() => {
      c.elements().remove()
      c.add(toElements(graph))
    })
    runLayout(c)
  }, [graph])

  // Follow theme switches live — cytoscape can't read CSS variables itself.
  useEffect(() => {
    cy.current?.style(cyStyle(mapColors(themeId)))
  }, [themeId])

  const hideNode = async (nodeId: string): Promise<void> => {
    if (!activeRoomId) return
    setCtx(null)
    await invoke('map:hideNode', activeRoomId, nodeId)
    await applyRoomData()
  }
  const deleteEdge = async (edgeId: string): Promise<void> => {
    if (!activeRoomId) return
    setCtx(null)
    await invoke('map:removeEdge', activeRoomId, edgeId)
    await applyRoomData()
  }
  const deleteConcept = async (nodeId: string): Promise<void> => {
    if (!activeRoomId) return
    setCtx(null)
    await invoke('map:removeConcept', activeRoomId, nodeId.replace(/^concept:/, ''))
    await applyRoomData()
  }
  const clearHidden = async (): Promise<void> => {
    if (!activeRoomId) return
    await invoke('map:clearHidden', activeRoomId)
    await applyRoomData()
  }

  const runSuggest = async (): Promise<void> => {
    if (!activeRoomId) return
    setAiState('loading')
    setAiError('')
    const res = await invoke<{ suggestions: AiEdgeSuggestion[]; error?: string }>(
      'map:suggestLinks',
      activeRoomId
    )
    if (res.error) {
      setAiState('error')
      setAiError(res.error)
    } else {
      setAiState('idle')
      setSuggestions(res.suggestions)
    }
  }

  const acceptSuggestion = async (s: AiEdgeSuggestion): Promise<void> => {
    if (!activeRoomId) return
    await invoke('map:addEdge', activeRoomId, s.from, s.to, 'ai-suggested', s.label)
    setSuggestions((prev) => prev.filter((x) => !(x.from === s.from && x.to === s.to)))
    await useApp.getState().refreshRoomData()
  }

  const addConcept = async (): Promise<void> => {
    if (!activeRoomId || !conceptName.trim()) return
    await invoke('map:addConcept', activeRoomId, conceptName.trim())
    setConceptName('')
    setAddingConcept(false)
    await useApp.getState().refreshRoomData()
  }

  const labelFor = (id: string): string => graph.nodes.find((n) => n.id === id)?.label ?? id

  const TypeChip = ({ type, label }: { type: NodeType; label: string }): React.JSX.Element => (
    <button
      onClick={() => setShowTypes((s) => ({ ...s, [type]: !s[type] }))}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
        showTypes[type]
          ? 'border-neutral-700 bg-neutral-850 text-neutral-200'
          : 'border-neutral-850 text-neutral-600'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 ${type === 'concept' ? 'rotate-45' : type === 'source' ? 'rounded-sm' : 'rounded-full'}`}
        style={{ background: showTypes[type] ? TYPE_COLOR[type] : '#52525b' }}
      />
      {label}
    </button>
  )

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-neutral-950">
      <div className="relative min-w-0 flex-1" onClick={() => setCtx(null)}>
        <div ref={host} className="h-full w-full" />

        {/* Filter bar: what shows on the map. Tag links are off by default. */}
        <div className="pointer-events-auto absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          <TypeChip type="source" label={t('map.legend.source')} />
          <TypeChip type="note" label={t('map.legend.note')} />
          <TypeChip type="concept" label={t('map.legend.concept')} />
          <button
            onClick={() => setShowTagLinks((v) => !v)}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
              showTagLinks
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-neutral-850 text-neutral-600'
            }`}
            title={t('map.tagLinks.hint')}
          >
            {t('map.tagLinks')}
          </button>
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col items-end gap-1 text-[10px] text-neutral-600">
          <span>{t('map.hint.interact')}</span>
          {hint && <span className="text-accent">{hint}</span>}
        </div>

        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600">
            {t('map.empty')}
          </div>
        )}

        {/* Right-click context menu */}
        {ctx && (
          <div
            className="absolute z-50 min-w-[140px] overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 py-1 text-xs shadow-2xl shadow-black/50"
            style={{ left: ctx.x, top: ctx.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {ctx.nodeId && ctx.nodeType === 'concept' && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => void deleteConcept(ctx.nodeId!)}
              >
                {t('map.ctx.deleteConcept')}
              </button>
            )}
            {ctx.nodeId && ctx.nodeType !== 'concept' && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => void hideNode(ctx.nodeId!)}
              >
                {t('map.ctx.hideNode')}
              </button>
            )}
            {ctx.edgeId && (ctx.edgeKind === 'manual' || ctx.edgeKind === 'ai-suggested') && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => void deleteEdge(ctx.edgeId!)}
              >
                {t('map.ctx.deleteLink')}
              </button>
            )}
            {ctx.edgeId && ctx.edgeKind !== 'manual' && ctx.edgeKind !== 'ai-suggested' && (
              <div className="px-3 py-1.5 text-neutral-600">{t('map.ctx.derivedLink')}</div>
            )}
          </div>
        )}
      </div>

      <div className="flex w-64 flex-col border-l border-neutral-800">
        <div className="border-b border-neutral-800 p-3">
          <button
            className="w-full rounded-md bg-accent/15 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
            onClick={() => void runSuggest()}
            disabled={aiState === 'loading'}
          >
            {aiState === 'loading' ? t('map.suggesting') : t('map.suggestLinks')}
          </button>
          {aiState === 'error' && <div className="mt-2 text-[10px] text-red-400">{aiError}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {suggestions.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] tracking-wide text-neutral-500 uppercase">
                {t('map.aiSuggestions')}
              </div>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <div key={i} className="rounded-md border border-neutral-800 bg-neutral-900/60 p-2">
                    <div className="text-[11px] text-neutral-300">
                      <span className="text-accent">{labelFor(s.from)}</span> → {labelFor(s.to)}
                    </div>
                    <div className="mt-0.5 text-[10px] text-neutral-500">{s.label}</div>
                    <button
                      className="mt-1 rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-700"
                      onClick={() => void acceptSuggestion(s)}
                    >
                      {t('map.makePermanent')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] tracking-wide text-neutral-500 uppercase">
                {t('map.conceptNodes')}
              </span>
              <button
                className="text-neutral-500 hover:text-neutral-200"
                onClick={() => setAddingConcept(true)}
              >
                +
              </button>
            </div>
            {addingConcept && (
              <input
                autoFocus
                value={conceptName}
                onChange={(e) => setConceptName(e.target.value)}
                placeholder={t('map.conceptPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addConcept()
                  if (e.key === 'Escape') setAddingConcept(false)
                }}
                onBlur={() => setAddingConcept(false)}
                className="mb-1.5 w-full rounded-md border border-accent/50 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-100 outline-none"
              />
            )}
            <div className="space-y-0.5">
              {map.concepts.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-neutral-400 hover:bg-neutral-850"
                >
                  <span className="inline-block h-2 w-2 rotate-45" style={{ background: TYPE_COLOR.concept }} />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <button
                    className="hidden text-neutral-600 group-hover:inline hover:text-red-400"
                    onClick={() =>
                      activeRoomId &&
                      void invoke('map:removeConcept', activeRoomId, c.id).then(() =>
                        useApp.getState().refreshRoomData()
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              {map.concepts.length === 0 && !addingConcept && (
                <div className="px-1 py-2 text-[10px] text-neutral-600">{t('map.noConcepts')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 p-3 text-[10px] text-neutral-600">
          <div>{t('map.stats', { nodes: graph.nodes.length, edges: graph.edges.length })}</div>
          {hiddenCount > 0 && (
            <button
              className="mt-1 text-neutral-500 underline decoration-dotted hover:text-neutral-300"
              onClick={() => void clearHidden()}
            >
              {t('map.hidden.restore', { count: hiddenCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
