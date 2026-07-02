// Wisp — © Shawy404. All rights reserved.

/** A tab inside a room. Owned by the main process, mirrored to the renderer. */
export interface TabInfo {
  id: string
  roomId: string
  url: string
  title: string
  favicon?: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
}

/** Persisted per-room metadata (rooms/<slug>/room.json). */
export interface RoomMeta {
  id: string
  name: string
  color: string
  createdAt: string
  /** URLs of open tabs, restored on room switch / app start. */
  tabs: string[]
  activeTabIndex: number
  settings: {
    devMode: boolean
  }
}

export type NodeType = 'source' | 'note' | 'concept'
export type SourceKind = 'academic' | 'wiki' | 'image' | 'web' | 'clip'

/** A collected source (rooms/<slug>/sources.json). Also a node in the graph. */
export interface SourceItem {
  id: string
  kind: SourceKind
  title: string
  url?: string
  authors?: string[]
  year?: number
  venue?: string
  doi?: string
  abstract?: string
  imageUrl?: string
  /** Local file under clips/ for clipped content. */
  clipFile?: string
  /** Clipped text selection, if any. */
  excerpt?: string
  tags: string[]
  addedAt: string
  origin: 'search' | 'clip' | 'reader'
}

/** A note on disk (rooms/<slug>/notes/<name>.md). Also a node in the graph. */
export interface NoteInfo {
  /** Note id == filename without .md */
  id: string
  title: string
  body: string
  tags: string[]
  updatedAt: string
}

export type EdgeKind = 'manual' | 'wikilink' | 'tag' | 'ai-suggested'

export interface MapEdge {
  id: string
  from: string
  to: string
  kind: EdgeKind
  label?: string
}

/** Extra concept nodes + persisted edges (rooms/<slug>/map.json). */
export interface ConceptNode {
  id: string
  title: string
  tags: string[]
}

export interface MapData {
  concepts: ConceptNode[]
  edges: MapEdge[]
}

/** Everything the renderer needs about one room's knowledge base. */
export interface RoomData {
  meta: RoomMeta
  sources: SourceItem[]
  notes: NoteInfo[]
  map: MapData
}

/** Global settings (~/Wisp/config.json). */
export interface WispConfig {
  theme: 'dark' | 'light'
  accent: string
  adblock: boolean
  adblockAllowlist: string[]
  anthropicApiKey?: string
  lastRoomId?: string
  profile: string
  /** Web-dev mode: DevTools + the search JSON viewer. */
  devMode?: boolean
  /** Per-room pomodoro focus session length in minutes. */
  focusMinutes?: number
}

/** Search results returned by the main-process search aggregator. */
export interface SearchResults {
  query: string
  classification: 'academic' | 'general'
  academic: SourceItem[]
  wiki: SourceItem[]
  images: SourceItem[]
  web: SourceItem[]
  errors: string[]
  /** Raw API responses, for the dev-mode JSON viewer. */
  raw?: Record<string, unknown>
}

export interface AiEdgeSuggestion {
  from: string
  to: string
  label: string
}
