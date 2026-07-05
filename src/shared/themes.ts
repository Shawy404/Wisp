// Wisp. © Shawy404, MIT.
import type { ThemeId } from './types'
import type { TKey } from './i18n'

/**
 * The theme registry. Each theme is a full remap of the neutral scale in
 * styles.css (class `wisp-<id>` on <html>; `dark` is the :root default).
 * `preview` drives the swatch card in Settings: [background, surface, text].
 */
export interface ThemeDef {
  id: ThemeId
  /** i18n key for the display name. */
  nameKey: TKey
  /** Light themes flip the text/background relationship. */
  light: boolean
  preview: [string, string, string]
}

export const THEMES: ThemeDef[] = [
  { id: 'dark', nameKey: 'settings.theme.dark', light: false, preview: ['#0e0e12', '#1f1f23', '#e5e5e5'] },
  { id: 'midnight', nameKey: 'settings.theme.midnight', light: false, preview: ['#0d1220', '#1b2540', '#eaeff7'] },
  { id: 'forest', nameKey: 'settings.theme.forest', light: false, preview: ['#0d1410', '#1c2a22', '#ecf2ee'] },
  { id: 'plum', nameKey: 'settings.theme.plum', light: false, preview: ['#131019', '#262034', '#f0eef7'] },
  { id: 'light', nameKey: 'settings.theme.light', light: true, preview: ['#faf9f6', '#e4e2da', '#1a1815'] },
  { id: 'sepia', nameKey: 'settings.theme.sepia', light: true, preview: ['#f6efe3', '#dfd1b9', '#1c1710'] }
]

export const THEME_IDS = THEMES.map((t) => t.id)
