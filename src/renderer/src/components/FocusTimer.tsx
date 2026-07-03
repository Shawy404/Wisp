// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import { invoke, useApp, useT } from '@/store'

const PRESETS = [15, 25, 45, 60]

/**
 * Per-room focus timer. The countdown lives in the title bar; clicking it
 * opens a centered dialog (the old dropdown rendered *under* the native page
 * view and was invisible whenever a site was open — the reason it felt
 * broken). Duration is configurable: pomodoro presets or any custom minutes,
 * persisted in config.focusMinutes.
 */
export default function FocusTimer(): React.JSX.Element {
  const config = useApp((s) => s.config)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const t = useT()
  const total = (config?.focusMinutes ?? 25) * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset the clock when switching rooms — sessions are per-room.
  useEffect(() => {
    setRunning(false)
    setRemaining(total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, total])

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false)
            window.dispatchEvent(
              new CustomEvent('wisp:toast-local', { detail: t('focus.sessionDone') })
            )
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => {
      if (tick.current) clearInterval(tick.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // The dialog floats over the page area — hide the native view meanwhile.
  useEffect(() => {
    if (open) void invoke('viewport:visible', false)
    else void invoke('viewport:visible', useApp.getState().overlay === 'none')
  }, [open])

  const setMinutes = (minutes: number): void => {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) return
    void useApp.getState().setConfig({ focusMinutes: Math.round(minutes) })
    setRunning(false)
    setRemaining(Math.round(minutes) * 60)
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const active = running || remaining < total

  return (
    <div className="no-drag relative flex items-center">
      <button
        className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] ${
          active ? 'text-accent' : 'text-neutral-500 hover:text-neutral-300'
        }`}
        onClick={() => setOpen((v) => !v)}
        data-tip={t('focus.title')}
        data-tip-pos="bottom"
      >
        <span>◔</span>
        {active && <span className="tabular-nums">{mm}:{ss}</span>}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-28"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-72 rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-4xl font-semibold tabular-nums text-neutral-100">
              {mm}:{ss}
            </div>

            {/* Session length: pomodoro presets or your own number. */}
            <div className="mt-3 flex items-center justify-center gap-1">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  className={`rounded-md px-2 py-1 text-[11px] tabular-nums ${
                    (config?.focusMinutes ?? 25) === m
                      ? 'bg-accent/15 text-accent'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                  }`}
                  onClick={() => setMinutes(m)}
                >
                  {m}
                </button>
              ))}
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && custom) {
                    setMinutes(Number(custom))
                    setCustom('')
                  }
                }}
                placeholder={t('focus.customMin')}
                className="h-6 w-14 rounded-md border border-neutral-800 bg-neutral-950 px-1.5 text-center text-[11px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
              />
            </div>

            <div className="mt-3 flex justify-center gap-1.5">
              <button
                className="rounded-md bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent hover:bg-accent/25"
                onClick={() => setRunning((r) => !r)}
              >
                {running ? t('focus.pause') : t('focus.start')}
              </button>
              <button
                className="rounded-md bg-neutral-800 px-4 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
                onClick={() => {
                  setRunning(false)
                  setRemaining(total)
                }}
              >
                {t('focus.reset')}
              </button>
            </div>

            <div className="mt-2.5 text-center text-[10px] text-neutral-600">
              {t('focus.minutesRoom', {
                minutes: config?.focusMinutes ?? 25,
                room: activeRoomId ?? t('focus.room')
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
