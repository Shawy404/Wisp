// Wisp — © Shawy404. All rights reserved.
import { invoke } from '@/store'

/**
 * data-tip tooltips, drawn by the main process. The shell renderer paints
 * *below* the native web page view, so a CSS bubble that reaches over the
 * page area simply disappears while a site is open. Instead, hovering any
 * `[data-tip]` element ships the text + anchor rect to the main process,
 * which draws the bubble in a child view above everything.
 *
 * Same contract as the old CSS version: 300ms hover delay, `data-tip-pos`
 * ("bottom" flips below the anchor), `data-tip-align` ("end" pins right).
 */
export function installTooltips(): void {
  let current: Element | null = null
  let timer: number | null = null

  const cssVar = (name: string, fallback: string): string => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }

  const hide = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (current) {
      current = null
      void invoke('tip:hide')
    }
  }

  const show = (el: Element): void => {
    const text = el.getAttribute('data-tip')
    if (!text) return
    const r = el.getBoundingClientRect()
    // Glass themes make the shell colors semi-transparent; the bubble floats
    // over web pages and must stay readable, so it gets a solid background.
    const translucent = document.documentElement.classList.contains('wisp-translucent')
    void invoke('tip:show', {
      text,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      pos: el.getAttribute('data-tip-pos') === 'bottom' ? 'bottom' : 'top',
      align: el.getAttribute('data-tip-align') === 'end' ? 'end' : 'center',
      colors: {
        bg: translucent ? 'rgb(19 19 23 / 0.92)' : cssVar('--color-neutral-900', '#17171b'),
        fg: cssVar('--color-neutral-200', '#e5e5e5'),
        border: cssVar('--color-neutral-700', '#3f3f46')
      }
    })
  }

  document.addEventListener('mouseover', (e) => {
    const el = (e.target as Element | null)?.closest?.('[data-tip]') ?? null
    if (el === current) return
    hide()
    if (!el) return
    current = el
    timer = window.setTimeout(() => {
      timer = null
      if (current === el) show(el)
    }, 300)
  })
  // Leaving the window entirely produces no mouseover to catch — hide here.
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) hide()
  })
  document.addEventListener('mousedown', hide, true)
  document.addEventListener('click', hide, true)
  document.addEventListener('scroll', hide, true)
  window.addEventListener('blur', hide)
}
