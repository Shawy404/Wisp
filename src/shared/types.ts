// Wisp. © Shawy404, MIT.

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
  /** True while the tab's web contents are unloaded to save memory. */
  asleep?: boolean
  /** Private-mode tab: in-memory session, never persisted, never in history. */
  isPrivate?: boolean
}

/** A pinned tab: a saved place that survives closing the tab itself. */
export interface PinnedTab {
  url: string
  title: string
  favicon?: string
}

/** An essential: a pinned tab shown in every room, minus rooms it's hidden in. */
export interface EssentialTab extends PinnedTab {
  /** Room ids where the user removed this essential (hidden there only). */
  excludedRooms?: string[]
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
  /** Archived rooms keep their folder but leave the sidebar until restored. */
  archived?: boolean
  settings: {
    devMode: boolean
  }
}

/**
 * The private room's fixed id. It never touches disk: main special-cases it
 * everywhere a real room would be loaded or saved, its tabs live in the
 * in-memory private session, and closing it evaporates the lot.
 */
export const PRIVATE_ROOM_ID = 'room-private'

export type NodeType = 'source' | 'note' | 'concept'
export type SourceKind = 'academic' | 'wiki' | 'image' | 'web' | 'clip' | 'video' | 'pdf'

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

/** 'ai-suggested' is legacy — old map.json files may still carry such edges. */
export type EdgeKind = 'manual' | 'wikilink' | 'tag' | 'ai-suggested' | 'mention'

export type EdgeStyle = 'solid' | 'dashed' | 'dotted'

export interface MapEdge {
  id: string
  from: string
  to: string
  kind: EdgeKind
  label?: string
  /** Visual line style override; defaults per kind when unset. */
  style?: EdgeStyle
}

/** Extra concept nodes + persisted edges (rooms/<slug>/map.json). */
export interface ConceptNode {
  id: string
  title: string
  tags: string[]
  /** Border/accent color on the map (templates assign varied colors). */
  color?: string
}

/** A named frame drawn around a set of nodes — a visual group on the canvas. */
export interface MapGroup {
  id: string
  title: string
  /** Node ids living inside the frame. A node belongs to one group at most. */
  members: string[]
  color?: string
}

export interface MapData {
  concepts: ConceptNode[]
  edges: MapEdge[]
  /** Labeled group frames; dragging a frame moves everything inside it. */
  groups?: MapGroup[]
  /** Note node ids that show their text on the canvas as a content card. */
  cards?: string[]
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
  /** Per-node size overrides in px (image nodes are resizable). */
  sizes?: Record<string, number>
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
  /** Background image: 'none' (or unset) for nothing, or a stored filename.
   *  Hidden entirely while the window itself is transparent. */
  backgroundImage?: string
  /** Background layer opacity, 0–1 (default 0.15). */
  backgroundOpacity?: number
  /** Background blur in px (default 0). */
  backgroundBlur?: number
  /** Glass: make the UI surfaces translucent so the background shows through. */
  translucentUi?: boolean
  /** Real window transparency (compositor glass) — needs an app restart. */
  windowTransparent?: boolean
  /** Engine used for address-bar web searches. */
  searchEngine?: SearchEngineId
  /** First-run tutorial completed (or skipped). */
  onboarded?: boolean
  /** Which sidebar mini-widgets are visible (default: all). */
  sidebarWidgets?: { music?: boolean; ram?: boolean }
  /** Compact mode: the sidebar hides itself and reveals on hover. */
  compactSidebar?: boolean
  /** Dead setting: the auto-hiding toolbar was too buggy to live. Old configs
   *  may still carry it; nothing reads it anymore. */
  compactToolbar?: boolean
  /** Frosted bars: title bar + sidebar go slightly translucent with blur. */
  chromeBlur?: boolean
  /** Width in px of the hover strip that reveals the compact sidebar (default 10). */
  compactRevealPx?: number
  /** Delay in ms before the revealed sidebar tucks away again (default 400). */
  compactHideDelayMs?: number
  /** Tabs kept in every room, independent of room state (per-room hideable). */
  essentials?: EssentialTab[]
  /** Background update checks + auto-download (default on). */
  autoUpdate?: boolean
  /** Minutes before an inactive background tab is unloaded; 0 = never (default 20). */
  tabSleepMinutes?: number
  /**
   * Per-button rail placement: overlay id → which bar its button lives on.
   * Buttons are drag-and-drop between the sidebar rail and the title bar;
   * anything unset falls back to the sidebar.
   */
  railPlacement?: Record<string, 'sidebar' | 'titlebar'>
  /** Follow the OS light/dark preference instead of a fixed theme. */
  followSystemTheme?: boolean
  /** Custom window icon: a stored filename under ~/Wisp/icons, or unset. */
  appIcon?: string
  /** Turn off gpu compositing/decode for machines where video renders black. Needs restart. */
  disableHwAccel?: boolean
  /** Play a small chime when a focus session ends (default on). */
  timerSound?: boolean
}

/** One remembered address-bar/search query (~/Wisp/searches.json). */
export interface SearchStat {
  q: string
  count: number
  lastAt: string
}

/** What's playing in some tab, for the sidebar music widget. */
export interface MediaState {
  tabId: string
  title: string
  playing: boolean
}

/** Memory usage snapshot for the sidebar RAM widget (bytes). */
export interface MemoryStats {
  app: number
  sysUsed: number
  sysTotal: number
}

/** A password-vault entry as the renderer sees it — never with the secret. */
export interface VaultEntryMeta {
  id: string
  site: string
  username: string
  updatedAt: string
}

/** Search results returned by the main-process search aggregator. */
export interface SearchResults {
  query: string
  classification: 'academic' | 'general'
  academic: SourceItem[]
  wiki: SourceItem[]
  images: SourceItem[]
  web: SourceItem[]
  pdfs: SourceItem[]
  errors: string[]
  /** Raw API responses, for the dev-mode JSON viewer. */
  raw?: Record<string, unknown>
}

/** One entry in the download manager (file downloads and yt-dlp video clips). */
export interface DownloadInfo {
  id: string
  filename: string
  path: string
  url: string
  state: 'progress' | 'done' | 'failed' | 'canceled'
  received: number
  /** 0 when the size is unknown (e.g. streamed video clips). */
  total: number
  startedAt: string
}

/** A hit from the room-wide full-text search. */
export interface RoomSearchHit {
  type: 'note' | 'source' | 'clip' | 'history'
  id: string
  title: string
  snippet: string
  url?: string
}
