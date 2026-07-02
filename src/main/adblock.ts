// Wisp — © Shawy404. All rights reserved.
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { net } from 'electron'
import * as fs from 'fs'
import { join } from 'path'
import type { WispConfig } from '@shared/types'
import { wispRoot } from './storage'
import { webSession } from './security'

let blocker: ElectronBlocker | null = null
let enabled = true
let allowRules: string[] = []
let blockedCount = 0

/**
 * Per-site exceptions become `@@*$domain=<host>` allowlist rules: any request
 * originating from a whitelisted page is exempted, while other sites stay
 * protected. (`$document` alone only exempts the top frame, not sub-resources.)
 */
function allowlistRules(hosts: string[]): string[] {
  return hosts.filter(Boolean).map((h) => `@@*$domain=${h.trim()}`)
}

/**
 * Loads the full Ghostery ruleset — EasyList, EasyPrivacy, uBlock Origin
 * filters, annoyances and cosmetic filtering — and enables blocking on the
 * web-content session. The compiled engine is cached under ~/Wisp/cache so
 * later launches (and offline launches) skip the network entirely. Falls back
 * to a tiny bundled ruleset only when there is neither cache nor network.
 */
export async function initAdblock(config: WispConfig): Promise<void> {
  enabled = config.adblock
  const cacheDir = join(wispRoot(), 'cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  try {
    blocker = await ElectronBlocker.fromPrebuiltFull(net.fetch, {
      path: join(cacheDir, 'adblock-engine.bin'),
      read: fs.promises.readFile,
      write: fs.promises.writeFile
    })
  } catch {
    blocker = ElectronBlocker.parse(
      '||doubleclick.net^\n||googlesyndication.com^\n||google-analytics.com^\n||adservice.google.com^\n||scorecardresearch.com^'
    )
  }
  blocker.on('request-blocked', () => {
    blockedCount++
  })
  applyAllowlist(config.adblockAllowlist ?? [])
  applyState()
}

/** Total requests blocked since launch, for the UI shield badge. */
export function getBlockedCount(): number {
  return blockedCount
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
  const sess = webSession()
  blocker.disableBlockingInSession(sess)
  if (enabled) blocker.enableBlockingInSession(sess)
}

/** React to a settings change (toggle or allowlist edit) without a restart. */
export function setAdblock(config: WispConfig): void {
  enabled = config.adblock
  applyAllowlist(config.adblockAllowlist ?? [])
  applyState()
}
