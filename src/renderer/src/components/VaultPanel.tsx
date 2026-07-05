// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'
import type { VaultEntryMeta } from '@shared/types'
import { invoke, useT } from '@/store'

/**
 * Password vault. Entries are app-wide (the same login works in every room)
 * and encrypted by the main process via the OS keychain; this panel only ever
 * holds a secret in memory while it's revealed or being copied.
 */
export default function VaultPanel(): React.JSX.Element {
  const t = useT()
  const [available, setAvailable] = useState(true)
  const [locked, setLocked] = useState(true)
  const [unlockFailed, setUnlockFailed] = useState(false)
  const [entries, setEntries] = useState<VaultEntryMeta[]>([])
  const [filter, setFilter] = useState('')
  const [site, setSite] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setEntries(await invoke<VaultEntryMeta[]>('vault:list'))
  }
  useEffect(() => {
    void invoke<boolean>('vault:available').then(setAvailable)
    void invoke<boolean>('vault:locked').then((isLocked) => {
      setLocked(isLocked)
      if (!isLocked) void refresh()
    })
  }, [])

  const unlock = async (): Promise<void> => {
    setUnlockFailed(false)
    const ok = await invoke<boolean>('vault:unlock')
    if (ok) {
      setLocked(false)
      await refresh()
    } else {
      setUnlockFailed(true)
    }
  }

  const add = async (): Promise<void> => {
    if (!site.trim() || !password) return
    await invoke('vault:add', site, username, password)
    setSite('')
    setUsername('')
    setPassword('')
    await refresh()
  }

  const toggleReveal = async (id: string): Promise<void> => {
    if (revealed[id]) {
      setRevealed(({ [id]: _gone, ...rest }) => rest)
      return
    }
    const secret = await invoke<string | null>('vault:reveal', id)
    if (secret !== null) setRevealed((r) => ({ ...r, [id]: secret }))
  }

  const copy = async (id: string): Promise<void> => {
    const secret = await invoke<string | null>('vault:reveal', id)
    if (secret === null) return
    await navigator.clipboard.writeText(secret)
    setCopiedId(id)
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200)
  }

  const shown = entries.filter(
    (e) =>
      !filter ||
      e.site.toLowerCase().includes(filter.toLowerCase()) ||
      e.username.toLowerCase().includes(filter.toLowerCase())
  )

  // The vault stays behind the machine owner's own password (polkit dialog).
  if (locked) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-950">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-3xl text-accent">
          ⚿
        </div>
        <div className="text-sm font-semibold text-neutral-200">{t('vault.locked.title')}</div>
        <div className="max-w-xs text-center text-xs text-neutral-500">{t('vault.locked.body')}</div>
        {unlockFailed && <div className="text-xs text-red-400">{t('vault.unlockFailed')}</div>}
        <button
          className="rounded-lg bg-accent/15 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/25"
          onClick={() => void unlock()}
        >
          {t('vault.unlock')}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto w-full max-w-2xl px-6 pt-6 pb-3">
        <div className="text-sm font-semibold text-neutral-200">{t('vault.title')}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{t('vault.subtitle')}</div>
        {!available && (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11px] text-red-300">
            {t('vault.unavailable')}
          </div>
        )}
      </div>

      {available && (
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-6 pb-3">
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder={t('vault.site')}
            className="h-8 w-1/4 rounded-md border border-neutral-800 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
            spellCheck={false}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('vault.username')}
            className="h-8 w-1/4 rounded-md border border-neutral-800 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
            spellCheck={false}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder={t('vault.password')}
            className="h-8 min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
          />
          <button
            className="h-8 shrink-0 rounded-md bg-accent/15 px-3 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
            disabled={!site.trim() || !password}
            onClick={() => void add()}
          >
            {t('vault.add')}
          </button>
        </div>
      )}

      {entries.length > 3 && (
        <div className="mx-auto w-full max-w-2xl px-6 pb-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('vault.filter')}
            className="h-8 w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent/60"
            spellCheck={false}
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-1.5 overflow-y-auto px-6 pb-6">
        {available && entries.length === 0 && (
          <div className="pt-8 text-center text-xs text-neutral-600">{t('vault.empty')}</div>
        )}
        {shown.map((e) => (
          <div
            key={e.id}
            className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-neutral-200">{e.site}</div>
              <div className="truncate text-[11px] text-neutral-500">{e.username}</div>
            </div>
            <span className="font-mono text-[11px] text-neutral-400 select-text">
              {revealed[e.id] ?? '••••••••'}
            </span>
            <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                className="rounded px-1.5 py-px text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                onClick={() => void toggleReveal(e.id)}
              >
                {revealed[e.id] ? t('vault.hide') : t('vault.reveal')}
              </button>
              <button
                className="rounded px-1.5 py-px text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-accent"
                onClick={() => void copy(e.id)}
              >
                {copiedId === e.id ? t('vault.copied') : t('vault.copy')}
              </button>
              <button
                className="rounded px-1.5 py-px text-[10px] text-red-400/80 hover:bg-red-400/10"
                onClick={() => void invoke('vault:delete', e.id).then(refresh)}
              >
                {t('vault.delete')}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
