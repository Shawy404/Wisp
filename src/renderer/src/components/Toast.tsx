// Wisp — © Shawy404. All rights reserved.
import { useEffect, useState } from 'react'

export default function Toast(): React.JSX.Element | null {
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    return window.wisp.on('toast', (text) => {
      setMsg(text as string)
      const t = setTimeout(() => setMsg(null), 2200)
      return () => clearTimeout(t)
    })
  }, [])

  if (!msg) return null
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded-full border border-neutral-700 bg-neutral-900/95 px-4 py-2 text-xs text-neutral-200 shadow-xl">
        {msg}
      </div>
    </div>
  )
}
