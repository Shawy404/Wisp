// Wisp — © Shawy404. All rights reserved.
import { useState } from 'react'
import { useApp } from '@/store'

const PRESET_ACCENTS = ['#7dd3a8', '#8ab4f8', '#f8b48a', '#c58af8', '#f87d9a', '#e8d47d']

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
  const [apiKey, setApiKey] = useState(config?.anthropicApiKey ?? '')
  const [allowlistText, setAllowlistText] = useState((config?.adblockAllowlist ?? []).join('\n'))

  if (!config) return <div />

  return (
    <div className="absolute inset-0 overflow-y-auto bg-neutral-950">
      <div className="mx-auto max-w-2xl px-8 py-6">
        <h1 className="mb-2 text-xl font-semibold text-neutral-100">Ayarlar</h1>
        <p className="mb-4 text-xs text-neutral-600">
          Her şey diskte: <code className="text-neutral-500">~/Wisp/config.json</code>. Bulut yok.
        </p>

        <Section title="Tema">
          <div className="flex items-center gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => void setConfig({ theme: t })}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  config.theme === t
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t === 'dark' ? 'Koyu' : 'Açık'}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-neutral-500">Vurgu rengi</span>
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
              title="Özel hex"
            />
          </div>
        </Section>

        <Section title="Reklam engelleme">
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.adblock}
              onChange={(e) => void setConfig({ adblock: e.target.checked })}
            />
            EasyList + EasyPrivacy ile reklam ve izleyici engelle
          </label>
          <div className="mt-3">
            <div className="mb-1 text-[11px] text-neutral-500">
              Site istisnaları (her satıra bir host — bu sitelerde engelleme kapanır)
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
              placeholder="example.com&#10;news.site"
              className="h-20 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-accent/60"
              spellCheck={false}
            />
          </div>
        </Section>

        <Section title="Web geliştirici modu">
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.devMode ?? false}
              onChange={(e) => void setConfig({ devMode: e.target.checked })}
            />
            DevTools erişimi + arama sonuçları için JSON görüntüleyici (oda-bazlı, hafif)
          </label>
        </Section>

        <Section title="AI — Bağlantı önerileri">
          <div className="mb-1 text-[11px] text-neutral-500">
            Anthropic API anahtarı ('Bağlantıları bul' için; yalnızca istek üzerine kullanılır)
          </div>
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
              Kaydet
            </button>
          </div>
        </Section>

        <Section title="Profil">
          <div className="flex items-center gap-2">
            <input
              value={config.profile}
              onChange={(e) => void setConfig({ profile: e.target.value })}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-accent/60"
            />
            <span className="text-[11px] text-neutral-600">
              (çoklu profil için — şimdilik etiket)
            </span>
          </div>
        </Section>

        <div className="py-4 text-center text-[10px] text-neutral-700">
          Wisp — © Shawy404. All rights reserved.
        </div>
      </div>
    </div>
  )
}
