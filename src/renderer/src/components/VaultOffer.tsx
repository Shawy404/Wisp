// Wisp — © Shawy404. All rights reserved.
import { useEffect, useState } from 'react'
import { invoke, useT } from '@/store'

interface Offer {
  id: number
  host: string
  username: string
}

/**
 * "Save this password?" banner. A page just submitted a login form; the
 * secret waits in the main process — this only shows host + username and
 * sends back a yes/no. Rendered as a layout bar (like PermissionPrompt)
 * because a floating banner would hide behind the native page view.
 */
export default function VaultOffer(): React.JSX.Element | null {
  const t = useT()
  const [offers, setOffers] = useState<Offer[]>([])

  useEffect(
    () => window.wisp.on('vault:offer', (o) => setOffers((prev) => [...prev, o as Offer])),
    []
  )

  const respond = (offer: Offer, save: boolean): void => {
    void invoke('vault:offer-respond', offer.id, save)
    setOffers((prev) => prev.filter((x) => x.id !== offer.id))
  }

  const offer = offers[0]
  if (!offer) return null

  return (
    <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">
        ⚿
      </span>
      <div className="min-w-0 flex-1 truncate text-xs text-neutral-100">
        {t('vault.offer.question', { host: offer.host })}
        {offer.username && <span className="ml-2 text-neutral-400">{offer.username}</span>}
      </div>
      <button
        className="shrink-0 rounded-md bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
        onClick={() => respond(offer, false)}
      >
        {t('vault.offer.dismiss')}
      </button>
      <button
        className="shrink-0 rounded-md bg-accent/80 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-accent"
        onClick={() => respond(offer, true)}
      >
        {t('vault.offer.save')}
      </button>
    </div>
  )
}
