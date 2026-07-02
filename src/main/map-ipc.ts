// Wisp — © Shawy404. All rights reserved.
import { ipcMain, net } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import type { AiEdgeSuggestion, ConceptNode, MapEdge } from '@shared/types'
import { buildGraph } from '@shared/graph'
import { stableId } from '@shared/tags'
import { translate } from '@shared/i18n'
import * as store from './storage'
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

  ipcMain.handle('map:addConcept', (_e, roomId: string, title: string, tags: string[] = []) => {
    const map = store.loadMap(roomId)
    const concept: ConceptNode = { id: `c-${stableId(title + Date.now())}`, title, tags }
    map.concepts.push(concept)
    store.saveMap(roomId, map)
    notify(roomId)
    return concept
  })

  ipcMain.handle('map:removeConcept', (_e, roomId: string, conceptId: string) => {
    const map = store.loadMap(roomId)
    map.concepts = map.concepts.filter((c) => c.id !== conceptId)
    const nodeId = `concept:${conceptId}`
    map.edges = map.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
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
      const res = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        system:
          'Sen bir araştırma asistanısın. Verilen düğümler (kaynaklar, notlar, kavramlar) arasındaki ' +
          'anlamlı ilişkileri bul. Sadece gerçekten ilişkili çiftler için kısa, yönlü bir etiket ver ' +
          '(ör. "X, Y’nin bir mekanizmasıdır", "A, B ile çelişir", "P, Q’yu destekler"). ' +
          'Yalnızca verilen id’leri kullan. Yanıtı JSON ver.',
        messages: [
          {
            role: 'user',
            content:
              `Düğümler:\n${nodeList}\n\n` +
              'Aralarındaki en güçlü 3-10 ilişkiyi öner. Şu formatta JSON dizisi döndür:\n' +
              '[{"from":"<id>","to":"<id>","label":"kısa ilişki"}]'
          }
        ],
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
