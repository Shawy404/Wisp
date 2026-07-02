// Wisp — © Shawy404. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { AiEdgeSuggestion, MapData } from '@shared/types'
import { buildGraph, type Graph } from '@shared/graph'
import { invoke, useApp } from '@/store'

const TYPE_COLOR: Record<string, string> = {
  source: '#8ab4f8',
  note: '#7dd3a8',
  concept: '#c58af8'
}

function toElements(graph: Graph): ElementDefinition[] {
  const nodes = graph.nodes.map((n) => ({
    data: { id: n.id, label: n.label, type: n.type },
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
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#d4d4d4',
            'font-size': '9px',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            width: 16,
            height: 16,
            'background-color': (el: cytoscape.NodeSingular) => TYPE_COLOR[el.data('type')] ?? '#888',
            'border-width': 0
          }
        },
        { selector: 'node.concept', style: { shape: 'diamond', width: 18, height: 18 } },
        { selector: 'node.source', style: { shape: 'round-rectangle' } },
        {
          selector: 'edge',
          style: {
            width: 1.4,
            'line-color': '#3f3f46',
            'target-arrow-color': '#3f3f46',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '7px',
            color: '#71717a',
            'text-rotation': 'autorotate'
          }
        },
        {
          selector: 'edge.tag',
          style: { 'line-style': 'dashed', 'line-color': '#3f3f46', opacity: 0.55 }
        },
        {
          selector: 'edge.wikilink',
          style: { 'line-color': '#7dd3a8', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#7dd3a8', width: 1.6 }
        },
        {
          selector: 'edge.manual',
          style: { 'line-color': '#a1a1aa', width: 2, 'target-arrow-shape': 'triangle', 'target-arrow-color': '#a1a1aa' }
        },
        {
          selector: 'edge.ai-suggested',
          style: { 'line-color': '#f8b48a', 'line-style': 'dotted', width: 1.8, 'target-arrow-shape': 'triangle', 'target-arrow-color': '#f8b48a' }
        },
        { selector: '.link-source', style: { 'border-width': 3, 'border-color': '#f8b48a' } }
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: 6000, idealEdgeLength: 90 },
      wheelSensitivity: 0.2
    })

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
        setHint('İkinci düğüme Shift+tıkla — bağ oluşsun.')
      } else if (linkFrom.current !== id && activeRoomId) {
        void invoke('map:addEdge', activeRoomId, linkFrom.current, id, 'manual').then(() =>
          useApp.getState().refreshRoomData()
        )
        linkFrom.current = null
        cy.current?.nodes().removeClass('link-source')
        setHint('')
      }
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
    c.layout({ name: 'cose', animate: false, nodeRepulsion: 6000, idealEdgeLength: 90 }).run()
    c.fit(undefined, 40)
  }, [graph])

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
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TYPE_COLOR.note }} /> not
            <span className="ml-2 inline-block h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR.source }} /> kaynak
            <span className="ml-2 inline-block h-2 w-2 rotate-45" style={{ background: TYPE_COLOR.concept }} /> kavram
          </div>
          <div>— kesikli: etiket bağı · yeşil ok: wikilink · gri: manuel · turuncu nokta: AI</div>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1 text-[10px] text-neutral-600">
          <span>Shift+tıkla iki düğüm → bağ · Alt+tıkla bağ → sil</span>
          {hint && <span className="text-accent">{hint}</span>}
        </div>
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600">
            Bu odada henüz düğüm yok — kaynak topla, not yaz, kavram ekle.
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
            {aiState === 'loading' ? 'Bağlantılar aranıyor…' : '✦ Bağlantıları bul (AI)'}
          </button>
          {aiState === 'error' && <div className="mt-2 text-[10px] text-red-400">{aiError}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {suggestions.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] tracking-wide text-neutral-500 uppercase">
                AI önerileri
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
                      Kalıcı bağ yap
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] tracking-wide text-neutral-500 uppercase">
                Kavram düğümleri
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
                placeholder="Kavram adı…"
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
                <div className="px-1 py-2 text-[10px] text-neutral-600">
                  Kavram düğümü ekle, sonra kaynak/notlarla bağla.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 p-3 text-[10px] text-neutral-600">
          {graph.nodes.length} düğüm · {graph.edges.length} bağ
        </div>
      </div>
    </div>
  )
}
