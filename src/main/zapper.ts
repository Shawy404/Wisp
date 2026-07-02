// Wisp — © Shawy404. All rights reserved.
import { ipcMain, type WebContents } from 'electron'
import { saveConfig } from './storage'
import type { WispContext } from './ipc'

/**
 * The element zapper — "hide distracting elements". Entering zap mode injects
 * a picker into the page: hovering outlines an element, clicking hides it and
 * remembers a CSS selector for it per-host, Escape cancels. Remembered
 * selectors are re-hidden on every future load of that host, on top of what
 * the adblocker already removes.
 */

const PICKER_SCRIPT = `
new Promise((resolve) => {
  const HL = '__wispZapHL'
  if (window[HL]) { resolve(null); return }
  window[HL] = true
  let current = null
  let prevOutline = ''
  const cleanup = () => {
    if (current) current.style.outline = prevOutline
    document.removeEventListener('mouseover', over, true)
    document.removeEventListener('click', click, true)
    document.removeEventListener('keydown', key, true)
    delete window[HL]
  }
  const selectorFor = (el) => {
    if (el.id) return '#' + CSS.escape(el.id)
    const parts = []
    let e = el
    while (e && e !== document.body && parts.length < 5) {
      if (e.id) { parts.unshift('#' + CSS.escape(e.id)); break }
      let s = e.tagName.toLowerCase()
      const cls = [...e.classList].slice(0, 2).map((c) => '.' + CSS.escape(c)).join('')
      if (cls) s += cls
      else if (e.parentElement) {
        const same = [...e.parentElement.children].filter((x) => x.tagName === e.tagName)
        s += ':nth-of-type(' + (same.indexOf(e) + 1) + ')'
      }
      parts.unshift(s)
      e = e.parentElement
    }
    return parts.join(' > ')
  }
  const over = (ev) => {
    if (current) current.style.outline = prevOutline
    current = ev.target
    prevOutline = current.style.outline
    current.style.outline = '2px solid #ef4444'
  }
  const click = (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    const el = ev.target
    const sel = selectorFor(el)
    cleanup()
    el.style.setProperty('display', 'none', 'important')
    resolve(sel)
  }
  const key = (ev) => {
    if (ev.key === 'Escape') { cleanup(); resolve(null) }
  }
  document.addEventListener('mouseover', over, true)
  document.addEventListener('click', click, true)
  document.addEventListener('keydown', key, true)
})
`

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function applySaved(ctx: WispContext, wc: WebContents): void {
  const host = hostOf(wc.getURL())
  const selectors = ctx.config.zappedSelectors?.[host]
  if (!selectors?.length) return
  const css = selectors.map((s) => `${s}{display:none !important;}`).join('\n')
  void wc.insertCSS(css).catch(() => {})
}

export function registerZapper(ctx: WispContext): void {
  ctx.tabs.viewHooks.push((view) => {
    view.webContents.on('dom-ready', () => applySaved(ctx, view.webContents))
  })

  // Enter zap mode on the active tab; resolves once the user picks or cancels.
  ipcMain.handle('zap:start', async () => {
    const wc = ctx.tabs.activeView()?.webContents
    if (!wc || wc.getURL().startsWith('about:')) return { zapped: false }
    try {
      const selector = (await wc.executeJavaScript(PICKER_SCRIPT, true)) as string | null
      if (!selector) return { zapped: false }
      const host = hostOf(wc.getURL())
      if (host) {
        const list = ctx.config.zappedSelectors?.[host] ?? []
        if (!list.includes(selector)) {
          ctx.config.zappedSelectors = { ...ctx.config.zappedSelectors, [host]: [...list, selector] }
          saveConfig(ctx.config)
        }
      }
      return { zapped: true, host }
    } catch {
      return { zapped: false }
    }
  })
}
