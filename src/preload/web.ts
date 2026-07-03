// Wisp — © Shawy404. All rights reserved.
/// <reference lib="dom" />
import { ipcRenderer } from 'electron'

/**
 * Preload for web page views (sandboxed, no API exposed to the page). Its
 * only job: when a form with a password field is submitted, report the
 * credentials to the main process so the shell can offer to save the login.
 * The page itself can neither see nor trigger anything through this file.
 */
window.addEventListener(
  'submit',
  (e) => {
    try {
      const form = e.target
      if (!(form instanceof HTMLFormElement)) return
      const pw = form.querySelector<HTMLInputElement>('input[type="password"]')
      if (!pw?.value) return
      const user = form.querySelector<HTMLInputElement>(
        'input[autocomplete="username"], input[type="email"], input[type="text"], input[type="tel"]'
      )
      ipcRenderer.send('vault:credentials-submitted', {
        host: location.host,
        username: user?.value ?? '',
        password: pw.value
      })
    } catch {
      /* never interfere with the page */
    }
  },
  true
)
