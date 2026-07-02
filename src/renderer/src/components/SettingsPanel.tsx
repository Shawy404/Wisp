// Wisp — © Shawy404. All rights reserved.
import { useState } from 'react'
import { THEMES } from '@shared/themes'
import { invoke, useApp, useT } from '@/store'
import type { SearchEngineId, WispConfig } from '@shared/types'

const PRESET_ACCENTS = ['#7dd3a8', '#8ab4f8', '#f8b48a', '#c58af8', '#f87d9a', '#e8d47d']

const SEARCH_ENGINES: { id: SearchEngineId; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'duckduckgo', name: 'DuckDuckGo' },
  { id: 'bing', name: 'Bing' },
  { id: 'brave', name: 'Brave' }
]

function Section(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-b border-neutral-800 py-5">
      <div className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

export default function SettingsPanel(): React.JSX.Element {
  const config = useApp((s) => s.config)
  const { setConfig } = useApp.getState()
  const t = useT()
  const [apiKey, setApiKey] = useState(config?.anthropicApiKey ?? '')
  const [allowlistText, setAllowlistText] = useState((config?.adblockAllowlist ?? []).join('\n'))
  // Window transparency is decided at window creation → offer a relaunch
  // right after the toggle changes.
  const [needsRestart, setNeedsRestart] = useState(false)

  const pickBackground = async (): Promise<void> => {
    const res = await invoke<{ dataUrl: string | null; config: WispConfig } | null>('bg:pick')
    if (res) {
      useApp.getState().setBackgroundUrl(res.dataUrl)
      useApp.setState({ config: res.config })
    }
  }
  const resetBackground = async (mode: 'icon' | 'none'): Promise<void> => {
    const res = await invoke<{ dataUrl: string | null; config: WispConfig }>('bg:reset', mode)
    useApp.getState().setBackgroundUrl(res.dataUrl)
    useApp.setState({ config: res.config })
  }

  if (!config) return <div />

  return (
    <div className="absolute inset-0 overflow-y-auto bg-neutral-950">
      <div className="mx-auto max-w-2xl px-8 py-6">
        <h1 className="mb-2 text-xl font-semibold text-neutral-100">{t('settings.title')}</h1>
        <p className="mb-4 text-xs text-neutral-600">
          {t('settings.subtitle')} <code className="text-neutral-500">~/Wisp/config.json</code>.{' '}
          {t('settings.subtitle.noCloud')}
        </p>

        <Section title={t('settings.language')}>
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

        <Section title={t('settings.theme')}>
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

        <Section title={t('settings.background')}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void pickBackground()}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              {t('settings.background.choose')}
            </button>
            <button
              onClick={() => void resetBackground('icon')}
              className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {t('settings.background.icon')}
            </button>
            <button
              onClick={() => void resetBackground('none')}
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

        <Section title={t('settings.searchEngine')}>
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

        <Section title={t('settings.adblock')}>
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
          <Section title={t('settings.zap')}>
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

        <Section title={t('settings.devMode')}>
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.devMode ?? false}
              onChange={(e) => void setConfig({ devMode: e.target.checked })}
            />
            {t('settings.devMode.toggle')}
          </label>
        </Section>

        <Section title={t('settings.ai')}>
          <div className="mb-1 text-[11px] text-neutral-500">{t('settings.ai.hint')}</div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-accent/60"
              spellCheck={false}
            />
            <button
              className="rounded-md bg-accent/15 px-3 py-2 text-xs text-accent hover:bg-accent/25"
              onClick={() => void setConfig({ anthropicApiKey: apiKey.trim() || undefined })}
            >
              {t('settings.ai.save')}
            </button>
          </div>
        </Section>

        <Section title={t('settings.profile')}>
          <div className="flex items-center gap-2">
            <input
              value={config.profile}
              onChange={(e) => void setConfig({ profile: e.target.value })}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-accent/60"
            />
            <span className="text-[11px] text-neutral-600">{t('settings.profile.hint')}</span>
          </div>
        </Section>

        <div className="py-4 text-center text-[10px] text-neutral-700">{t('settings.footer')}</div>
      </div>
    </div>
  )
}
