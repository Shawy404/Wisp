// Wisp — © Shawy404. All rights reserved.
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { session, net } from 'electron'
import type { WispConfig } from '@shared/types'

let blocker: ElectronBlocker | null = null
let enabled = true
let allowRules: string[] = []

/**
 * Per-site exceptions become `@@*$domain=<host>` allowlist rules: any request
 * originating from a whitelisted page is exempted, while other sites stay
 * protected. (`$document` alone only exempts the top frame, not sub-resources.)
 */
function allowlistRules(hosts: string[]): string[] {
  return hosts.filter(Boolean).map((h) => `@@*$domain=${h.trim()}`)
}

/**
 * Loads EasyList + EasyPrivacy and enables blocking on the default session.
 * Whitelisted sites are honoured via `@@` exception rules, so a user can
 * exempt one host without dropping protection everywhere. Falls back to a
 * tiny bundled ruleset if the lists can't be fetched (offline / restricted).
 */
export async function initAdblock(config: WispConfig): Promise<void> {
  enabled = config.adblock
  try {
    blocker = await ElectronBlocker.fromLists(net.fetch, [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist.to/easylist/easyprivacy.txt'
    ])
  } catch {
    blocker = ElectronBlocker.parse(
      '||doubleclick.net^\n||googlesyndication.com^\n||google-analytics.com^\n||adservice.google.com^\n||scorecardresearch.com^'
    )
  }
  applyAllowlist(config.adblockAllowlist ?? [])
  applyState()
}

function applyAllowlist(hosts: string[]): void {
  if (!blocker) return
  const next = allowlistRules(hosts)
  const added = next.filter((r) => !allowRules.includes(r))
  const removed = allowRules.filter((r) => !next.includes(r))
  if (added.length || removed.length) blocker.updateFromDiff({ added, removed })
  allowRules = next
}

function applyState(): void {
  if (!blocker) return
  const sess = session.defaultSession
  blocker.disableBlockingInSession(sess)
  if (enabled) blocker.enableBlockingInSession(sess)
}

/** React to a settings change (toggle or allowlist edit) without a restart. */
export function setAdblock(config: WispConfig): void {
  enabled = config.adblock
  applyAllowlist(config.adblockAllowlist ?? [])
  applyState()
}
