// Wisp. © Shawy404, MIT.
import { ipcMain } from 'electron'
import type { ConceptNode, EdgeStyle, MapData, MapEdge, SourceItem } from '@shared/types'
import { stableId } from '@shared/tags'
import * as store from './storage'
import { addSources } from './search-ipc'
import { saveClipImage } from './notes-ipc'
import { buildTemplate, type TemplateId } from './map-templates'
import type { WispContext } from './ipc'

export function registerMapIpc(ctx: WispContext): void {
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }

  // Undo/redo: every structural mutation snapshots map.json first. Drag moves
  // (map:setPosition) are deliberately excluded — undo is for structure, not
  // for every pixel of a drag.
  const undoStacks = new Map<string, MapData[]>()
  const redoStacks = new Map<string, MapData[]>()
  const snapshot = (roomId: string): void => {
    const currentJson = JSON.stringify(store.loadMap(roomId))
    const stack = undoStacks.get(roomId) ?? []
    stack.push(JSON.parse(currentJson) as MapData)
    if (stack.length > 50) stack.shift()
    undoStacks.set(roomId, stack)
    redoStacks.set(roomId, [])
    // Also keep a durable version on disk (the panel's history list) —
    // skipping consecutive identical states keeps the file meaningful.
    const history = store.loadMapHistory(roomId)
    const last = history[history.length - 1]
    if (!last || JSON.stringify(last.map) !== currentJson) {
      history.push({ at: new Date().toISOString(), map: JSON.parse(currentJson) as MapData })
      store.saveMapHistory(roomId, history)
    }
  }

  ipcMain.handle('map:history', (_e, roomId: string) =>
    store
      .loadMapHistory(roomId)
      .map((s, index) => ({
        index,
        at: s.at,
        concepts: s.map.concepts.length,
        edges: s.map.edges.length,
        included: s.map.included?.length ?? 0
      }))
      .reverse()
  )

  ipcMain.handle('map:restoreVersion', (_e, roomId: string, index: number) => {
    const history = store.loadMapHistory(roomId)
    const snap = history[index]
    if (!snap) return null
    snapshot(roomId) // current state stays reachable via undo/history
    store.saveMap(roomId, JSON.parse(JSON.stringify(snap.map)) as MapData)
    notify(roomId)
    return snap.map
  })

  ipcMain.handle('map:undo', (_e, roomId: string) => {
    const undo = undoStacks.get(roomId) ?? []
    const prev = undo.pop()
    if (!prev) return null
    const redo = redoStacks.get(roomId) ?? []
    redo.push(JSON.parse(JSON.stringify(store.loadMap(roomId))) as MapData)
    redoStacks.set(roomId, redo)
    store.saveMap(roomId, prev)
    notify(roomId)
    return prev
  })

  ipcMain.handle('map:redo', (_e, roomId: string) => {
    const redo = redoStacks.get(roomId) ?? []
    const next = redo.pop()
    if (!next) return null
    const undo = undoStacks.get(roomId) ?? []
    undo.push(JSON.parse(JSON.stringify(store.loadMap(roomId))) as MapData)
    undoStacks.set(roomId, undo)
    store.saveMap(roomId, next)
    notify(roomId)
    return next
  })

  // A manual drag-to-link becomes a persisted edge; promoting a suggested edge
  // to permanent is the same call with kind 'manual'.
  ipcMain.handle(
    'map:addEdge',
    (_e, roomId: string, from: string, to: string, kind: MapEdge['kind'] = 'manual', label?: string) => {
      snapshot(roomId)
      const map = store.loadMap(roomId)
      const id = `e-${stableId(`${from}->${to}:${kind}`)}`
      if (!map.edges.some((edge) => edge.id === id)) {
        map.edges.push({ id, from, to, kind, label })
        store.saveMap(roomId, map)
        notify(roomId)
      }
      return map
    }
  )

  ipcMain.handle('map:removeEdge', (_e, roomId: string, edgeId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.edges = map.edges.filter((edge) => edge.id !== edgeId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  // Per-edge looks: line style (solid/dashed/dotted) and a free-text label.
  ipcMain.handle('map:setEdgeStyle', (_e, roomId: string, edgeId: string, style: EdgeStyle) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const edge = map.edges.find((x) => x.id === edgeId)
    if (edge) {
      edge.style = style
      store.saveMap(roomId, map)
      notify(roomId)
    }
    return map
  })

  ipcMain.handle('map:setEdgeLabel', (_e, roomId: string, edgeId: string, label: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const edge = map.edges.find((x) => x.id === edgeId)
    if (edge) {
      edge.label = label.trim() || undefined
      store.saveMap(roomId, map)
      notify(roomId)
    }
    return map
  })

  // Resizable nodes (used by image nodes): px size, clamped to sane bounds.
  ipcMain.handle('map:setNodeSize', (_e, roomId: string, nodeId: string, size: number) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.sizes = { ...(map.sizes ?? {}), [nodeId]: Math.round(Math.max(28, Math.min(420, size))) }
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  // Hide a source/note node from the map without deleting the underlying item.
  ipcMain.handle('map:hideNode', (_e, roomId: string, nodeId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const hidden = new Set(map.hidden ?? [])
    hidden.add(nodeId)
    map.hidden = [...hidden]
    // Drop any persisted edges that touched the now-hidden node.
    map.edges = map.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:unhideNode', (_e, roomId: string, nodeId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.hidden = (map.hidden ?? []).filter((id) => id !== nodeId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  // Place a source on the map (drag from the library panel / its ＋ button).
  // A drop carries the exact canvas position so the node lands under the cursor.
  ipcMain.handle(
    'map:includeNode',
    (_e, roomId: string, sourceId: string, pos?: { x: number; y: number }) => {
      snapshot(roomId)
      const map = store.loadMap(roomId)
      const included = new Set(map.included ?? [])
      included.add(sourceId)
      map.included = [...included]
      if (pos) map.positions = { ...(map.positions ?? {}), [sourceId]: pos }
      store.saveMap(roomId, map)
      notify(roomId)
      return map
    }
  )

  // Persist a hand-dragged node position. Deliberately does NOT notify: the
  // canvas already shows the node where the user left it, and a broadcast
  // would re-run layout mid-interaction.
  ipcMain.handle('map:setPosition', (_e, roomId: string, nodeId: string, x: number, y: number) => {
    const map = store.loadMap(roomId)
    map.positions = { ...(map.positions ?? {}), [nodeId]: { x, y } }
    store.saveMap(roomId, map)
    return map
  })

  // Take a source off the map. Its persisted edges stay in map.json — they
  // simply don't render while an endpoint is off the canvas, and come back
  // if the source is placed again.
  ipcMain.handle('map:excludeNode', (_e, roomId: string, sourceId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.included = (map.included ?? []).filter((id) => id !== sourceId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:clearHidden', (_e, roomId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.hidden = []
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:addConcept', (_e, roomId: string, title: string, tags: string[] = []) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const concept: ConceptNode = { id: `c-${stableId(title + Date.now())}`, title, tags }
    map.concepts.push(concept)
    store.saveMap(roomId, map)
    notify(roomId)
    return concept
  })

  // Insert a ready-made skeleton (starter concepts + edges, pre-positioned).
  ipcMain.handle('map:applyTemplate', (_e, roomId: string, templateId: TemplateId) => {
    snapshot(roomId)
    const tpl = buildTemplate(templateId, ctx.config.language ?? 'tr')
    const map = store.loadMap(roomId)
    map.concepts.push(...tpl.concepts)
    map.edges.push(...tpl.edges)
    map.positions = { ...(map.positions ?? {}), ...tpl.positions }
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:renameConcept', (_e, roomId: string, conceptId: string, title: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const concept = map.concepts.find((c) => c.id === conceptId)
    if (concept && title.trim()) {
      concept.title = title.trim()
      store.saveMap(roomId, map)
      notify(roomId)
    }
    return map
  })

  // An image file dropped straight onto the canvas: store the bytes as a clip,
  // create an image source for it and place it where it was dropped.
  ipcMain.handle(
    'map:addImage',
    (_e, roomId: string, name: string, bytes: Uint8Array, pos?: { x: number; y: number }) => {
      let file: string
      try {
        file = saveClipImage(roomId, String(name), bytes)
      } catch {
        return null
      }
      const title = String(name).replace(/\.[^.]+$/, '').trim() || file
      const source: SourceItem = {
        id: `src-${stableId(file)}`,
        kind: 'image',
        title,
        clipFile: file,
        tags: [],
        addedAt: new Date().toISOString(),
        origin: 'manual'
      }
      addSources(roomId, [source])
      snapshot(roomId)
      const map = store.loadMap(roomId)
      map.included = [...new Set([...(map.included ?? []), source.id])]
      if (pos) map.positions = { ...(map.positions ?? {}), [source.id]: pos }
      store.saveMap(roomId, map)
      notify(roomId)
      return source
    }
  )

  // ---- group frames: a labeled box around a set of nodes. moving the box
  // moves everyone inside, like the frames in every serious canvas tool. ----
  ipcMain.handle('map:addGroup', (_e, roomId: string, title: string, members: string[]) => {
    const clean = [...new Set(members)].filter(Boolean)
    if (!title.trim() || clean.length === 0) return null
    snapshot(roomId)
    const map = store.loadMap(roomId)
    // one node, one group. joining a new frame quietly leaves the old one.
    for (const g of map.groups ?? []) g.members = g.members.filter((m) => !clean.includes(m))
    const group = { id: `g-${stableId(title + Date.now())}`, title: title.trim(), members: clean }
    map.groups = [...(map.groups ?? []).filter((g) => g.members.length > 0), group]
    store.saveMap(roomId, map)
    notify(roomId)
    return group
  })

  ipcMain.handle('map:renameGroup', (_e, roomId: string, groupId: string, title: string) => {
    if (!title.trim()) return null
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const group = (map.groups ?? []).find((g) => g.id === groupId)
    if (group) {
      group.title = title.trim()
      store.saveMap(roomId, map)
      notify(roomId)
    }
    return map
  })

  // dissolve the frame only; the nodes inside stay right where they are
  ipcMain.handle('map:removeGroup', (_e, roomId: string, groupId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.groups = (map.groups ?? []).filter((g) => g.id !== groupId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  // note cards: a note node can show its actual text on the canvas
  ipcMain.handle('map:toggleCard', (_e, roomId: string, nodeId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    const cards = new Set(map.cards ?? [])
    if (cards.has(nodeId)) cards.delete(nodeId)
    else cards.add(nodeId)
    map.cards = [...cards]
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:removeConcept', (_e, roomId: string, conceptId: string) => {
    snapshot(roomId)
    const map = store.loadMap(roomId)
    map.concepts = map.concepts.filter((c) => c.id !== conceptId)
    const nodeId = `concept:${conceptId}`
    map.edges = map.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
    if (map.positions) delete map.positions[nodeId]
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

}
