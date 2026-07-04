// Wisp — © Shawy404. All rights reserved.
import type { Overlay } from '@/store'
import type { TKey } from '@shared/i18n'
import type { WispConfig } from '@shared/types'

export type RailLocation = 'sidebar' | 'titlebar'

export interface RailItem {
  id: Overlay
  titleKey: TKey
  icon: string
  /** Rail buttons split into two logical groups for the in-sidebar divider. */
  group: 'content' | 'system'
}

/**
 * Every panel button that lives on a rail. Content is what you research with;
 * system is app plumbing. Each button can be dragged between the sidebar rail
 * and the title bar (config.railPlacement); the group only controls the little
 * divider drawn between the two clusters while they share the sidebar. History
 * is deliberately absent — it lives on Ctrl+H and in the command palette.
 */
export const ALL_RAIL: RailItem[] = [
  { id: 'search', titleKey: 'sidebar.search', icon: '⌕', group: 'content' },
  { id: 'sources', titleKey: 'sidebar.sources', icon: '▤', group: 'content' },
  { id: 'notes', titleKey: 'sidebar.notes', icon: '✎', group: 'content' },
  { id: 'map', titleKey: 'sidebar.map', icon: '❋', group: 'content' },
  { id: 'split', titleKey: 'sidebar.split', icon: '◫', group: 'system' },
  { id: 'downloads', titleKey: 'sidebar.downloads', icon: '⇣', group: 'system' },
  { id: 'vault', titleKey: 'sidebar.vault', icon: '⚿', group: 'system' },
  { id: 'settings', titleKey: 'sidebar.settings', icon: '⚙', group: 'system' }
]

/** Where a given rail button lives, honouring the config (default: sidebar). */
export function railLocation(config: WispConfig | null, id: Overlay): RailLocation {
  return config?.railPlacement?.[id] ?? 'sidebar'
}

/** The buttons currently placed on one bar, in their canonical order. */
export function railItemsFor(config: WispConfig | null, location: RailLocation): RailItem[] {
  return ALL_RAIL.filter((item) => railLocation(config, item.id) === location)
}

/** Drag-and-drop payload type carried when a rail button is dragged. */
export const RAIL_DND_TYPE = 'wisp/rail-item'
