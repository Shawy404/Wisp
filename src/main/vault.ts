// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { ipcMain, safeStorage, type BrowserWindow } from 'electron'
import type { VaultEntryMeta } from '@shared/types'
import { stableId } from '@shared/tags'
import { wispRoot } from './storage'

/**
 * Password vault. App-wide (not per room — the same login works everywhere).
 * Secrets are encrypted with Electron's safeStorage, which keys off the OS
 * keychain/keyring, and stored base64 in ~/Wisp/vault.json. The renderer only
 * ever receives metadata; a secret is decrypted on an explicit reveal/copy.
 */

interface VaultEntry extends VaultEntryMeta {
  /** base64(safeStorage.encryptString(password)) */
  secret: string
}

const vaultFile = (): string => join(wispRoot(), 'vault.json')

function loadEntries(): VaultEntry[] {
  try {
    const data = JSON.parse(fs.readFileSync(vaultFile(), 'utf8')) as { entries?: VaultEntry[] }
    return data.entries ?? []
  } catch {
    return []
  }
}

function saveEntries(entries: VaultEntry[]): void {
  fs.mkdirSync(wispRoot(), { recursive: true })
  fs.writeFileSync(vaultFile(), JSON.stringify({ entries }, null, 2), { mode: 0o600 })
}

const toMeta = (e: VaultEntry): VaultEntryMeta => ({
  id: e.id,
  site: e.site,
  username: e.username,
  updatedAt: e.updatedAt
})

export function registerVault(getWin: () => BrowserWindow | null): void {
  // The vault opens only after the user proves they're the machine's owner:
  // pkexec pops the system (polkit) password dialog. Unlock lasts until the
  // app quits. On systems without polkit the check degrades to open access —
  // there is nothing local to authenticate against.
  let unlocked = false
  let authInFlight: Promise<boolean> | null = null

  const authenticate = (): Promise<boolean> => {
    if (unlocked) return Promise.resolve(true)
    if (authInFlight) return authInFlight
    authInFlight = new Promise<boolean>((resolve) => {
      execFile('pkexec', ['true'], { timeout: 120_000 }, (err) => {
        const enoent = (err as NodeJS.ErrnoException | null)?.code === 'ENOENT'
        resolve(!err || enoent)
      })
    }).then((ok) => {
      authInFlight = null
      if (ok) unlocked = true
      return ok
    })
    return authInFlight
  }

  ipcMain.handle('vault:available', () => safeStorage.isEncryptionAvailable())
  ipcMain.handle('vault:locked', () => !unlocked)
  ipcMain.handle('vault:unlock', () => authenticate())

  // ---- Autofill: the web preload asks what we know about the current site. --
  const hostMatch = (site: string, host: string): boolean => {
    const norm = (h: string): string => h.replace(/^www\./, '').toLowerCase()
    const a = norm(site)
    const b = norm(host)
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
  }

  // Username suggestions for the focused login field (never the secret).
  ipcMain.handle('vault:query', (_e, host: string) => {
    if (!safeStorage.isEncryptionAvailable()) return []
    return loadEntries()
      .filter((en) => hostMatch(en.site, String(host)))
      .map((en) => ({ id: en.id, username: en.username }))
  })

  // Picking a suggestion decrypts — behind the polkit prompt on first use,
  // and only ever for the site the credential was saved on.
  ipcMain.handle('vault:fill', async (_e, id: string, host: string) => {
    const entry = loadEntries().find((en) => en.id === id)
    if (!entry || !hostMatch(entry.site, String(host))) return null
    if (!(await authenticate())) return null
    try {
      return {
        username: entry.username,
        password: safeStorage.decryptString(Buffer.from(entry.secret, 'base64'))
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('vault:list', (): VaultEntryMeta[] => {
    if (!unlocked) return []
    return loadEntries()
      .map(toMeta)
      .sort((a, b) => a.site.localeCompare(b.site))
  })

  // ---- Auto-capture: the web preload reports password-form submissions. ----
  // The secret waits in main-process memory while the shell asks the user;
  // it never travels to the UI renderer.
  interface PendingCredential {
    host: string
    username: string
    password: string
    timer: NodeJS.Timeout
  }
  const pendingOffers = new Map<number, PendingCredential>()
  let nextOfferId = 1

  ipcMain.on('vault:credentials-submitted', (_e, payload: { host?: string; username?: string; password?: string }) => {
    const host = String(payload?.host ?? '').slice(0, 200)
    const username = String(payload?.username ?? '').slice(0, 200)
    const password = String(payload?.password ?? '')
    if (!host || !password) return
    // Already saved for this site+user? Don't nag.
    const exists = loadEntries().some((en) => en.site === host && en.username === username)
    if (exists || !safeStorage.isEncryptionAvailable()) return
    const win = getWin()
    if (!win || win.isDestroyed()) return
    const id = nextOfferId++
    const timer = setTimeout(() => pendingOffers.delete(id), 2 * 60_000)
    pendingOffers.set(id, { host, username, password, timer })
    win.webContents.send('vault:offer', { id, host, username })
  })

  ipcMain.handle('vault:offer-respond', (_e, id: number, save: boolean) => {
    const offer = pendingOffers.get(id)
    if (!offer) return false
    pendingOffers.delete(id)
    clearTimeout(offer.timer)
    if (!save) return false
    const entries = loadEntries()
    entries.push({
      id: `pw-${stableId(offer.host + offer.username + Date.now())}`,
      site: offer.host,
      username: offer.username,
      updatedAt: new Date().toISOString(),
      secret: safeStorage.encryptString(offer.password).toString('base64')
    })
    saveEntries(entries)
    return true
  })

  ipcMain.handle(
    'vault:add',
    (_e, site: string, username: string, password: string): VaultEntryMeta | null => {
      if (!unlocked || !safeStorage.isEncryptionAvailable()) return null
      site = site.trim()
      username = username.trim()
      if (!site || !password) return null
      const entries = loadEntries()
      const entry: VaultEntry = {
        id: `pw-${stableId(site + username + Date.now())}`,
        site,
        username,
        updatedAt: new Date().toISOString(),
        secret: safeStorage.encryptString(password).toString('base64')
      }
      entries.push(entry)
      saveEntries(entries)
      return toMeta(entry)
    }
  )

  ipcMain.handle('vault:delete', (_e, id: string) => {
    if (!unlocked) return
    saveEntries(loadEntries().filter((e) => e.id !== id))
  })

  // Decrypt on demand only — for the reveal eye and the copy button.
  ipcMain.handle('vault:reveal', (_e, id: string): string | null => {
    if (!unlocked) return null
    const entry = loadEntries().find((e) => e.id === id)
    if (!entry || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(entry.secret, 'base64'))
    } catch {
      return null
    }
  })
}
