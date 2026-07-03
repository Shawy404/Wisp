// Wisp — © Shawy404. All rights reserved.
import { ipcMain, net } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import type { AiEdgeSuggestion, ConceptNode, MapEdge, SourceItem } from '@shared/types'
import { buildGraph } from '@shared/graph'
import { stableId } from '@shared/tags'
import { translate } from '@shared/i18n'
import * as store from './storage'
import { addSources } from './search-ipc'
import { saveClipImage } from './notes-ipc'
import { buildTemplate, type TemplateId } from './map-templates'
import type { WispContext } from './ipc'

export function registerMapIpc(ctx: WispContext): void {
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }

  // A manual drag-to-link becomes a persisted edge; promoting a suggested edge
  // to permanent is the same call with kind 'manual'.
  ipcMain.handle(
    'map:addEdge',
    (_e, roomId: string, from: string, to: string, kind: MapEdge['kind'] = 'manual', label?: string) => {
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
    const map = store.loadMap(roomId)
    map.edges = map.edges.filter((edge) => edge.id !== edgeId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  // Hide a source/note node from the map without deleting the underlying item.
  ipcMain.handle('map:hideNode', (_e, roomId: string, nodeId: string) => {
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
    const map = store.loadMap(roomId)
    map.included = (map.included ?? []).filter((id) => id !== sourceId)
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:clearHidden', (_e, roomId: string) => {
    const map = store.loadMap(roomId)
    map.hidden = []
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  ipcMain.handle('map:addConcept', (_e, roomId: string, title: string, tags: string[] = []) => {
    const map = store.loadMap(roomId)
    const concept: ConceptNode = { id: `c-${stableId(title + Date.now())}`, title, tags }
    map.concepts.push(concept)
    store.saveMap(roomId, map)
    notify(roomId)
    return concept
  })

  // Insert a ready-made skeleton (starter concepts + edges, pre-positioned).
  ipcMain.handle('map:applyTemplate', (_e, roomId: string, templateId: TemplateId) => {
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
      const map = store.loadMap(roomId)
      map.included = [...new Set([...(map.included ?? []), source.id])]
      if (pos) map.positions = { ...(map.positions ?? {}), [source.id]: pos }
      store.saveMap(roomId, map)
      notify(roomId)
      return source
    }
  )

  ipcMain.handle('map:removeConcept', (_e, roomId: string, conceptId: string) => {
    const map = store.loadMap(roomId)
    map.concepts = map.concepts.filter((c) => c.id !== conceptId)
    const nodeId = `concept:${conceptId}`
    map.edges = map.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
    if (map.positions) delete map.positions[nodeId]
    store.saveMap(roomId, map)
    notify(roomId)
    return map
  })

  // On-demand AI: one call, node titles + tags in, relationship suggestions out.
  ipcMain.handle('map:suggestLinks', async (_e, roomId: string): Promise<{
    suggestions: AiEdgeSuggestion[]
    error?: string
  }> => {
    const t = (key: Parameters<typeof translate>[1]): string =>
      translate(ctx.config.language ?? 'tr', key)
    if (!ctx.config.anthropicApiKey) {
      return { suggestions: [], error: t('main.map.needApiKey') }
    }
    const data = store.loadRoomData(roomId)
    if (!data) return { suggestions: [], error: t('main.map.roomNotFound') }
    const graph = buildGraph(data)
    if (graph.nodes.length < 2) {
      return { suggestions: [], error: t('main.map.needTwoNodes') }
    }

    const nodeList = graph.nodes
      .map((n) => `${n.id} :: ${n.label}${n.tags.length ? ` [${n.tags.join(', ')}]` : ''}`)
      .join('\n')

    try {
      const client = new Anthropic({
        apiKey: ctx.config.anthropicApiKey,
        fetch: (url: string | URL | Request, init?: RequestInit) =>
          net.fetch(url.toString(), init as Parameters<typeof net.fetch>[1]) as unknown as Promise<Response>
      })
      // Prompt in the UI language so suggestion labels match the rest of the app.
      const lang = ctx.config.language ?? 'tr'
      const system =
        lang === 'tr'
          ? 'Sen bir araştırma asistanısın. Verilen düğümler (kaynaklar, notlar, kavramlar) arasındaki ' +
            'anlamlı ilişkileri bul. Sadece gerçekten ilişkili çiftler için kısa, yönlü bir etiket ver ' +
            '(ör. "X, Y’nin bir mekanizmasıdır", "A, B ile çelişir", "P, Q’yu destekler"). ' +
            'Yalnızca verilen id’leri kullan. Yanıtı JSON ver.'
          : 'You are a research assistant. Find meaningful relationships between the given nodes ' +
            '(sources, notes, concepts). Give a short directed label only for genuinely related pairs ' +
            '(e.g. "X is a mechanism of Y", "A contradicts B", "P supports Q"). ' +
            'Use only the given ids. Answer in JSON.'
      const user =
        lang === 'tr'
          ? `Düğümler:\n${nodeList}\n\n` +
            'Aralarındaki en güçlü 3-10 ilişkiyi öner. Şu formatta JSON dizisi döndür:\n' +
            '[{"from":"<id>","to":"<id>","label":"kısa ilişki"}]'
          : `Nodes:\n${nodeList}\n\n` +
            'Suggest the 3-10 strongest relationships between them. Return a JSON array like:\n' +
            '[{"from":"<id>","to":"<id>","label":"short relationship"}]'
      const res = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                edges: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      from: { type: 'string' },
                      to: { type: 'string' },
                      label: { type: 'string' }
                    },
                    required: ['from', 'to', 'label'],
                    additionalProperties: false
                  }
                }
              },
              required: ['edges'],
              additionalProperties: false
            }
          }
        }
      })
      if (res.stop_reason === 'refusal') {
        return { suggestions: [], error: t('main.map.refused') }
      }
      const textBlock = res.content.find((b) => b.type === 'text')
      const parsed = textBlock && 'text' in textBlock ? JSON.parse(textBlock.text) : { edges: [] }
      const valid = new Set(graph.nodes.map((n) => n.id))
      const suggestions: AiEdgeSuggestion[] = (parsed.edges ?? [])
        .filter((e: AiEdgeSuggestion) => valid.has(e.from) && valid.has(e.to) && e.from !== e.to)
        .slice(0, 12)
      return { suggestions }
    } catch (err) {
      return { suggestions: [], error: err instanceof Error ? err.message : String(err) }
    }
  })
}
