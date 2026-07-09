// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'
import { THEMES } from '@shared/themes'
import { CHANGELOG } from '@shared/changelog'
import { invoke, useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'
import type { SearchEngineId, WispConfig } from '@shared/types'

const PRESET_ACCENTS = ['#7dd3a8', '#8ab4f8', '#f8b48a', '#c58af8', '#f87d9a', '#e8d47d']

const SEARCH_ENGINES: { id: SearchEngineId; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'duckduckgo', name: 'DuckDuckGo' },
  { id: 'bing', name: 'Bing' },
  { id: 'brave', name: 'Brave' }
]

/** Settings are grouped into these tabs; search cuts across all of them. */
type Cat = 'appearance' | 'general' | 'search' | 'privacy' | 'memory' | 'updates'
const CATS: { id: Cat; key: TKey }[] = [
  { id: 'appearance', key: 'settings.cat.appearance' },
  { id: 'general', key: 'settings.cat.general' },
  { id: 'search', key: 'settings.cat.search' },
  { id: 'privacy', key: 'settings.cat.privacy' },
  { id: 'memory', key: 'settings.cat.memory' },
  { id: 'updates', key: 'settings.cat.updates' }
]

/** Tab sleep choices, in minutes; 0 = never unload. */
const SLEEP_CHOICES = [5, 10, 20, 45, 0]

export default function SettingsPanel(): React.JSX.Element {
  const config = useApp((s) => s.config)
  const { setConfig } = useApp.getState()
  const t = useT()
  const lang = config?.language ?? 'tr'
  const [allowlistText, setAllowlistText] = useState((config?.adblockAllowlist ?? []).join('\n'))
  // Window transparency is decided at window creation → offer a relaunch
  // right after the toggle changes.
  const [needsRestart, setNeedsRestart] = useState(false)
  const [version, setVersion] = useState('')
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'upToDate' | 'found'>('idle')
  const [foundVersion, setFoundVersion] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [activeCat, setActiveCat] = useState<Cat>('appearance')
  const [query, setQuery] = useState('')

  useEffect(() => {
    void invoke<string>('app:version').then(setVersion)
  }, [])

  // A section shows when its tab is active, or — while searching — whenever the
  // query matches its title or its keyword terms (search ignores tabs).
  const q = query.trim().toLowerCase()
  const Section = (props: {
    title: string
    cat: Cat
    terms?: string
    children: React.ReactNode
  }): React.JSX.Element | null => {
    const hay = `${props.title} ${props.terms ?? ''}`.toLowerCase()
    const visible = q ? hay.includes(q) : props.cat === activeCat
    if (!visible) return null
    return (
      <div className="border-b border-neutral-800 py-5">
        <div className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          {props.title}
        </div>
        {props.children}
      </div>
    )
  }

  const checkUpdates = async (): Promise<void> => {
    setCheckState('checking')
    const res = await invoke<{ updateAvailable: boolean; version?: string }>('update:check')
    if (res.updateAvailable && res.version) {
      setFoundVersion(res.version)
      setCheckState('found')
    } else {
      setCheckState('upToDate')
    }
  }

  const pickBackground = async (): Promise<void> => {
    const res = await invoke<{ dataUrl: string | null; config: WispConfig } | null>('bg:pick')
    if (res) {
      useApp.getState().setBackgroundUrl(res.dataUrl)
      useApp.setState({ config: res.config })
    }
  }
  const resetBackground = async (): Promise<void> => {
    const res = await invoke<{ dataUrl: string | null; config: WispConfig }>('bg:reset')
    useApp.getState().setBackgroundUrl(res.dataUrl)
    useApp.setState({ config: res.config })
  }

  if (!config) return <div />

  return (
    <div className="wisp-panel absolute inset-0 overflow-y-auto bg-neutral-950">
      <div className="mx-auto max-w-2xl px-8 py-6">
        <h1 className="mb-2 text-xl font-semibold text-neutral-100">{t('settings.title')}</h1>
        <p className="mb-4 text-xs text-neutral-600">
          {t('settings.subtitle')} <code className="text-neutral-500">~/Wisp/config.json</code>.{' '}
          {t('settings.subtitle.noCloud')}
        </p>

        {/* Search + category tabs. Sticky so they stay reachable while scrolling. */}
        <div className="sticky top-0 z-10 -mx-8 mb-1 bg-neutral-950/95 px-8 pt-1 pb-3 backdrop-blur">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('settings.searchPlaceholder')}
            className="mb-3 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
            spellCheck={false}
          />
          {!q && (
            <div className="flex flex-wrap gap-1.5">
              {CATS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    activeCat === c.id
                      ? 'bg-accent/15 text-accent'
                      : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                  }`}
                >
                  {t(c.key)}
                </button>
              ))}
            </div>
          )}
          {q && <div className="text-[11px] text-neutral-500">{t('settings.searchingAll')}</div>}
        </div>

        <Section cat="general" terms={t('settings.language')} title={t('settings.language')}>
          <div className="flex items-center gap-2">
            {(['tr', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => void setConfig({ language: l })}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  config.language === l
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {l === 'tr' ? t('settings.language.tr') : t('settings.language.en')}
              </button>
            ))}
          </div>
        </Section>

        <Section cat="appearance" terms={`${t('settings.theme')} ${t('settings.accent')} ${t('settings.background')}`} title={t('settings.theme')}>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => void setConfig({ theme: theme.id })}
                className={`overflow-hidden rounded-lg border text-left ${
                  config.theme === theme.id
                    ? 'border-accent'
                    : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div
                  className="flex h-12 items-end gap-1 p-2"
                  style={{ background: theme.preview[0] }}
                >
                  <div
                    className="h-4 flex-1 rounded-sm"
                    style={{ background: theme.preview[1] }}
                  />
                  <div
                    className="h-2 w-6 rounded-sm"
                    style={{ background: theme.preview[2], opacity: 0.7 }}
                  />
                </div>
                <div
                  className={`px-2 py-1.5 text-[11px] ${
                    config.theme === theme.id ? 'text-neutral-100' : 'text-neutral-500'
                  }`}
                >
                  {t(theme.nameKey)}
                </div>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.followSystemTheme ?? false}
              onChange={(e) => void setConfig({ followSystemTheme: e.target.checked })}
            />
            {t('settings.theme.system')}
          </label>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-neutral-500">{t('settings.accent')}</span>
            {PRESET_ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => void setConfig({ accent: c })}
                className={`h-5 w-5 rounded-full border-2 ${config.accent === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              value={config.accent}
              onChange={(e) => void setConfig({ accent: e.target.value })}
              className="h-5 w-8 cursor-pointer rounded bg-transparent"
              title={t('settings.accent.custom')}
            />
          </div>
        </Section>

        <Section cat="appearance" terms={`${t('settings.background')} ${t('settings.background.translucent')}`} title={t('settings.background')}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void pickBackground()}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              {t('settings.background.choose')}
            </button>
            <button
              onClick={() => void resetBackground()}
              className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {t('settings.background.none')}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                <span>{t('settings.background.opacity')}</span>
                <span>{Math.round((config.backgroundOpacity ?? 0.15) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.7}
                step={0.01}
                value={config.backgroundOpacity ?? 0.15}
                onChange={(e) => void setConfig({ backgroundOpacity: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                <span>{t('settings.background.blur')}</span>
                <span>{config.backgroundBlur ?? 0}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={config.backgroundBlur ?? 0}
                onChange={(e) => void setConfig({ backgroundBlur: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={config.translucentUi ?? false}
                onChange={(e) => void setConfig({ translucentUi: e.target.checked })}
              />
              {t('settings.background.translucent')}
            </label>
            <div>
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={config.windowTransparent ?? false}
                  onChange={(e) => {
                    void setConfig({ windowTransparent: e.target.checked })
                    setNeedsRestart(true)
                  }}
                />
                {t('settings.background.windowTransparent')}
              </label>
              <div className="mt-1 ml-6 text-[11px] text-neutral-600">
                {t('settings.background.windowTransparent.hint')}
              </div>
              {needsRestart && (
                <button
                  className="mt-2 ml-6 rounded-md bg-accent/15 px-3 py-1.5 text-xs text-accent hover:bg-accent/25"
                  onClick={() => void invoke('app:relaunch')}
                >
                  {t('settings.background.restart')}
                </button>
              )}
            </div>
          </div>
        </Section>

        <Section cat="appearance" terms={t('settings.appIcon.hint')} title={t('settings.appIcon')}>
          <div className="mb-2 text-[11px] text-neutral-500">{t('settings.appIcon.hint')}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                void invoke<WispConfig | null>('appicon:pick').then((cfg) => {
                  if (cfg) useApp.setState({ config: cfg })
                })
              }
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              {t('settings.appIcon.choose')}
            </button>
            {config.appIcon && (
              <button
                onClick={() =>
                  void invoke<WispConfig>('appicon:reset').then((cfg) =>
                    useApp.setState({ config: cfg })
                  )
                }
                className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
              >
                {t('settings.appIcon.reset')}
              </button>
            )}
          </div>
        </Section>

        <Section cat="appearance" terms={t('settings.compact.hint')} title={t('settings.compact')}>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={config.compactSidebar ?? false}
                onChange={(e) => void setConfig({ compactSidebar: e.target.checked })}
              />
              {t('settings.compact.sidebar')}
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={config.compactToolbar ?? false}
                onChange={(e) => void setConfig({ compactToolbar: e.target.checked })}
              />
              {t('settings.compact.toolbar')}
            </label>
          </div>
          <div className="mt-1 ml-6 text-[11px] text-neutral-600">{t('settings.compact.hint')}</div>
          {(config.compactSidebar || config.compactToolbar) && (
            <div className="mt-3 ml-6 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                  <span>{t('settings.compact.reveal')}</span>
                  <span>{config.compactRevealPx ?? 10}px</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={24}
                  step={1}
                  value={config.compactRevealPx ?? 10}
                  onChange={(e) => void setConfig({ compactRevealPx: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                  <span>{t('settings.compact.delay')}</span>
                  <span>{config.compactHideDelayMs ?? 400}ms</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={1200}
                  step={50}
                  value={config.compactHideDelayMs ?? 400}
                  onChange={(e) => void setConfig({ compactHideDelayMs: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          )}
        </Section>

        <Section cat="memory" terms={t('settings.memory.hint')} title={t('settings.memory')}>
          <div className="mb-2 text-[11px] text-neutral-500">{t('settings.memory.hint')}</div>
          <div className="flex flex-wrap items-center gap-2">
            {SLEEP_CHOICES.map((min) => (
              <button
                key={min}
                onClick={() => void setConfig({ tabSleepMinutes: min })}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  (config.tabSleepMinutes ?? 20) === min
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {min === 0 ? t('settings.memory.never') : t('settings.memory.minutes', { min })}
              </button>
            ))}
          </div>
          <button
            className="mt-3 rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
            onClick={() =>
              void invoke('tabs:freeMemory').then(() =>
                window.dispatchEvent(
                  new CustomEvent('wisp:toast-local', { detail: t('widgets.slept') })
                )
              )
            }
          >
            {t('settings.memory.sleepNow')}
          </button>
        </Section>

        <Section cat="updates" terms={t('settings.updates.auto')} title={t('settings.updates')}>
          <div className="mb-2 text-[11px] text-neutral-500">
            {t('settings.updates.current', { version: version || '…' })}
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.autoUpdate ?? true}
              onChange={(e) => void setConfig({ autoUpdate: e.target.checked })}
            />
            {t('settings.updates.auto')}
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              className="rounded-md bg-accent/15 px-3 py-1.5 text-xs text-accent hover:bg-accent/25 disabled:opacity-40"
              onClick={() => void checkUpdates()}
              disabled={checkState === 'checking'}
            >
              {checkState === 'checking' ? t('settings.updates.checking') : t('settings.updates.check')}
            </button>
            {checkState === 'upToDate' && (
              <span className="text-[11px] text-neutral-500">{t('settings.updates.upToDate')}</span>
            )}
            {checkState === 'found' && (
              <span className="text-[11px] text-accent">
                {t('settings.updates.found', { version: foundVersion })}
              </span>
            )}
          </div>
          <button
            className="mt-3 text-[11px] text-neutral-500 hover:text-neutral-300"
            onClick={() => window.dispatchEvent(new CustomEvent('wisp:demo-update'))}
          >
            {t('settings.updates.preview')}
          </button>
        </Section>

        {/* Its own section: every version and what changed in it. */}
        <Section cat="updates" terms={t('settings.changelog.hint')} title={t('settings.changelog')}>
          <div className="mb-3 text-[11px] text-neutral-500">{t('settings.changelog.hint')}</div>
          <div className="space-y-3">
            {(showLog ? CHANGELOG : CHANGELOG.slice(0, 2)).map((entry) => (
              <div key={entry.version} className="rounded-md border border-neutral-800 bg-neutral-900/50 p-3">
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-neutral-100">{entry.version}</span>
                  <span className="text-[10px] text-neutral-600">{entry.date}</span>
                </div>
                <ul className="space-y-1">
                  {entry.notes[lang].map((note, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-neutral-400">
                      <span className="text-accent">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {CHANGELOG.length > 2 && (
            <button
              className="mt-3 text-[11px] text-neutral-500 hover:text-neutral-300"
              onClick={() => setShowLog((v) => !v)}
            >
              {showLog ? t('settings.changelog.less') : t('settings.changelog.more', { count: CHANGELOG.length - 2 })}
            </button>
          )}
        </Section>

        <Section cat="search" terms={t('settings.searchEngine.hint')} title={t('settings.searchEngine')}>
          <div className="mb-2 text-[11px] text-neutral-500">{t('settings.searchEngine.hint')}</div>
          <div className="flex items-center gap-2">
            {SEARCH_ENGINES.map((engine) => (
              <button
                key={engine.id}
                onClick={() => void setConfig({ searchEngine: engine.id })}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  (config.searchEngine ?? 'google') === engine.id
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {engine.name}
              </button>
            ))}
          </div>
        </Section>

        <Section cat="privacy" terms={t('settings.adblock.toggle')} title={t('settings.adblock')}>
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.adblock}
              onChange={(e) => void setConfig({ adblock: e.target.checked })}
            />
            {t('settings.adblock.toggle')}
          </label>
          <div className="mt-3">
            <div className="mb-1 text-[11px] text-neutral-500">
              {t('settings.adblock.allowlistLabel')}
            </div>
            <textarea
              value={allowlistText}
              onChange={(e) => setAllowlistText(e.target.value)}
              onBlur={() =>
                void setConfig({
                  adblockAllowlist: allowlistText
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                })
              }
              placeholder={t('settings.adblock.allowlistPlaceholder')}
              className="h-20 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-accent/60"
              spellCheck={false}
            />
          </div>
        </Section>

        {Object.keys(config.zappedSelectors ?? {}).length > 0 && (
          <Section cat="privacy" terms={t('settings.zap.hint')} title={t('settings.zap')}>
            <div className="mb-2 text-[11px] text-neutral-500">{t('settings.zap.hint')}</div>
            <div className="space-y-1">
              {Object.entries(config.zappedSelectors ?? {}).map(([host, sels]) => (
                <div
                  key={host}
                  className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate text-neutral-200">{host}</span>
                  <span className="text-[10px] text-neutral-600">
                    {t('settings.zap.count', { count: sels.length })}
                  </span>
                  <button
                    className="text-neutral-500 hover:text-red-400"
                    onClick={() => {
                      const next = { ...(config.zappedSelectors ?? {}) }
                      delete next[host]
                      void setConfig({ zappedSelectors: next })
                    }}
                  >
                    {t('settings.zap.clear')}
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section cat="general" terms={t('settings.devMode.toggle')} title={t('settings.devMode')}>
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.devMode ?? false}
              onChange={(e) => void setConfig({ devMode: e.target.checked })}
            />
            {t('settings.devMode.toggle')}
          </label>
        </Section>

        {/* the test bench. only shows itself in dev mode, so normal people
            never wonder why settings has a "pretend an update arrived" button */}
        {config.devMode && (
          <Section cat="general" terms={t('settings.devTools.hint')} title={t('settings.devTools')}>
            <div className="mb-2 text-[11px] text-neutral-500">{t('settings.devTools.hint')}</div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                onClick={() => void setConfig({ onboarded: false })}
              >
                {t('settings.devTools.tour')}
              </button>
              <button
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                onClick={() => window.dispatchEvent(new CustomEvent('wisp:demo-update'))}
              >
                {t('settings.devTools.update')}
              </button>
              <button
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('wisp:toast-local', { detail: t('settings.devTools.toastDemoText') })
                  )
                }}
              >
                {t('settings.devTools.toast')}
              </button>
            </div>
          </Section>
        )}

        <Section cat="general" terms={t('settings.profile.hint')} title={t('settings.profile')}>
          <div className="flex items-center gap-2">
            <input
              value={config.profile}
              onChange={(e) => void setConfig({ profile: e.target.value })}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-accent/60"
            />
            <span className="text-[11px] text-neutral-600">{t('settings.profile.hint')}</span>
          </div>
        </Section>

        <Section
          cat="general"
          terms={`${t('settings.help')} split view drag wikilink kısayol shortcut nasıl how`}
          title={t('settings.help')}
        >
          <ul className="space-y-2 text-[11px] leading-relaxed text-neutral-400">
            <li>· {t('settings.help.rooms')}</li>
            <li>· {t('settings.help.search')}</li>
            <li>· {t('settings.help.split')}</li>
            <li>· {t('settings.help.notes')}</li>
            <li>· {t('settings.help.map')}</li>
            <li>· {t('settings.help.essentials')}</li>
            <li>· {t('settings.help.keys')}</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
              onClick={() => {
                useApp.getState().newTab('https://github.com/Shawy404/Wisp')
                useApp.getState().setOverlay('none')
              }}
            >
              {t('settings.help.github')}
            </button>
            <button
              className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
              onClick={() => {
                useApp.getState().newTab('https://github.com/Shawy404/Wisp/issues/new')
                useApp.getState().setOverlay('none')
              }}
            >
              {t('settings.help.issue')}
            </button>
          </div>
        </Section>

        <div className="py-4 text-center text-[10px] text-neutral-700">{t('settings.footer')}</div>
      </div>
    </div>
  )
}
