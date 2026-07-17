// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'

export default function Toast(): React.JSX.Element | null {
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const show = (text: string): void => {
      setMsg(text)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 2200)
    }
    const off = window.wisp.on('toast', (text) => show(text as string))
    const local = (e: Event): void => show((e as CustomEvent<string>).detail)
    window.addEventListener('wisp:toast-local', local as EventListener)
    return () => {
      off()
      window.removeEventListener('wisp:toast-local', local as EventListener)
      clearTimeout(timer)
    }
  }, [])

  if (!msg) return null
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2" aria-live="polite">
      <div className="wisp-toast-in rounded-full border border-neutral-700 bg-neutral-900/95 px-4 py-2 text-xs text-neutral-200 shadow-xl">
        {msg}
      </div>
    </div>
  )
}
