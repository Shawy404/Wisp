// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import { useApp, useT } from '@/store'

/** A tiny per-room pomodoro. Optional, tucked into the title bar. */
export default function FocusTimer(): React.JSX.Element {
  const config = useApp((s) => s.config)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const t = useT()
  const total = (config?.focusMinutes ?? 25) * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const [open, setOpen] = useState(false)
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
  }, [running])

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
        title={t('focus.title')}
      >
        <span>◔</span>
        {active && <span className="tabular-nums">{mm}:{ss}</span>}
      </button>
      {open && (
        <div className="absolute top-8 right-0 z-30 w-40 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
          <div className="text-center text-2xl font-semibold tabular-nums text-neutral-100">
            {mm}:{ss}
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            <button
              className="rounded bg-accent/15 px-2.5 py-1 text-[11px] text-accent hover:bg-accent/25"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? t('focus.pause') : t('focus.start')}
            </button>
            <button
              className="rounded bg-neutral-800 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
              onClick={() => {
                setRunning(false)
                setRemaining(total)
              }}
            >
              {t('focus.reset')}
            </button>
          </div>
          <div className="mt-2 text-center text-[10px] text-neutral-600">
            {t('focus.minutesRoom', {
              minutes: config?.focusMinutes ?? 25,
              room: activeRoomId ?? t('focus.room')
            })}
          </div>
        </div>
      )}
    </div>
  )
}
