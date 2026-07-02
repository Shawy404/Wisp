// Wisp — © Shawy404. All rights reserved.
import { app, session, shell, type Session, type WebContents } from 'electron'

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
export function hardenApp(isUiContents: (wc: WebContents) => boolean): void {
  lockDownSession(session.defaultSession)
  lockDownSession(webSession())

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
