// Wisp. © Shawy404, MIT.
/// <reference lib="dom" />
import { ipcRenderer, webFrame } from 'electron'

/**
 * Preload for web page views (sandboxed, no API exposed to the page). Two
 * jobs, both password-vault related:
 *  1. capture — a submitted form with a password field is reported to main,
 *     which offers to save the login;
 *  2. autofill — focusing a login field shows saved usernames for this site;
 *     picking one decrypts (behind the system-password prompt) and fills.
 * The page can't reach the vault: it only ever sees what gets typed/filled
 * into its own inputs.
 */

// ------------------------------------------------------------------- zoom --
// Ctrl + mouse wheel does standard page zoom (like every browser). Trackpad
// pinch is handled natively as smooth visual zoom (enabled in the main process),
// so it magnifies toward the pinch point without reflowing.
function stepZoom(factor: number): void {
  webFrame.setZoomFactor(Math.min(5, Math.max(0.3, webFrame.getZoomFactor() * factor)))
}
window.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    stepZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1)
  },
  { passive: false, capture: true }
)
window.addEventListener(
  'keydown',
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return
    if (e.key === '0') webFrame.setZoomFactor(1)
    else if (e.key === '=' || e.key === '+') stepZoom(1.1)
    else if (e.key === '-') stepZoom(1 / 1.1)
  },
  true
)

// ------------------------------------------------------------- edge hover --
// The native page view captures the mouse, so the shell's DOM sidebar never
// sees the pointer reach the left edge — which is exactly what compact mode's
// hover-to-reveal needs. Report edge proximity to the main process, which
// forwards it to the shell so the sidebar can reveal even over a live page.
let nearLeftEdge = false
window.addEventListener(
  'mousemove',
  (e) => {
    const near = e.clientX <= 14
    if (near !== nearLeftEdge) {
      nearLeftEdge = near
      ipcRenderer.send('shell:edge-left', near)
    }
  },
  true
)

// ---------------------------------------------------------------- capture --
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

// --------------------------------------------------------------- autofill --
interface Suggestion {
  id: string
  username: string
}

let dropdown: HTMLDivElement | null = null

function removeDropdown(): void {
  dropdown?.remove()
  dropdown = null
}

/** Set an input's value the way React & co. notice (native setter + events). */
function setInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function loginScope(el: HTMLInputElement): ParentNode {
  return el.form ?? document
}

function isLoginInput(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false
  if (el.type === 'password') return true
  if (!['text', 'email', 'tel'].includes(el.type)) return false
  // A text field only counts as a username field near a password field.
  return !!loginScope(el).querySelector('input[type="password"]')
}

async function fill(anchor: HTMLInputElement, suggestion: Suggestion): Promise<void> {
  removeDropdown()
  const res = (await ipcRenderer.invoke('vault:fill', suggestion.id, location.host)) as {
    username: string
    password: string
  } | null
  if (!res) return
  const scope = loginScope(anchor)
  const userEl =
    anchor.type === 'password'
      ? scope.querySelector<HTMLInputElement>(
          'input[autocomplete="username"], input[type="email"], input[type="text"], input[type="tel"]'
        )
      : anchor
  const pwEl =
    anchor.type === 'password'
      ? anchor
      : scope.querySelector<HTMLInputElement>('input[type="password"]')
  if (userEl && res.username) setInputValue(userEl, res.username)
  if (pwEl) setInputValue(pwEl, res.password)
}

async function showSuggestions(input: HTMLInputElement): Promise<void> {
  const entries = (await ipcRenderer.invoke('vault:query', location.host)) as Suggestion[]
  removeDropdown()
  if (!entries.length || document.activeElement !== input) return
  const rect = input.getBoundingClientRect()
  const box = document.createElement('div')
  box.style.cssText =
    `position:fixed;left:${Math.round(rect.left)}px;top:${Math.round(rect.bottom + 4)}px;` +
    `min-width:${Math.round(Math.max(rect.width, 180))}px;z-index:2147483647;` +
    'background:#17171b;border:1px solid #3f3f46;border-radius:9px;padding:4px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,0.45);font:12px system-ui,sans-serif'
  for (const entry of entries.slice(0, 6)) {
    const row = document.createElement('button')
    row.type = 'button'
    row.textContent = `⚿  ${entry.username || entry.id}`
    row.style.cssText =
      'display:block;width:100%;text-align:left;padding:7px 10px;border:0;cursor:pointer;' +
      'background:transparent;color:#e5e5e5;border-radius:6px;font:inherit'
    row.addEventListener('mouseenter', () => (row.style.background = '#2a2a30'))
    row.addEventListener('mouseleave', () => (row.style.background = 'transparent'))
    // mousedown (not click) so the fill wins the race against the input blur.
    row.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      void fill(input, entry)
    })
    box.appendChild(row)
  }
  dropdown = box
  document.documentElement.appendChild(box)
}

document.addEventListener(
  'focusin',
  (e) => {
    if (isLoginInput(e.target)) void showSuggestions(e.target)
  },
  true
)
document.addEventListener(
  'focusout',
  () => {
    // Delay so a mousedown on the dropdown can land first.
    setTimeout(removeDropdown, 150)
  },
  true
)
document.addEventListener('scroll', removeDropdown, true)
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape') removeDropdown()
  },
  true
)
