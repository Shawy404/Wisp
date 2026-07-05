// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'
import type { TKey } from '@shared/i18n'
import { invoke, useT } from '@/store'

interface PermRequest {
  id: number
  host: string
  permission: string
  mediaTypes: string[]
}

/** What to call each permission in the banner. */
function permKey(req: PermRequest): TKey {
  if (req.permission === 'media') {
    const video = req.mediaTypes.includes('video')
    const audio = req.mediaTypes.includes('audio')
    if (video && audio) return 'perm.cameraMic'
    if (video) return 'perm.camera'
    return 'perm.mic'
  }
  const known: Record<string, TKey> = {
    geolocation: 'perm.location',
    notifications: 'perm.notifications',
    'clipboard-read': 'perm.clipboardRead',
    midi: 'perm.midi',
    pointerLock: 'perm.pointerLock'
  }
  return known[req.permission] ?? 'perm.generic'
}

/**
 * In-app permission banners. A page asking for the camera/mic/location pops a
 * red alert at the top of the window; nothing is granted until the user says
 * so, and unanswered prompts deny after a minute (main enforces the timeout).
 */
export default function PermissionPrompt(): React.JSX.Element | null {
  const t = useT()
  const [requests, setRequests] = useState<PermRequest[]>([])
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    const offReq = window.wisp.on('permission:request', (req) => {
      setRequests((prev) => [...prev, req as PermRequest])
    })
    const offExp = window.wisp.on('permission:expired', (id) => {
      setRequests((prev) => prev.filter((r) => r.id !== id))
    })
    return () => {
      offReq()
      offExp()
    }
  }, [])

  const answer = (req: PermRequest, allow: boolean): void => {
    void invoke('permission:respond', req.id, allow, remember)
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
    setRemember(false)
  }

  const req = requests[0]
  if (!req) return null

  // Rendered as a bar between the title bar and the browsing area: the native
  // web view sits above the renderer, so a floating banner would be hidden —
  // pushing the layout down keeps both the page and the prompt visible.
  return (
    <div className="flex items-center gap-3 border-b border-red-500/40 bg-red-500/10 px-4 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
        !
      </span>
      <div className="min-w-0 flex-1 text-xs text-neutral-100">
        <span className="font-semibold">{req.host}</span> — {t(permKey(req))}
        {requests.length > 1 && (
          <span className="ml-2 text-[10px] text-neutral-500">+{requests.length - 1}</span>
        )}
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-neutral-400">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t('perm.remember')}
      </label>
      <button
        className="shrink-0 rounded-md bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
        onClick={() => answer(req, false)}
      >
        {t('perm.deny')}
      </button>
      <button
        className="shrink-0 rounded-md bg-red-500/80 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
        onClick={() => answer(req, true)}
      >
        {t('perm.allow')}
      </button>
    </div>
  )
}
