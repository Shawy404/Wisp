// Wisp — © Shawy404. All rights reserved.
import { useEffect, useState } from 'react'
import { invoke, useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'

const STEPS: { glyph: string; title: TKey; body: TKey }[] = [
  { glyph: '◉', title: 'onboard.rooms.title', body: 'onboard.rooms.body' },
  { glyph: '⌕', title: 'onboard.search.title', body: 'onboard.search.body' },
  { glyph: '✂', title: 'onboard.clip.title', body: 'onboard.clip.body' },
  { glyph: '❋', title: 'onboard.map.title', body: 'onboard.map.body' },
  { glyph: '⌨', title: 'onboard.keys.title', body: 'onboard.keys.body' }
]

/**
 * First-run tour: language first, then five short cards about how Wisp works.
 * Skippable at any point; finishing (or skipping) sets config.onboarded so it
 * never shows again.
 */
export default function Onboarding(): React.JSX.Element {
  const t = useT()
  // -1 = language picker; 0..4 = tour cards.
  const [step, setStep] = useState(-1)

  // The tour owns the whole window; keep the native page view out of the way.
  useEffect(() => {
    void invoke('viewport:visible', false)
    return () => {
      void invoke('viewport:visible', useApp.getState().overlay === 'none')
    }
  }, [])

  const finish = (): void => {
    void useApp.getState().setConfig({ onboarded: true })
  }
  const pickLanguage = (lang: 'tr' | 'en'): void => {
    void useApp.getState().setConfig({ language: lang })
    setStep(0)
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-neutral-950">
      <div className="relative flex w-[460px] flex-col items-center rounded-2xl border border-neutral-800 bg-neutral-925 px-8 pt-10 pb-8 shadow-2xl shadow-black/50">
        {step >= 0 && (
          <button
            className="absolute top-3 right-4 text-[11px] text-neutral-600 hover:text-neutral-300"
            onClick={finish}
          >
            {t('onboard.skip')}
          </button>
        )}

        {step === -1 ? (
          <>
            <div className="mb-1 text-3xl font-semibold tracking-tight text-accent">Wisp</div>
            <div className="mb-1 text-sm text-neutral-200">{t('onboard.lang.title')}</div>
            <div className="mb-6 text-[11px] text-neutral-500">{t('onboard.lang.sub')}</div>
            <div className="flex gap-3">
              <button
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-6 py-2.5 text-sm text-neutral-200 hover:border-accent/60 hover:text-accent"
                onClick={() => pickLanguage('tr')}
              >
                Türkçe
              </button>
              <button
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-6 py-2.5 text-sm text-neutral-200 hover:border-accent/60 hover:text-accent"
                onClick={() => pickLanguage('en')}
              >
                English
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-3xl text-accent">
              {STEPS[step].glyph}
            </div>
            <div className="mb-2 text-center text-base font-semibold text-neutral-100">
              {t(STEPS[step].title)}
            </div>
            <div className="mb-6 min-h-[72px] text-center text-xs leading-relaxed text-neutral-400">
              {t(STEPS[step].body)}
            </div>

            <div className="mb-5 flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-5 bg-accent' : 'w-1.5 bg-neutral-700'
                  }`}
                />
              ))}
            </div>

            <div className="flex w-full items-center justify-between">
              <button
                className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-200 disabled:opacity-0"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                {t('onboard.back')}
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  className="rounded-md bg-accent/15 px-5 py-1.5 text-xs font-medium text-accent hover:bg-accent/25"
                  onClick={() => setStep((s) => s + 1)}
                >
                  {t('onboard.next')}
                </button>
              ) : (
                <button
                  className="rounded-md bg-accent/15 px-5 py-1.5 text-xs font-medium text-accent hover:bg-accent/25"
                  onClick={finish}
                >
                  {t('onboard.done')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
