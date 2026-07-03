// Wisp — © Shawy404. All rights reserved.
import type { ConceptNode, MapEdge } from '@shared/types'
import { stableId } from '@shared/tags'

/**
 * Ready-made map skeletons so an empty canvas isn't intimidating: pick a
 * template and get a positioned starter structure to rename and grow. All
 * nodes are plain concepts (rename/delete like any other) and every edge is a
 * 'manual' edge, so nothing about a template is special after insertion.
 */

export type TemplateId =
  | 'central'
  | 'relational'
  | 'timeline'
  | 'hierarchy'
  | 'brainstorm'
  | 'project'

export interface TemplateResult {
  concepts: ConceptNode[]
  edges: MapEdge[]
  positions: Record<string, { x: number; y: number }>
}

const COLORS = {
  blue: '#8ab4f8',
  green: '#7dd3a8',
  orange: '#f8b48a',
  purple: '#c58af8',
  yellow: '#f8e08a',
  rose: '#d38a7d'
}

interface Strings {
  main: string
  sub: string
  detail: string
  topic: string
  affects: string
  related: string
  causes: string
  supports: string
  contrasts: string
  event: string
  notes: string
  review: string
  root: string
  section: string
  idea: string
  start: string
  phase: string
  task: string
  done: string
}

const TR: Strings = {
  main: 'Ana Konu',
  sub: 'Alt Konu',
  detail: 'Detay',
  topic: 'Konu',
  affects: 'etkiler',
  related: 'bağlantılı',
  causes: 'neden olur',
  supports: 'destekler',
  contrasts: 'zıtlık oluşturur',
  event: 'Olay',
  notes: 'Notlar',
  review: 'Genel Değerlendirme',
  root: 'Ana Başlık',
  section: 'Bölüm',
  idea: 'Fikir',
  start: 'Proje Başlangıcı',
  phase: 'Aşama',
  task: 'Görev',
  done: 'Proje Tamamlandı'
}

const EN: Strings = {
  main: 'Main Topic',
  sub: 'Subtopic',
  detail: 'Detail',
  topic: 'Topic',
  affects: 'affects',
  related: 'related',
  causes: 'causes',
  supports: 'supports',
  contrasts: 'contrasts with',
  event: 'Event',
  notes: 'Notes',
  review: 'Overall Review',
  root: 'Main Heading',
  section: 'Section',
  idea: 'Idea',
  start: 'Project Start',
  phase: 'Phase',
  task: 'Task',
  done: 'Project Done'
}

export function buildTemplate(id: TemplateId, lang: 'tr' | 'en'): TemplateResult {
  const s = lang === 'en' ? EN : TR
  const stamp = Date.now()
  let n = 0

  const concepts: ConceptNode[] = []
  const edges: MapEdge[] = []
  const positions: Record<string, { x: number; y: number }> = {}

  const node = (title: string, x: number, y: number, color: string): string => {
    const cid = `c-${stableId(`${title}-${stamp}-${n++}`)}`
    concepts.push({ id: cid, title, tags: [], color })
    positions[`concept:${cid}`] = { x, y }
    return `concept:${cid}`
  }
  const link = (from: string, to: string, label?: string): void => {
    edges.push({ id: `e-${stableId(`${from}-${to}-${stamp}-${n++}`)}`, from, to, kind: 'manual', label })
  }

  switch (id) {
    case 'central': {
      const center = node(s.main, 0, 0, COLORS.purple)
      const spots = [
        { x: -300, y: -140 },
        { x: 300, y: -140 },
        { x: -300, y: 140 },
        { x: 300, y: 140 }
      ]
      const colors = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.yellow]
      spots.forEach((p, i) => {
        const sub = node(`${s.sub} ${i + 1}`, p.x, p.y, colors[i])
        link(center, sub)
        for (let d = 0; d < 2; d++) {
          const dx = p.x + (p.x < 0 ? -230 : 230)
          const dy = p.y + (d === 0 ? -55 : 55)
          link(sub, node(`${s.detail} ${i + 1}.${d + 1}`, dx, dy, colors[i]))
        }
      })
      break
    }
    case 'relational': {
      const colors = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple, COLORS.yellow, COLORS.rose]
      const letters = ['A', 'B', 'C', 'D', 'E', 'F']
      const ids = letters.map((letter, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
        return node(`${s.topic} ${letter}`, Math.cos(angle) * 300, Math.sin(angle) * 230, colors[i])
      })
      link(ids[0], ids[1], s.affects)
      link(ids[0], ids[2], s.related)
      link(ids[3], ids[0], s.related)
      link(ids[1], ids[4], s.causes)
      link(ids[3], ids[5], s.causes)
      link(ids[4], ids[3], s.supports)
      link(ids[4], ids[5], s.contrasts)
      break
    }
    case 'timeline': {
      const years: string[] = []
      for (let i = 0; i < 5; i++) {
        const x = -520 + i * 260
        const colors = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple, COLORS.yellow]
        const event = node(`${s.event} ${i + 1}`, x, -60, colors[i])
        const note = node(`${s.notes} ${i + 1}`, x, 90, colors[i])
        link(event, note)
        if (years.length > 0) link(years[years.length - 1], event)
        years.push(event)
      }
      const review = node(s.review, 0, 260, COLORS.rose)
      link(years[4], review)
      break
    }
    case 'hierarchy': {
      const root = node(s.root, 0, -220, COLORS.purple)
      const colors = [COLORS.blue, COLORS.green, COLORS.orange]
      for (let i = 0; i < 3; i++) {
        const x = -340 + i * 340
        const section = node(`${s.section} ${i + 1}`, x, -40, colors[i])
        link(root, section)
        for (let j = 0; j < 2; j++) {
          const sub = node(`${s.sub} ${i + 1}.${j + 1}`, x - 90 + j * 180, 130, colors[i])
          link(section, sub)
        }
      }
      break
    }
    case 'brainstorm': {
      const center = node(s.idea, 0, 0, COLORS.purple)
      const colors = [
        COLORS.blue,
        COLORS.green,
        COLORS.orange,
        COLORS.yellow,
        COLORS.rose,
        COLORS.blue,
        COLORS.green,
        COLORS.orange
      ]
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2
        link(center, node(`${s.idea} ${i + 1}`, Math.cos(angle) * 300, Math.sin(angle) * 220, colors[i]))
      }
      break
    }
    case 'project': {
      const start = node(s.start, -540, 0, COLORS.purple)
      const done = node(s.done, 540, 0, COLORS.green)
      const colors = [COLORS.blue, COLORS.orange, COLORS.yellow]
      for (let i = 0; i < 3; i++) {
        const y = -170 + i * 170
        const phase = node(`${s.phase} ${i + 1}`, -160, y, colors[i])
        link(start, phase)
        for (let j = 0; j < 2; j++) {
          const task = node(`${s.task} ${i + 1}.${j + 1}`, 180, y - 45 + j * 90, colors[i])
          link(phase, task)
          link(task, done)
        }
      }
      break
    }
  }

  return { concepts, edges, positions }
}
