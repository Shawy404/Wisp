// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'
import type { MediaState, MemoryStats } from '@shared/types'
import { invoke, useApp, useT } from '@/store'

function formatGB(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1)
}

/**
 * Small closable widgets above the sidebar rail: a music strip for whatever
 * tab is playing audio, and a memory meter with a "sleep background tabs"
 * broom. Visibility persists in config.sidebarWidgets; closed widgets come
 * back from the little + row.
 */
export default function SidebarWidgets(): React.JSX.Element | null {
  const config = useApp((s) => s.config)
  const t = useT()
  const [media, setMedia] = useState<MediaState | null>(null)
  const [mem, setMem] = useState<MemoryStats | null>(null)

  const show = { music: config?.sidebarWidgets?.music ?? true, ram: config?.sidebarWidgets?.ram ?? true }
  const setShown = (key: 'music' | 'ram', value: boolean): void => {
    void useApp.getState().setConfig({
      sidebarWidgets: { ...useApp.getState().config?.sidebarWidgets, [key]: value }
    })
  }

  useEffect(() => {
    if (!show.music) return
    void invoke<MediaState | null>('media:state').then(setMedia)
    const off = window.wisp.on('media:state', (s) => setMedia(s as MediaState | null))
    const poll = setInterval(() => void invoke<MediaState | null>('media:state').then(setMedia), 3000)
    return () => {
      off()
      clearInterval(poll)
    }
  }, [show.music])

  useEffect(() => {
    if (!show.ram) return
    const tick = (): void => void invoke<MemoryStats>('stats:memory').then(setMem)
    tick()
    const poll = setInterval(tick, 3000)
    return () => clearInterval(poll)
  }, [show.ram])

  const freeMemory = async (): Promise<void> => {
    await invoke('tabs:freeMemory')
    window.dispatchEvent(new CustomEvent('wisp:toast-local', { detail: t('widgets.slept') }))
    setMem(await invoke<MemoryStats>('stats:memory'))
  }

  const hiddenKeys = (['music', 'ram'] as const).filter((k) => !show[k])

  return (
    <div className="space-y-1.5 border-t border-neutral-800/60 p-2">
      {/* Only shown while something is actually playing (or paused-in-place) —
          no idle "nothing playing" row cluttering the sidebar. */}
      {show.music && media && (
        <div className="group rounded-lg border border-neutral-800 bg-neutral-900/50 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500">♪</span>
            <button
              className="min-w-0 flex-1 truncate text-left text-[10px] text-neutral-400 hover:text-neutral-200"
              onClick={() => void invoke('media:focus')}
              title={media.title}
            >
              {media.title}
            </button>
            <button
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] text-accent hover:bg-accent/25"
              onClick={() => void invoke('media:toggle')}
            >
              {media.playing ? '❚❚' : '▶'}
            </button>
          </div>
        </div>
      )}

      {show.ram && (
        <div className="group rounded-lg border border-neutral-800 bg-neutral-900/50 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
            <span className="text-neutral-500">▦</span>
            <span className="min-w-0 flex-1 truncate tabular-nums">
              {mem
                ? `Wisp ${Math.round(mem.app / 1024 ** 2)} MB · ${formatGB(mem.sysUsed)}/${formatGB(mem.sysTotal)} GB`
                : '…'}
            </span>
            <button
              className="shrink-0 text-neutral-500 hover:text-accent"
              onClick={() => void freeMemory()}
              data-tip={t('widgets.freeMemory')}
            >
              ⌁
            </button>
            <button
              className="hidden shrink-0 text-neutral-600 group-hover:inline hover:text-neutral-300"
              onClick={() => setShown('ram', false)}
            >
              ×
            </button>
          </div>
          {mem && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-accent/70"
                style={{ width: `${Math.min(100, (mem.sysUsed / mem.sysTotal) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {hiddenKeys.length > 0 && (
        <div className="flex gap-1">
          {hiddenKeys.map((k) => (
            <button
              key={k}
              className="rounded-full border border-dashed border-neutral-700 px-2 py-0.5 text-[9px] text-neutral-600 hover:border-neutral-500 hover:text-neutral-300"
              onClick={() => setShown(k, true)}
              data-tip={t('widgets.add')}
            >
              + {t(k === 'music' ? 'widgets.music' : 'widgets.ram')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
