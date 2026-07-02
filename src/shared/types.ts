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

/** A pinned tab: a saved place that survives closing the tab itself. */
export interface PinnedTab {
  url: string
  title: string
  favicon?: string
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
  /** Pinned tabs shown above the tab list; clicking opens/activates the URL. */
  pinned: PinnedTab[]
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
  origin: 'search' | 'clip' | 'reader' | 'manual'
}

/** One visited page in a room's browsing history (rooms/<slug>/history.json). */
export interface HistoryEntry {
  url: string
  title: string
  favicon?: string
  /** Visit time, ISO — also the entry's id for deletion. */
  at: string
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
  /** Node ids the user has hidden from the map (sources/notes they don't want shown). */
  hidden?: string[]
  /**
   * Source ids the user has placed on the map. Sources never appear on the map
   * by themselves — they're dragged in (or added) from the map's library panel,
   * so the map stays a deliberate canvas instead of a dump of every source.
   */
  included?: string[]
  /**
   * Hand-placed node coordinates (model space). A node the user dragged — or
   * dropped from the library — stays exactly where it was left; auto-layout
   * only ever touches nodes without a saved position.
   */
  positions?: Record<string, { x: number; y: number }>
}

/** Everything the renderer needs about one room's knowledge base. */
export interface RoomData {
  meta: RoomMeta
  sources: SourceItem[]
  notes: NoteInfo[]
  map: MapData
}

export type ThemeId = 'dark' | 'midnight' | 'forest' | 'plum' | 'light' | 'sepia'

export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'brave'

/** Global settings (~/Wisp/config.json). */
export interface WispConfig {
  theme: ThemeId
  language: 'tr' | 'en'
  accent: string
  adblock: boolean
  adblockAllowlist: string[]
  anthropicApiKey?: string
  lastRoomId?: string
  /** Remembered per-site permission decisions (host → permission → verdict). */
  sitePermissions?: Record<string, Record<string, 'allow' | 'deny'>>
  /** Per-site element-zapper CSS selectors (host → hidden selectors). */
  zappedSelectors?: Record<string, string[]>
  profile: string
  /** Web-dev mode: DevTools + the search JSON viewer. */
  devMode?: boolean
  /** Per-room pomodoro focus session length in minutes. */
  focusMinutes?: number
  /** Background image: 'icon' (default watermark), 'none', or a stored filename. */
  backgroundImage?: string
  /** Background layer opacity, 0–1 (default 0.15). */
  backgroundOpacity?: number
  /** Background blur in px (default 0). */
  backgroundBlur?: number
  /** Zen-style glass: make the UI surfaces translucent so the background shows through. */
  translucentUi?: boolean
  /** Real window transparency (compositor glass) — needs an app restart. */
  windowTransparent?: boolean
  /** Engine used for address-bar web searches. */
  searchEngine?: SearchEngineId
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
