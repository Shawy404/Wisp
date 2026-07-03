// Wisp — © Shawy404. All rights reserved.
import { invoke, useApp } from '@/store'

/**
 * All app shortcuts in one place. Two entry paths land here:
 *  - window keydown, when the shell UI has focus
 *  - the 'shortcut' IPC event, forwarded by the main process when a web page
 *    has key focus (before-input-event) — pages never swallow app shortcuts.
 */

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable ||
    !!el.closest('.cm-editor')
  )
}

function nameFromEvent(e: KeyboardEvent): string | null {
  if (e.ctrlKey && !e.altKey && !e.metaKey) {
    const key = e.key.toLowerCase()
    if (key === 'tab') return e.shiftKey ? 'prev-tab' : 'next-tab'
    if (e.shiftKey) return key === 'f' ? 'room-search' : null
    if (key === 't') return 'palette'
    if (key === 'k') return 'palette-toggle'
    if (key === 'l') return 'address'
    if (key === 'w') return 'close-tab'
    if (key === 'h') return 'history'
    if (key === 'f') return 'find'
    if (key === '/') return 'shortcuts'
    if (/^[1-9]$/.test(key)) return `tab-${key}`
    return null
  }
  // Plain "?" opens the shortcut list — but never while typing somewhere.
  if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey && !isEditable(e.target)) {
    return 'shortcuts'
  }
  return null
}

function run(name: string): void {
  const app = useApp.getState()
  const toggleOverlay = (o: Parameters<typeof app.setOverlay>[0]): void =>
    app.setOverlay(app.overlay === o ? 'none' : o)

  switch (name) {
    case 'palette':
      window.dispatchEvent(new CustomEvent('wisp:open-palette'))
      return
    case 'palette-toggle':
      window.dispatchEvent(new CustomEvent('wisp:toggle-palette'))
      return
    case 'address':
      window.dispatchEvent(new CustomEvent('wisp:focus-address'))
      return
    case 'close-tab':
      if (app.activeTabId) app.closeTab(app.activeTabId)
      return
    case 'history':
      toggleOverlay('history')
      return
    case 'find':
      window.dispatchEvent(new CustomEvent('wisp:find-open'))
      return
    case 'room-search':
      toggleOverlay('roomsearch')
      return
    case 'shortcuts':
      toggleOverlay('shortcuts')
      return
    case 'reload':
      if (app.activeTabId) void invoke('tabs:reload', app.activeTabId)
      return
  }

  const { tabs, activeTabId, activateTab } = app
  if (tabs.length === 0) return
  if (name === 'next-tab' || name === 'prev-tab') {
    const idx = Math.max(0, tabs.findIndex((t) => t.id === activeTabId))
    const step = name === 'next-tab' ? 1 : -1
    activateTab(tabs[(idx + step + tabs.length) % tabs.length].id)
    return
  }
  const m = name.match(/^tab-(\d)$/)
  if (m) {
    // Ctrl+9 goes to the last tab, browser-style.
    const n = Number(m[1])
    const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]
    if (target) activateTab(target.id)
  }
}

export function installShortcuts(): void {
  window.addEventListener('keydown', (e) => {
    const name = nameFromEvent(e)
    if (name) {
      e.preventDefault()
      run(name)
    }
  })
  window.wisp.on('shortcut', (name) => run(name as string))
}
