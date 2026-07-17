// Wisp. © Shawy404, MIT.
import { WebContentsView } from 'electron'
import type { WispContext } from './ipc'

/**
 * Toasts drawn above *everything*, same trick as the tooltips: the ui renderer
 * paints UNDER the native page view, so a toast fired while a site was open
 * simply didn't exist as far as your eyes were concerned. download notices
 * were invisible on arrival, in their own launch feature. this pill lives in a
 * transparent child view stacked on top of the page instead.
 */

const MARGIN = 10
const SHOW_MS = 2600

/** Icon paths for the pill, same 24px stroke style as the renderer's set. */
const PILL_ICONS: Record<string, string> = {
  download: '<path d="M12 3.5V15M7 10.5l5 5 5-5"/><path d="M4 20.5h16"/>',
  check: '<path d="m4.5 12.5 5.5 5.5L19.5 7"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.3"/>'
}

const TOAST_HTML =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; overflow: hidden; }
  #pill {
    position: absolute; top: ${MARGIN}px; left: ${MARGIN}px; box-sizing: border-box;
    display: inline-flex; align-items: center; gap: 9px; max-width: 460px;
    padding: 10px 18px 10px 12px; border-radius: 999px;
    background: rgb(20 20 24 / 0.97); border: 1px solid rgb(255 255 255 / 0.09);
    color: #ececf0;
    font: 450 12.5px/1.4 'Inter Variable', system-ui, sans-serif; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.06),
      0 4px 12px rgb(0 0 0 / 0.35),
      0 16px 44px rgb(0 0 0 / 0.5);
    animation: rise 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  #icon {
    display: flex; align-items: center; justify-content: center; flex: none;
    width: 24px; height: 24px; border-radius: 999px;
    background: color-mix(in srgb, var(--accent, #7dd3a8) 16%, transparent);
    color: var(--accent, #7dd3a8);
  }
  #icon svg { width: 13px; height: 13px; }
  #text { overflow: hidden; text-overflow: ellipsis; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    #pill { animation: none; }
  }
</style>
<div id="pill"><span id="icon"></span><span id="text"></span></div>`)

let view: WebContentsView | null = null
let ready: Promise<void> | null = null
let hideTimer: NodeJS.Timeout | null = null

function ensureView(): Promise<void> {
  if (view && ready) return ready
  view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  view.setBackgroundColor('#00000000')
  ready = view.webContents.loadURL(TOAST_HTML).then(
    () => undefined,
    () => undefined
  )
  return ready
}

/** Show a toast pill bottom-center, above any open page. Fire and forget. */
export function showToast(
  ctx: WispContext,
  text: string,
  opts?: { icon?: 'download' | 'check' | 'error' | 'info'; accent?: string }
): void {
  void (async () => {
    if (ctx.win.isDestroyed()) return
    await ensureView()
    if (!view) return
    const iconSvg =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round">${PILL_ICONS[opts?.icon ?? 'info']}</svg>`
    const js = `(() => {
      document.getElementById('text').textContent = ${JSON.stringify(String(text))}
      document.getElementById('icon').innerHTML = ${JSON.stringify(iconSvg)}
      const p = document.getElementById('pill')
      p.style.setProperty('--accent', ${JSON.stringify(String(opts?.accent ?? ctx.config.accent ?? '#7dd3a8'))})
      p.style.animation = 'none'
      void p.offsetWidth
      p.style.animation = ''
      return [p.offsetWidth, p.offsetHeight]
    })()`
    let w = 0
    let h = 0
    try {
      const dims = (await view.webContents.executeJavaScript(js)) as [number, number]
      w = Math.ceil(dims[0])
      h = Math.ceil(dims[1])
    } catch {
      return
    }
    if (w === 0 || h === 0 || ctx.win.isDestroyed()) return

    const [cw, ch] = ctx.win.getContentSize()
    const x = Math.round(cw / 2 - w / 2)
    const y = Math.round(ch - h - 28)

    // (Re-)adding puts the pill above every other child view, tooltips included.
    ctx.win.contentView.addChildView(view)
    view.setBounds({ x: x - MARGIN, y: y - MARGIN, width: w + MARGIN * 2, height: h + MARGIN * 2 })

    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = null
      if (!view || ctx.win.isDestroyed()) return
      try {
        ctx.win.contentView.removeChildView(view)
      } catch {
        /* not attached */
      }
    }, SHOW_MS)
  })()
}
