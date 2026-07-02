// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type {
  MapData,
  NoteInfo,
  RoomData,
  RoomMeta,
  SourceItem,
  WispConfig
} from '@shared/types'

export const wispRoot = (): string => process.env.WISP_HOME || join(homedir(), 'Wisp')
export const roomsDir = (): string => join(wispRoot(), 'rooms')
export const roomDir = (id: string): string => join(roomsDir(), id)
export const notesDir = (id: string): string => join(roomDir(id), 'notes')
export const clipsDir = (id: string): string => join(roomDir(id), 'clips')

const ROOM_COLORS = ['#7dd3a8', '#8ab4f8', '#f8b48a', '#d38a7d', '#c58af8', '#f8e08a']

function readJson<T>(file: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) }
  } catch {
    return fallback
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(join(file, '..'), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

const defaultConfig: WispConfig = {
  theme: 'dark',
  language: 'tr',
  accent: '#7dd3a8',
  adblock: true,
  adblockAllowlist: [],
  profile: 'default',
  devMode: false,
  focusMinutes: 25
}

export function loadConfig(): WispConfig {
  return readJson(join(wispRoot(), 'config.json'), defaultConfig)
}

export function saveConfig(config: WispConfig): void {
  writeJson(join(wispRoot(), 'config.json'), config)
}

export function slugify(name: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }
  let slug = name
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) slug = 'oda'
  let unique = slug
  let n = 2
  while (fs.existsSync(roomDir(unique))) unique = `${slug}-${n++}`
  return unique
}

export function listRooms(): RoomMeta[] {
  if (!fs.existsSync(roomsDir())) return []
  return fs
    .readdirSync(roomsDir(), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadRoomMeta(d.name))
    .filter((m): m is RoomMeta => m !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function loadRoomMeta(id: string): RoomMeta | null {
  const file = join(roomDir(id), 'room.json')
  if (!fs.existsSync(file)) return null
  return readJson<RoomMeta>(file, {
    id,
    name: id,
    color: ROOM_COLORS[0],
    createdAt: new Date().toISOString(),
    tabs: [],
    activeTabIndex: 0,
    pinned: [],
    settings: { devMode: false }
  })
}

export function saveRoomMeta(meta: RoomMeta): void {
  writeJson(join(roomDir(meta.id), 'room.json'), meta)
}

export function createRoom(name: string): RoomMeta {
  const id = slugify(name)
  const meta: RoomMeta = {
    id,
    name,
    color: ROOM_COLORS[listRooms().length % ROOM_COLORS.length],
    createdAt: new Date().toISOString(),
    tabs: [],
    activeTabIndex: 0,
    pinned: [],
    settings: { devMode: false }
  }
  fs.mkdirSync(notesDir(id), { recursive: true })
  fs.mkdirSync(clipsDir(id), { recursive: true })
  saveRoomMeta(meta)
  saveSources(id, [])
  saveMap(id, { concepts: [], edges: [] })
  return meta
}

export function deleteRoom(id: string): void {
  fs.rmSync(roomDir(id), { recursive: true, force: true })
}

export function renameRoom(id: string, name: string): RoomMeta | null {
  const meta = loadRoomMeta(id)
  if (!meta) return null
  meta.name = name
  saveRoomMeta(meta)
  return meta
}

export function loadSources(id: string): SourceItem[] {
  return readJson<{ sources: SourceItem[] }>(join(roomDir(id), 'sources.json'), { sources: [] })
    .sources
}

export function saveSources(id: string, sources: SourceItem[]): void {
  writeJson(join(roomDir(id), 'sources.json'), { sources })
}

export function loadMap(id: string): MapData {
  return readJson<MapData>(join(roomDir(id), 'map.json'), { concepts: [], edges: [] })
}

export function saveMap(id: string, map: MapData): void {
  writeJson(join(roomDir(id), 'map.json'), map)
}

/** Notes live as plain .md files — Obsidian compatible. Tags come from #hashtags. */
export function listNotes(id: string): NoteInfo[] {
  const dir = notesDir(id)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const body = fs.readFileSync(join(dir, f), 'utf8')
      const stat = fs.statSync(join(dir, f))
      const noteId = f.replace(/\.md$/, '')
      return {
        id: noteId,
        title: noteId,
        body,
        tags: extractHashtags(body),
        updatedAt: stat.mtime.toISOString()
      }
    })
}

export function writeNote(roomId: string, noteId: string, body: string): NoteInfo {
  const file = join(notesDir(roomId), `${noteId}.md`)
  fs.mkdirSync(notesDir(roomId), { recursive: true })
  fs.writeFileSync(file, body)
  return {
    id: noteId,
    title: noteId,
    body,
    tags: extractHashtags(body),
    updatedAt: new Date().toISOString()
  }
}

export function deleteNote(roomId: string, noteId: string): void {
  fs.rmSync(join(notesDir(roomId), `${noteId}.md`), { force: true })
}

export function renameNote(roomId: string, oldId: string, newId: string): boolean {
  const from = join(notesDir(roomId), `${oldId}.md`)
  const to = join(notesDir(roomId), `${newId}.md`)
  if (!fs.existsSync(from) || fs.existsSync(to)) return false
  fs.renameSync(from, to)
  return true
}

export function extractHashtags(text: string): string[] {
  const tags = new Set<string>()
  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{2,})/gu)) tags.add(m[2].toLowerCase())
  return [...tags]
}

export function loadRoomData(id: string): RoomData | null {
  const meta = loadRoomMeta(id)
  if (!meta) return null
  return { meta, sources: loadSources(id), notes: listNotes(id), map: loadMap(id) }
}

export function ensureDefaultRoom(): RoomMeta[] {
  fs.mkdirSync(roomsDir(), { recursive: true })
  let rooms = listRooms()
  if (rooms.length === 0) {
    createRoom('Genel')
    rooms = listRooms()
  }
  return rooms
}
