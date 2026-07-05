// Wisp. © Shawy404, MIT.
import { ipcMain, type WebContents } from 'electron'
import { translate } from '@shared/i18n'
import { saveConfig } from './storage'
import type { WispContext } from './ipc'

/**
 * The element zapper — "hide distracting elements". Entering zap mode injects
 * a picker into the page: a floating highlight box follows the element under
 * the cursor (no element styles are touched), clicking asks for confirmation
 * before hiding, cancel resumes picking, Escape leaves zap mode. Confirmed
 * selectors are remembered per-host and re-hidden on every future load, on
 * top of what the adblocker already removes.
 */

interface PickerStrings {
  prompt: string
  hide: string
  cancel: string
}

const pickerScript = (s: PickerStrings): string => `
new Promise((resolve) => {
  const FLAG = '__wispZap'
  if (window[FLAG]) { resolve(null); return }
  window[FLAG] = true

  // Floating UI: a highlight box that tracks the hovered element, and a
  // confirm bar shown after a click. Both live outside the page's layout.
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;' +
    'border:2px solid #ef4444;background:rgba(239,68,68,0.12);border-radius:4px;' +
    'transition:all 60ms ease;display:none'
  const bar = document.createElement('div')
  bar.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);' +
    'display:none;align-items:center;gap:10px;background:#17171b;color:#e5e5e5;' +
    'border:1px solid #3f3f46;border-radius:10px;padding:10px 14px;' +
    'font:13px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.5)'
  const label = document.createElement('span')
  label.textContent = ${JSON.stringify(s.prompt)}
  const mkBtn = (text, bg) => {
    const b = document.createElement('button')
    b.textContent = text
    b.style.cssText = 'border:0;border-radius:7px;padding:5px 12px;cursor:pointer;' +
      'font:12px system-ui,sans-serif;color:#fff;background:' + bg
    return b
  }
  const okBtn = mkBtn(${JSON.stringify(s.hide)}, '#dc2626')
  const cancelBtn = mkBtn(${JSON.stringify(s.cancel)}, '#3f3f46')
  bar.append(label, okBtn, cancelBtn)
  document.documentElement.append(box, bar)

  let current = null
  let confirming = false

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

  const highlight = (el) => {
    if (!el || el === document.body || el === document.documentElement) {
      box.style.display = 'none'
      return
    }
    const r = el.getBoundingClientRect()
    box.style.display = 'block'
    box.style.left = r.left - 2 + 'px'
    box.style.top = r.top - 2 + 'px'
    box.style.width = r.width + 'px'
    box.style.height = r.height + 'px'
  }

  const cleanup = () => {
    document.removeEventListener('mouseover', over, true)
    document.removeEventListener('click', click, true)
    document.removeEventListener('keydown', key, true)
    box.remove()
    bar.remove()
    delete window[FLAG]
  }

  const over = (ev) => {
    if (confirming) return
    if (bar.contains(ev.target)) return
    current = ev.target
    highlight(current)
  }

  const click = (ev) => {
    // Clicks on the confirm bar's own buttons must go through.
    if (bar.contains(ev.target)) return
    ev.preventDefault()
    ev.stopPropagation()
    if (confirming) return
    current = ev.target
    highlight(current)
    confirming = true
    bar.style.display = 'flex'
  }

  const key = (ev) => {
    if (ev.key !== 'Escape') return
    ev.preventDefault()
    ev.stopPropagation()
    if (confirming) {
      confirming = false
      bar.style.display = 'none'
    } else {
      cleanup()
      resolve(null)
    }
  }

  okBtn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    const el = current
    const sel = el ? selectorFor(el) : null
    cleanup()
    if (el && sel) el.style.setProperty('display', 'none', 'important')
    resolve(sel)
  })
  cancelBtn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    confirming = false
    bar.style.display = 'none'
  })

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

  // Enter zap mode on the active tab; resolves once the user confirms or quits.
  ipcMain.handle('zap:start', async () => {
    const wc = ctx.tabs.activeView()?.webContents
    if (!wc || wc.getURL().startsWith('about:')) return { zapped: false }
    const lang = ctx.config.language ?? 'tr'
    const strings: PickerStrings = {
      prompt: translate(lang, 'main.zap.confirm'),
      hide: translate(lang, 'main.zap.hide'),
      cancel: translate(lang, 'main.zap.cancel')
    }
    // The picker's Escape/hover listeners live inside the page, but the click
    // that started zap mode focused the shell UI — give the page key focus
    // right away so Esc works without having to click the page first.
    ctx.win.focus()
    wc.focus()
    try {
      const selector = (await wc.executeJavaScript(pickerScript(strings), true)) as string | null
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
