// Wisp — © Shawy404. All rights reserved.
import type { Overlay } from '@/store'
import type { TKey } from '@shared/i18n'

export interface RailItem {
  overlay: Overlay
  titleKey: TKey
  icon: string
}

/**
 * The panel rail, split into two logical groups. Content is what you research
 * with; system is app plumbing. History is deliberately absent — it lives on
 * Ctrl+H and in the command palette, not on the rail. The system group can be
 * moved to the title bar from Settings (config.railSystemGroup).
 */
export const CONTENT_RAIL: RailItem[] = [
  { overlay: 'search', titleKey: 'sidebar.search', icon: '⌕' },
  { overlay: 'sources', titleKey: 'sidebar.sources', icon: '▤' },
  { overlay: 'notes', titleKey: 'sidebar.notes', icon: '✎' },
  { overlay: 'map', titleKey: 'sidebar.map', icon: '❋' }
]

export const SYSTEM_RAIL: RailItem[] = [
  { overlay: 'split', titleKey: 'sidebar.split', icon: '◫' },
  { overlay: 'downloads', titleKey: 'sidebar.downloads', icon: '⇣' },
  { overlay: 'vault', titleKey: 'sidebar.vault', icon: '⚿' },
  { overlay: 'settings', titleKey: 'sidebar.settings', icon: '⚙' }
]
