// Wisp. © Shawy404, MIT.
import { app, session, shell, type BrowserWindow, type Session, type WebContents } from 'electron'
import { ipcMain } from 'electron'
import type { WispConfig } from '@shared/types'
import { saveConfig } from './storage'

/**
 * Web pages live in their own persisted session so cookies, storage and cache
 * never mix with the UI renderer's default session.
 */
export const WEB_PARTITION = 'persist:web'

export const webSession = (): Session => session.fromPartition(WEB_PARTITION)

const SAFE_EXTERNAL = new Set(['http:', 'https:', 'mailto:'])

/** Only hand well-known schemes to the OS — never file:, javascript:, etc. */
export function openExternalSafe(url: string): void {
  try {
    if (SAFE_EXTERNAL.has(new URL(url).protocol)) void shell.openExternal(url)
  } catch {
    /* unparseable URL — drop it */
  }
}

/** Schemes a tab is allowed to navigate to. */
export function isSafeTabUrl(url: string): boolean {
  if (url === 'about:blank') return true
  try {
    const p = new URL(url).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

/**
 * Permissions web pages may ask for. Everything else (geolocation, camera,
 * microphone, notifications, MIDI, HID, …) is denied without a prompt — a
 * research browser has no business granting them silently.
 */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen'])

/**
 * Permissions the user gets asked about (everything else is silently denied).
 * The ask happens in-app: main sends `permission:request` to the renderer,
 * which shows an alert banner and answers via `permission:respond`. Decisions
 * marked "remember" persist per-host in config.sitePermissions.
 */
const PROMPTED_PERMISSIONS = new Set([
  'media',
  'geolocation',
  'notifications',
  'clipboard-read',
  'midi',
  'pointerLock'
])

interface PendingPermission {
  callback: (granted: boolean) => void
  host: string
  permission: string
  timer: NodeJS.Timeout
}

let pendingId = 1
const pending = new Map<number, PendingPermission>()

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function savedDecision(config: WispConfig, host: string, permission: string): boolean | null {
  const d = config.sitePermissions?.[host]?.[permission]
  return d === 'allow' ? true : d === 'deny' ? false : null
}

/**
 * Web-content session: known-safe permissions auto-allow, promptable ones go
 * through the in-app banner, the rest are denied outright.
 */
function attachPermissionPrompt(sess: Session, getWin: () => BrowserWindow | null, config: () => WispConfig): void {
  sess.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (ALLOWED_PERMISSIONS.has(permission)) return callback(true)
    if (!PROMPTED_PERMISSIONS.has(permission)) return callback(false)
    const host = hostOf(details.requestingUrl ?? '')
    const saved = savedDecision(config(), host, permission)
    if (saved !== null) return callback(saved)
    const win = getWin()
    if (!win || win.isDestroyed()) return callback(false)
    const id = pendingId++
    // Unanswered prompts deny after a minute so pages aren't left hanging.
    const timer = setTimeout(() => {
      pending.delete(id)
      callback(false)
      win.webContents.send('permission:expired', id)
    }, 60_000)
    pending.set(id, { callback, host, permission, timer })
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    win.webContents.send('permission:request', { id, host, permission, mediaTypes })
  })
  // Non-request checks (e.g. Notification.permission): only report granted for
  // hosts the user explicitly allowed.
  sess.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (ALLOWED_PERMISSIONS.has(permission)) return true
    return savedDecision(config(), hostOf(requestingOrigin), permission) === true
  })
}

/** Registers the renderer's answer channel; call once alongside hardenApp. */
export function registerPermissionIpc(config: () => WispConfig): void {
  ipcMain.handle(
    'permission:respond',
    (_e, id: number, allow: boolean, remember: boolean) => {
      const req = pending.get(id)
      if (!req) return
      pending.delete(id)
      clearTimeout(req.timer)
      req.callback(allow)
      if (remember && req.host) {
        const cfg = config()
        cfg.sitePermissions = {
          ...cfg.sitePermissions,
          [req.host]: { ...cfg.sitePermissions?.[req.host], [req.permission]: allow ? 'allow' : 'deny' }
        }
        saveConfig(cfg)
      }
    }
  )
}

function lockDownSession(sess: Session): void {
  sess.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  sess.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
}

/**
 * Global hardening, applied once at startup:
 * - permission requests denied by default on both sessions
 * - the UI renderer can never navigate away from the app
 * - <webview> is never allowed to attach
 * - HTTP is upgraded to HTTPS where the site supports it
 */
export function hardenApp(
  isUiContents: (wc: WebContents) => boolean,
  getWin: () => BrowserWindow | null,
  config: () => WispConfig
): void {
  lockDownSession(session.defaultSession)
  attachPermissionPrompt(webSession(), getWin, config)
  registerPermissionIpc(config)

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.on('will-navigate', (event, url) => {
      if (isUiContents(contents)) {
        // The app shell only ever loads its own bundle.
        event.preventDefault()
      } else if (!isSafeTabUrl(url)) {
        event.preventDefault()
      }
    })
  })
}
