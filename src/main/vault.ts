// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { join } from 'path'
import { ipcMain, safeStorage } from 'electron'
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

export function registerVault(): void {
  ipcMain.handle('vault:available', () => safeStorage.isEncryptionAvailable())

  ipcMain.handle('vault:list', (): VaultEntryMeta[] =>
    loadEntries()
      .map(toMeta)
      .sort((a, b) => a.site.localeCompare(b.site))
  )

  ipcMain.handle(
    'vault:add',
    (_e, site: string, username: string, password: string): VaultEntryMeta | null => {
      if (!safeStorage.isEncryptionAvailable()) return null
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
    saveEntries(loadEntries().filter((e) => e.id !== id))
  })

  // Decrypt on demand only — for the reveal eye and the copy button.
  ipcMain.handle('vault:reveal', (_e, id: string): string | null => {
    const entry = loadEntries().find((e) => e.id === id)
    if (!entry || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(entry.secret, 'base64'))
    } catch {
      return null
    }
  })
}
