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

  const graph = useMemo(
    () => buildGraph({ meta: {} as never, sources, notes, map }),
    [sources, notes, map]
  )

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

    // Shift-click two nodes to create a manual edge between them.
    cy.current.on('tap', 'node', (evt) => {
      const id = evt.target.id()
      if (!evt.originalEvent.shiftKey) {
        linkFrom.current = null
        cy.current?.nodes().removeClass('link-source')
        return
      }
      if (!linkFrom.current) {
        linkFrom.current = id
        evt.target.addClass('link-source')
        setHint(t('map.hint.shiftSecond'))
      } else if (linkFrom.current !== id && activeRoomId) {
        void invoke('map:addEdge', activeRoomId, linkFrom.current, id, 'manual').then(() =>
          useApp.getState().refreshRoomData()
        )
        linkFrom.current = null
        cy.current?.nodes().removeClass('link-source')
        setHint('')
      }
    })

    // Hover: show the full title and dim everything else so the node stands out.
    cy.current.on('mouseover', 'node', (evt) => {
      evt.target.data('label', evt.target.data('fullLabel'))
      evt.target.addClass('hovered')
    })
    cy.current.on('mouseout', 'node', (evt) => {
      const full = evt.target.data('fullLabel') as string
      evt.target.data('label', full.length > 28 ? full.slice(0, 27) + '…' : full)
      evt.target.removeClass('hovered')
    })

    cy.current.on('tap', 'edge', (evt) => {
      const kind = evt.target.data('kind')
      if ((kind === 'manual' || kind === 'ai-suggested') && activeRoomId && evt.originalEvent.altKey) {
        void invoke('map:removeEdge', activeRoomId, evt.target.id()).then(() =>
          useApp.getState().refreshRoomData()
        )
      }
    })

    return () => {
      cy.current?.destroy()
      cy.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild elements when the underlying room data changes, so edits made in
  // the sources list or the note editor show up here immediately.
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

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-neutral-950">
      <div className="relative min-w-0 flex-1">
        <div ref={host} className="h-full w-full" />
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 text-[10px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TYPE_COLOR.note }} />{' '}
            {t('map.legend.note')}
            <span className="ml-2 inline-block h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR.source }} />{' '}
            {t('map.legend.source')}
            <span className="ml-2 inline-block h-2 w-2 rotate-45" style={{ background: TYPE_COLOR.concept }} />{' '}
            {t('map.legend.concept')}
          </div>
          <div>{t('map.legend.edges')}</div>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1 text-[10px] text-neutral-600">
          <span>{t('map.hint.shiftAlt')}</span>
          {hint && <span className="text-accent">{hint}</span>}
        </div>
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600">
            {t('map.empty')}
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
          {t('map.stats', { nodes: graph.nodes.length, edges: graph.edges.length })}
        </div>
      </div>
    </div>
  )
}
