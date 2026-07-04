// Wisp — © Shawy404. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { MapData } from '@shared/types'
import type { TKey } from '@shared/i18n'
import { buildGraph, type Graph } from '@shared/graph'
import { highlightUrl } from '@shared/address'
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
  nodeBg: string
}

function mapColors(themeId: string): MapColors {
  const light = THEMES.find((t) => t.id === themeId)?.light ?? false
  return light
    ? {
        label: '#3f3d38',
        labelOutline: 'rgba(250,249,246,0.85)',
        edge: '#c4bfb2',
        edgeLabel: '#8a8578',
        nodeBg: '#f2f0ea'
      }
    : {
        label: '#d4d4d4',
        labelOutline: 'rgba(14,14,18,0.85)',
        edge: '#3f3f46',
        edgeLabel: '#8b8b93',
        nodeBg: '#17171b'
      }
}

function cyStyle(c: MapColors): cytoscape.StylesheetJson {
  return [
    // Nodes are labeled boxes — dark pill with a type-colored border, like a
    // proper diagram, instead of dots with captions hanging underneath.
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle',
        label: 'data(label)',
        color: c.label,
        'font-size': '10px',
        'text-wrap': 'wrap',
        'text-max-width': '130px',
        'text-valign': 'center',
        'text-halign': 'center',
        width: 'label',
        height: 16,
        padding: '8px',
        'background-color': c.nodeBg,
        'background-opacity': 1,
        'border-width': 1.4,
        'border-color': (el: cytoscape.NodeSingular) =>
          (el.data('color') as string) || TYPE_COLOR[el.data('type')] || '#888'
      }
    },
    // Image sources with a loaded picture show the photo itself as the node.
    // Size comes from data(size) so photos are resizable per node.
    {
      selector: 'node.image',
      style: {
        width: 'data(size)',
        height: 'data(size)',
        'background-image': 'data(img)',
        'background-fit': 'cover',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-outline-width': 2,
        'text-outline-color': c.labelOutline,
        padding: '0px'
      }
    },
    // Strong (deliberate) links are solid, derived ones dashed — no arrowheads.
    {
      selector: 'edge',
      style: {
        width: 1.3,
        'line-color': c.edge,
        'curve-style': 'straight',
        label: 'data(label)',
        'font-size': '8px',
        color: c.edgeLabel,
        'text-outline-width': 2,
        'text-outline-color': c.labelOutline,
        'text-rotation': 'autorotate'
      }
    },
    { selector: 'edge.manual', style: { 'line-color': '#a1a1aa', width: 1.6 } },
    { selector: 'edge.wikilink', style: { 'line-color': '#7dd3a8', opacity: 0.9 } },
    {
      selector: 'edge.tag',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [3, 5], opacity: 0.35 }
    },
    {
      selector: 'edge.mention',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [2, 6], 'line-color': '#8ab4f8', opacity: 0.5 }
    },
    {
      selector: 'edge.ai-suggested',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [2, 4], 'line-color': '#f8b48a', width: 1.5 }
    },
    // Per-edge style override (the context menu's — / - - / ··· choices).
    { selector: 'edge[lineStyle = "solid"]', style: { 'line-style': 'solid' } },
    {
      selector: 'edge[lineStyle = "dashed"]',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [7, 5] }
    },
    { selector: 'edge[lineStyle = "dotted"]', style: { 'line-style': 'dotted' } },
    {
      selector: 'node.hovered',
      style: { 'z-index': 99, 'font-size': '11px', 'border-width': 2 }
    },
    // Box-selected (shift+drag) nodes glow so group moves read clearly.
    {
      selector: 'node:selected',
      style: { 'border-width': 2.5, 'border-color': '#f8b48a' }
    },
    { selector: 'edge:selected', style: { 'line-color': '#f8b48a' } },
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

type NodePositions = Record<string, { x: number; y: number }>

/**
 * Lays out the graph so it stays readable no matter how sparse it is — while
 * never touching a node the user has placed by hand (`pinned`). Free linked
 * nodes get a force-directed cluster, and free unlinked singletons are packed
 * into a neat grid band below instead of collapsing into an overlapping column.
 */
function runLayout(c: Core, pinned: Set<string>): void {
  const freeLinked = c.nodes().filter((n) => !pinned.has(n.id()) && n.degree(false) > 0)
  const freeSingletons = c.nodes().filter((n) => !pinned.has(n.id()) && n.degree(false) === 0)

  if (freeLinked.length > 0) {
    freeLinked.layout({ ...COSE_LAYOUT }).run()
  }

  // The grid band starts below everything that already has a place: pinned
  // nodes and the laid-out cluster.
  const anchored = c.nodes().filter((n) => pinned.has(n.id()) || n.degree(false) > 0)
  const box = anchored.length > 0 ? anchored.boundingBox() : { x1: 0, x2: 0, y1: 0, y2: 0 }
  const cols = Math.max(4, Math.round(Math.sqrt(freeSingletons.length) * 1.6))
  const gap = 150
  const startX = box.x1
  const startY = anchored.length > 0 ? box.y2 + 120 : 0

  freeSingletons.forEach((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    n.position({ x: startX + col * gap, y: startY + row * gap })
  })

  c.fit(undefined, 50)
}

function toElements(
  graph: Graph,
  positions: NodePositions,
  images: Record<string, string>,
  sizes: Record<string, number>
): ElementDefinition[] {
  const nodes = graph.nodes.map((n) => {
    // Image sources whose picture has resolved render as a photo node.
    const img = n.type === 'source' && n.kind === 'image' ? images[n.id] : undefined
    return {
      data: {
        id: n.id,
        // Keep labels short so they don't overlap; the full title shows on hover.
        label: n.label.length > 28 ? n.label.slice(0, 27) + '…' : n.label,
        fullLabel: n.label,
        type: n.type,
        ...(n.color ? { color: n.color } : {}),
        ...(img ? { img, size: sizes[n.id] ?? 52 } : {})
      },
      position: positions[n.id] ? { ...positions[n.id] } : undefined,
      classes: img ? `${n.type} image` : n.type
    }
  })
  const edges = graph.edges.map((e) => ({
    data: {
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.label ?? '',
      kind: e.kind,
      ...(e.style ? { lineStyle: e.style } : {})
    },
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
  isImage?: boolean
  edgeId?: string
  edgeKind?: string
  /** >1 when the right-clicked element is part of a multi-selection. */
  selCount?: number
}

interface Renaming {
  x: number
  y: number
  nodeId: string
  nodeType: NodeType
  value: string
}

/** Card shown on double-click for nodes that have nothing external to open. */
interface NodeInfo {
  title: string
  typeLabel: string
  img?: string
  url?: string
  neighbors: string[]
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
  const [showMentionLinks, setShowMentionLinks] = useState(true)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const [renaming, setRenaming] = useState<Renaming | null>(null)
  const [edgeEdit, setEdgeEdit] = useState<{ x: number; y: number; edgeId: string; value: string } | null>(null)
  const [tplOpen, setTplOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<
    { index: number; at: string; concepts: number; edges: number; included: number }[]
  >([])
  const [info, setInfo] = useState<NodeInfo | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)

  // Resolved image URLs for image-kind sources (local clips come through the
  // main process as data URLs). Mirrored in a ref for the cytoscape handlers.
  const [images, setImages] = useState<Record<string, string>>({})
  const imagesRef = useRef(images)
  imagesRef.current = images
  useEffect(() => {
    for (const s of sources) {
      if (s.kind !== 'image' || images[s.id]) continue
      if (s.clipFile && activeRoomId) {
        void invoke<string | null>('clips:dataUrl', activeRoomId, s.clipFile).then((url) => {
          const src = url ?? s.imageUrl
          if (src) setImages((prev) => (prev[s.id] ? prev : { ...prev, [s.id]: src }))
        })
      } else if (s.imageUrl) {
        setImages((prev) => (prev[s.id] ? prev : { ...prev, [s.id]: s.imageUrl! }))
      }
    }
  }, [sources, activeRoomId, images])

  // Hand-placed coordinates, kept in a ref so the long-lived cytoscape event
  // handlers always see the latest set (drags update it without a re-render).
  const positionsRef = useRef<NodePositions>({})
  positionsRef.current = { ...(map.positions ?? {}), ...positionsRef.current }
  // Per-node size overrides (resizable photos), same freshness trick.
  const sizesRef = useRef<Record<string, number>>({})
  sizesRef.current = map.sizes ?? {}

  const hiddenCount = map.hidden?.length ?? 0

  // Build with explicit edges only (tag links opt-in), minus hidden nodes, then
  // apply the node-type view filter and drop edges that lose an endpoint.
  // Sources only enter the graph once placed on the map (map.included / embeds).
  const fullGraph = useMemo(
    () =>
      buildGraph(
        { meta: {} as never, sources, notes, map },
        { tagLinks: showTagLinks, mentionLinks: showMentionLinks, hidden: new Set(map.hidden ?? []) }
      ),
    [sources, notes, map, showTagLinks, showMentionLinks]
  )
  const graph = useMemo(() => {
    const nodes = fullGraph.nodes.filter((n) => showTypes[n.type])
    const kept = new Set(nodes.map((n) => n.id))
    const edges = fullGraph.edges.filter((e) => kept.has(e.from) && kept.has(e.to))
    return { nodes, edges }
  }, [fullGraph, showTypes])

  // The library: collected sources that are not on the canvas yet. Drag one
  // onto the map (or hit its ＋) to place it.
  const onMapIds = useMemo(() => new Set(fullGraph.nodes.map((n) => n.id)), [fullGraph])
  const librarySources = useMemo(
    () =>
      sources
        .filter((s) => !onMapIds.has(s.id))
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [sources, onMapIds]
  )

  const placeOnMap = async (sourceId: string, pos?: { x: number; y: number }): Promise<void> => {
    if (!activeRoomId) return
    if (pos) positionsRef.current[sourceId] = pos
    await invoke('map:includeNode', activeRoomId, sourceId, pos)
    await useApp.getState().refreshRoomData()
  }
  const removeFromMap = async (sourceId: string): Promise<void> => {
    if (!activeRoomId) return
    setCtx(null)
    await invoke('map:excludeNode', activeRoomId, sourceId)
    await useApp.getState().refreshRoomData()
  }

  const applyRoomData = (): Promise<void> => useApp.getState().refreshRoomData()

  useEffect(() => {
    if (!host.current) return
    cy.current = cytoscape({
      container: host.current,
      elements: toElements(graph, positionsRef.current, imagesRef.current, sizesRef.current),
      style: cyStyle(mapColors(useApp.getState().config?.theme ?? 'dark')),
      layout: { name: 'preset' },
      wheelSensitivity: 0.6,
      // Shift+drag on empty canvas draws a selection box (plain drag pans).
      boxSelectionEnabled: true
    })
    runLayout(cy.current, new Set(Object.keys(positionsRef.current)))

    // A node stays exactly where the user drops it — persisted quietly so the
    // canvas doesn't re-layout mid-interaction. Dragging one node of a box
    // selection moves the whole selection, so persist every moved position.
    cy.current.on('dragfree', 'node', (evt) => {
      const target = evt.target as cytoscape.NodeSingular
      const moved = target.selected()
        ? cy.current!.$('node:selected').union(target)
        : target
      moved.forEach((n) => {
        const p = n.position()
        positionsRef.current[n.id()] = { x: p.x, y: p.y }
        if (activeRoomId) void invoke('map:setPosition', activeRoomId, n.id(), p.x, p.y)
      })
    })

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

    // Double-click opens what the node *is*: a website opens as a tab, a note
    // opens in the notes panel, an image/concept shows its info card.
    cy.current.on('dbltap', 'node', (evt) => {
      const node = evt.target as cytoscape.NodeSingular
      const id = node.id()
      const neighbors = node
        .neighborhood('node')
        .map((n) => n.data('fullLabel') as string)
      const app = useApp.getState()
      const src = app.sources.find((s) => s.id === id)
      if (src) {
        if (src.kind === 'image') {
          setInfo({
            title: src.title,
            typeLabel: t('map.info.type.image'),
            img: imagesRef.current[id] ?? src.imageUrl,
            url: src.url,
            neighbors
          })
        } else if (src.url) {
          app.newTab(highlightUrl(src.url, src.excerpt))
          app.setOverlay('none')
        } else {
          setInfo({ title: src.title, typeLabel: src.kind, neighbors })
        }
        return
      }
      if (id.startsWith('note:')) {
        app.requestNote(id.slice(5))
        return
      }
      if (id.startsWith('concept:')) {
        setInfo({
          title: node.data('fullLabel') as string,
          typeLabel: t('map.info.type.concept'),
          neighbors
        })
      }
    })

    // Right-click a node or edge → context menu (hide / delete).
    cy.current.on('cxttap', 'node', (evt) => {
      evt.originalEvent.preventDefault()
      const p = evt.renderedPosition
      const target = evt.target as cytoscape.NodeSingular
      const selected = cy.current!.$(':selected')
      setCtx({
        x: p.x,
        y: p.y,
        nodeId: target.id(),
        nodeType: target.data('type') as NodeType,
        isImage: target.hasClass('image'),
        selCount: target.selected() && selected.length > 1 ? selected.length : 0
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

  // Rebuild elements when the underlying room data, filters or resolved
  // images change.
  useEffect(() => {
    if (!cy.current) return
    const c = cy.current
    c.batch(() => {
      c.elements().remove()
      c.add(toElements(graph, positionsRef.current, images, sizesRef.current))
    })
    runLayout(c, new Set(Object.keys(positionsRef.current)))
  }, [graph, images, map.sizes])

  // Undo/redo — buttons in the filter bar plus Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y,
  // and Delete clears the current (box) selection.
  const doUndo = async (): Promise<void> => {
    if (!activeRoomId) return
    await invoke('map:undo', activeRoomId)
    await applyRoomData()
  }
  const doRedo = async (): Promise<void> => {
    if (!activeRoomId) return
    await invoke('map:redo', activeRoomId)
    await applyRoomData()
  }
  const openHistory = async (): Promise<void> => {
    if (!activeRoomId) return
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }
    setVersions(await invoke('map:history', activeRoomId))
    setHistoryOpen(true)
  }
  const restoreVersion = async (index: number): Promise<void> => {
    if (!activeRoomId) return
    setHistoryOpen(false)
    await invoke('map:restoreVersion', activeRoomId, index)
    await applyRoomData()
  }

  const deleteSelection = async (): Promise<void> => {
    const c = cy.current
    if (!c || !activeRoomId) return
    const selected = c.$(':selected')
    if (selected.length === 0) return
    for (const el of selected.toArray()) {
      if (el.isNode()) {
        const id = el.id()
        const type = el.data('type') as NodeType
        if (type === 'concept') await invoke('map:removeConcept', activeRoomId, id.replace(/^concept:/, ''))
        else if (type === 'source') await invoke('map:excludeNode', activeRoomId, id)
        else await invoke('map:hideNode', activeRoomId, id)
      } else {
        const kind = el.data('kind') as string
        if (kind === 'manual' || kind === 'ai-suggested') {
          await invoke('map:removeEdge', activeRoomId, el.id())
        }
      }
    }
    await applyRoomData()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void (e.shiftKey ? doRedo() : doUndo())
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        void doRedo()
      } else if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.shiftKey)) {
        e.preventDefault()
        cy.current?.nodes().select()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void deleteSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId])

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

  // Photo nodes grow/shrink in steps from the context menu.
  const resizeImage = async (nodeId: string, factor: number): Promise<void> => {
    if (!activeRoomId) return
    const current = sizesRef.current[nodeId] ?? 52
    await invoke('map:setNodeSize', activeRoomId, nodeId, current * factor)
    await applyRoomData()
  }
  const setEdgeStyle = async (edgeId: string, style: 'solid' | 'dashed' | 'dotted'): Promise<void> => {
    if (!activeRoomId) return
    setCtx(null)
    await invoke('map:setEdgeStyle', activeRoomId, edgeId, style)
    await applyRoomData()
  }
  const submitEdgeLabel = async (): Promise<void> => {
    if (!edgeEdit || !activeRoomId) return
    const { edgeId, value } = edgeEdit
    setEdgeEdit(null)
    await invoke('map:setEdgeLabel', activeRoomId, edgeId, value)
    await applyRoomData()
  }

  const startRename = (nodeId: string, nodeType: NodeType, x: number, y: number): void => {
    const full = (cy.current?.getElementById(nodeId).data('fullLabel') as string) ?? ''
    setCtx(null)
    setRenaming({ x, y, nodeId, nodeType, value: full })
  }
  const submitRename = async (): Promise<void> => {
    if (!renaming || !activeRoomId) return
    const title = renaming.value.trim()
    const { nodeId, nodeType } = renaming
    setRenaming(null)
    if (!title) return
    if (nodeType === 'concept') {
      await invoke('map:renameConcept', activeRoomId, nodeId.replace(/^concept:/, ''), title)
    } else if (nodeType === 'note') {
      await invoke('notes:rename', activeRoomId, nodeId.replace(/^note:/, ''), title)
    } else {
      await invoke('sources:rename', activeRoomId, nodeId, title)
    }
    await applyRoomData()
  }

  // Image files dropped straight onto the canvas become photo nodes.
  const dropImageFiles = async (files: File[], base?: { x: number; y: number }): Promise<void> => {
    if (!activeRoomId) return
    for (let i = 0; i < files.length; i++) {
      const bytes = new Uint8Array(await files[i].arrayBuffer())
      const pos = base ? { x: base.x + i * 34, y: base.y + i * 34 } : undefined
      await invoke('map:addImage', activeRoomId, files[i].name || 'image.png', bytes, pos)
    }
    await applyRoomData()
  }

  const addConcept = async (): Promise<void> => {
    if (!activeRoomId || !conceptName.trim()) return
    await invoke('map:addConcept', activeRoomId, conceptName.trim())
    setConceptName('')
    setAddingConcept(false)
    await useApp.getState().refreshRoomData()
  }

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
      <div
        className="relative min-w-0 flex-1"
        onClick={() => setCtx(null)}
        onDragEnter={(e) => {
          const types = e.dataTransfer.types
          if (!types.includes('wisp/source-id') && !types.includes('Files')) return
          dragDepth.current++
          setDropActive(true)
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDropActive(false)
        }}
        onDragOver={(e) => {
          const types = e.dataTransfer.types
          if (types.includes('wisp/source-id') || types.includes('Files')) e.preventDefault()
        }}
        onDrop={(e) => {
          dragDepth.current = 0
          setDropActive(false)
          const id = e.dataTransfer.getData('wisp/source-id')
          const imageFiles = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
          if (!id && imageFiles.length === 0) return
          e.preventDefault()
          // Convert the drop point to model coordinates so the node lands
          // exactly under the cursor, at any pan/zoom.
          let pos: { x: number; y: number } | undefined
          const rect = host.current?.getBoundingClientRect()
          const c = cy.current
          if (rect && c) {
            const pan = c.pan()
            const zoom = c.zoom()
            pos = {
              x: (e.clientX - rect.left - pan.x) / zoom,
              y: (e.clientY - rect.top - pan.y) / zoom
            }
          }
          if (id) void placeOnMap(id, pos)
          else void dropImageFiles(imageFiles, pos)
        }}
      >
        <div ref={host} className="h-full w-full" />

        {/* Drop-target glow while a library source is being dragged over. */}
        {dropActive && (
          <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent/60 bg-accent/5">
            <span className="rounded-full border border-accent/30 bg-neutral-900/90 px-4 py-1.5 text-xs font-medium text-accent shadow-lg shadow-black/30">
              {t('map.dropHint')}
            </span>
          </div>
        )}

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
            data-tip={t('map.tagLinks.hint')}
            data-tip-pos="bottom"
          >
            {t('map.tagLinks')}
          </button>
          <button
            onClick={() => setShowMentionLinks((v) => !v)}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
              showMentionLinks
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-neutral-850 text-neutral-600'
            }`}
            data-tip={t('map.mentionLinks.hint')}
            data-tip-pos="bottom"
          >
            {t('map.mentionLinks')}
          </button>
          <span className="mx-0.5 h-4 w-px bg-neutral-800" />
          <button
            onClick={() => void doUndo()}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-850 text-[11px] text-neutral-500 hover:border-neutral-600 hover:text-neutral-200"
            data-tip={t('map.undo')}
            data-tip-pos="bottom"
          >
            ↶
          </button>
          <button
            onClick={() => void doRedo()}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-850 text-[11px] text-neutral-500 hover:border-neutral-600 hover:text-neutral-200"
            data-tip={t('map.redo')}
            data-tip-pos="bottom"
          >
            ↷
          </button>
          <button
            onClick={() => void openHistory()}
            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
              historyOpen
                ? 'border-accent/50 text-accent'
                : 'border-neutral-850 text-neutral-500 hover:border-neutral-600 hover:text-neutral-200'
            }`}
            data-tip={t('map.history')}
            data-tip-pos="bottom"
          >
            ◷
          </button>
        </div>

        {/* Version history: durable snapshots of the map, one click to restore. */}
        {historyOpen && (
          <div className="absolute top-10 left-3 z-40 max-h-72 w-64 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-2xl shadow-black/50">
            {versions.length === 0 && (
              <div className="px-3 py-3 text-center text-[11px] text-neutral-600">
                {t('map.history.empty')}
              </div>
            )}
            {versions.map((v) => (
              <button
                key={v.index}
                className="block w-full px-3 py-1.5 text-left hover:bg-neutral-800"
                onClick={() => void restoreVersion(v.index)}
              >
                <div className="text-[11px] text-neutral-200">
                  {new Date(v.at).toLocaleString(undefined, {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {t('map.history.meta', { concepts: v.concepts, edges: v.edges, included: v.included })}
                </div>
              </button>
            ))}
          </div>
        )}

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
            {/* Right-clicking inside a multi-selection acts on the whole set. */}
            {(ctx.selCount ?? 0) > 1 && (
              <button
                className="block w-full px-3 py-1.5 text-left text-red-400 hover:bg-neutral-800"
                onClick={() => {
                  setCtx(null)
                  void deleteSelection()
                }}
              >
                {t('map.ctx.deleteSelected', { count: ctx.selCount! })}
              </button>
            )}
            {ctx.nodeId && ctx.nodeType && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => startRename(ctx.nodeId!, ctx.nodeType!, ctx.x, ctx.y)}
              >
                {t('map.ctx.rename')}
              </button>
            )}
            {ctx.nodeId && ctx.isImage && (
              <div className="flex items-center gap-1 px-3 py-1.5">
                <button
                  className="flex-1 rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800"
                  onClick={() => void resizeImage(ctx.nodeId!, 1 / 1.3)}
                >
                  − {t('map.ctx.smaller')}
                </button>
                <button
                  className="flex-1 rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800"
                  onClick={() => void resizeImage(ctx.nodeId!, 1.3)}
                >
                  + {t('map.ctx.bigger')}
                </button>
              </div>
            )}
            {ctx.nodeId && ctx.nodeType === 'concept' && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => void deleteConcept(ctx.nodeId!)}
              >
                {t('map.ctx.deleteConcept')}
              </button>
            )}
            {ctx.nodeId && ctx.nodeType === 'source' && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => void removeFromMap(ctx.nodeId!)}
              >
                {t('map.ctx.removeFromMap')}
              </button>
            )}
            {ctx.nodeId && ctx.nodeType === 'note' && (
              <button
                className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                onClick={() => void hideNode(ctx.nodeId!)}
              >
                {t('map.ctx.hideNode')}
              </button>
            )}
            {ctx.edgeId && (ctx.edgeKind === 'manual' || ctx.edgeKind === 'ai-suggested') && (
              <>
                {/* Line style: — solid, - - dashed, ··· dotted */}
                <div className="flex items-center gap-1 px-3 py-1.5" title={t('map.ctx.lineStyle')}>
                  {(
                    [
                      ['solid', '——'],
                      ['dashed', '– –'],
                      ['dotted', '···']
                    ] as const
                  ).map(([st, glyph]) => (
                    <button
                      key={st}
                      className="flex-1 rounded border border-neutral-700 px-2 py-0.5 text-center font-mono text-neutral-300 hover:bg-neutral-800"
                      onClick={() => void setEdgeStyle(ctx.edgeId!, st)}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
                <button
                  className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                  onClick={() => {
                    const current =
                      (cy.current?.getElementById(ctx.edgeId!).data('label') as string) ?? ''
                    setEdgeEdit({ x: ctx.x, y: ctx.y, edgeId: ctx.edgeId!, value: current })
                    setCtx(null)
                  }}
                >
                  {t('map.ctx.editLabel')}
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
                  onClick={() => void deleteEdge(ctx.edgeId!)}
                >
                  {t('map.ctx.deleteLink')}
                </button>
              </>
            )}
            {ctx.edgeId && ctx.edgeKind !== 'manual' && ctx.edgeKind !== 'ai-suggested' && (
              <div className="px-3 py-1.5 text-neutral-600">{t('map.ctx.derivedLink')}</div>
            )}
          </div>
        )}

        {/* Inline edge-label input ("--belki--" style), same anchoring. */}
        {edgeEdit && (
          <input
            autoFocus
            value={edgeEdit.value}
            onChange={(e) => setEdgeEdit({ ...edgeEdit, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitEdgeLabel()
              if (e.key === 'Escape') setEdgeEdit(null)
            }}
            onBlur={() => setEdgeEdit(null)}
            onClick={(e) => e.stopPropagation()}
            placeholder={t('map.ctx.editLabel')}
            className="absolute z-50 w-44 rounded-md border border-accent/60 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 shadow-2xl shadow-black/50 outline-none"
            style={{ left: edgeEdit.x, top: edgeEdit.y }}
          />
        )}

        {/* Inline rename input, anchored where the context menu was. */}
        {renaming && (
          <input
            autoFocus
            value={renaming.value}
            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitRename()
              if (e.key === 'Escape') setRenaming(null)
            }}
            onBlur={() => setRenaming(null)}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 w-52 rounded-md border border-accent/60 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 shadow-2xl shadow-black/50 outline-none"
            style={{ left: renaming.x, top: renaming.y }}
          />
        )}

        {/* Double-click info card (concepts, photos, url-less sources). */}
        {info && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setInfo(null)}
          >
            <div
              className="max-h-[80%] w-80 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium break-words text-neutral-100">{info.title}</div>
                  <div className="text-[10px] text-neutral-500">{info.typeLabel}</div>
                </div>
                <button
                  className="shrink-0 text-neutral-500 hover:text-neutral-200"
                  onClick={() => setInfo(null)}
                >
                  ×
                </button>
              </div>
              {info.img && (
                <img
                  src={info.img}
                  alt={info.title}
                  className="my-2 max-h-64 w-full rounded-lg object-contain"
                />
              )}
              {info.url && (
                <button
                  className="mb-2 block max-w-full truncate text-left text-[11px] text-accent underline decoration-dotted"
                  onClick={() => {
                    useApp.getState().newTab(info.url!)
                    useApp.getState().setOverlay('none')
                  }}
                >
                  {info.url}
                </button>
              )}
              <div className="mt-2 text-[10px] tracking-wide text-neutral-500 uppercase">
                {t('map.info.connections')}
              </div>
              {info.neighbors.length === 0 ? (
                <div className="py-1 text-[11px] text-neutral-600">{t('map.info.noConnections')}</div>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {info.neighbors.map((n, i) => (
                    <li key={i} className="truncate text-[11px] text-neutral-300">
                      · {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex w-64 flex-col border-l border-neutral-800">
        <div className="flex-1 overflow-y-auto p-3">
          {/* Library: sources collected but not yet placed on the map. */}
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] tracking-wide text-neutral-500 uppercase">
              {t('map.library')}
            </div>
            {librarySources.length === 0 ? (
              <div className="px-1 py-1 text-[10px] text-neutral-600">{t('map.library.empty')}</div>
            ) : (
              <>
                <div className="mb-1.5 text-[10px] text-neutral-600">{t('map.library.hint')}</div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {librarySources.map((s) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('wisp/source-id', s.id)
                        e.dataTransfer.effectAllowed = 'copy'
                        // A styled chip as the drag ghost, instead of a
                        // screenshot of the cramped list row.
                        const ghost = document.createElement('div')
                        ghost.textContent =
                          s.title.length > 42 ? s.title.slice(0, 41) + '…' : s.title
                        ghost.style.cssText =
                          'position:fixed;top:-200px;left:-200px;max-width:260px;' +
                          'padding:7px 14px;border-radius:999px;' +
                          'background:rgba(23,23,27,0.95);color:#e5e5e5;' +
                          'font:500 12px system-ui,sans-serif;white-space:nowrap;' +
                          'overflow:hidden;text-overflow:ellipsis;' +
                          `border:1.5px solid ${TYPE_COLOR.source};` +
                          'box-shadow:0 8px 24px rgba(0,0,0,0.45)'
                        document.body.appendChild(ghost)
                        e.dataTransfer.setDragImage(ghost, 18, 16)
                        setTimeout(() => ghost.remove(), 0)
                      }}
                      className="group flex cursor-grab items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-neutral-400 hover:bg-neutral-850 active:cursor-grabbing"
                      title={s.title}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: TYPE_COLOR.source }}
                      />
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      <button
                        className="hidden shrink-0 text-neutral-500 group-hover:inline hover:text-accent"
                        onClick={() => void placeOnMap(s.id)}
                        data-tip={t('map.library.add')}
                      >
                        ＋
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Ready-made schemas, tucked behind a collapsed header so they
              don't crowd the panel. One click drops a positioned skeleton. */}
          <div className="mb-3">
            <button
              className="mb-1.5 flex w-full items-center justify-between text-left"
              onClick={() => setTplOpen((v) => !v)}
            >
              <span className="text-[10px] tracking-wide text-neutral-500 uppercase">
                {t('map.templates')}
              </span>
              <span className="text-[10px] text-neutral-600">{tplOpen ? '▾' : '▸'}</span>
            </button>
            {tplOpen && (
              <>
                <div className="mb-1.5 text-[10px] text-neutral-600">{t('map.templates.hint')}</div>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ['central', '✳'],
                      ['relational', '⇄'],
                      ['timeline', '⇥'],
                      ['hierarchy', '⌥'],
                      ['brainstorm', '☁'],
                      ['project', '⚑']
                    ] as const
                  ).map(([tpl, glyph]) => (
                    <button
                      key={tpl}
                      className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-left text-[10px] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                      onClick={() =>
                        activeRoomId &&
                        void invoke('map:applyTemplate', activeRoomId, tpl).then(applyRoomData)
                      }
                    >
                      <span className="text-neutral-500">{glyph}</span>
                      <span className="min-w-0 flex-1 leading-tight">
                        {t(`map.template.${tpl}` as TKey)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

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
