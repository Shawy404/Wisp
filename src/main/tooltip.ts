// Wisp — © Shawy404. All rights reserved.
import { ipcMain, WebContentsView } from 'electron'
import type { WispContext } from './ipc'

/**
 * Tooltip bubbles drawn above *everything*, including open web pages. The UI
 * renderer paints below the native WebContentsView that shows the page, so a
 * DOM tooltip reaching over the page area is invisible while a site is open.
 * The renderer sends the tip text + anchor rect here instead, and the bubble
 * is drawn in a tiny transparent child view stacked on top of the page view.
 */

interface TipRequest {
  text: string
  /** Anchor rect in window content coordinates (CSS px). */
  x: number
  y: number
  width: number
  height: number
  pos: 'top' | 'bottom'
  align: 'center' | 'end'
  colors: { bg: string; fg: string; border: string }
}

/** Gap between anchor and bubble; MARGIN pads the view for the drop shadow.
 *  GAP > MARGIN keeps the (mouse-eating) view bounds off the anchor itself. */
const GAP = 8
const MARGIN = 6

const TIP_HTML =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; overflow: hidden; }
  #tip {
    position: absolute; top: ${MARGIN}px; left: ${MARGIN}px; box-sizing: border-box;
    display: inline-block; max-width: 260px; padding: 4px 8px;
    border-radius: 7px; border: 1px solid transparent;
    font: 400 11px/1.35 system-ui, sans-serif; text-align: center;
    overflow-wrap: break-word; box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
  }
</style>
<div id="tip"></div>`)

export function registerTooltip(ctx: WispContext): void {
  let view: WebContentsView | null = null
  let ready: Promise<void> | null = null
  let shown = false

  const ensureView = (): Promise<void> => {
    if (view && ready) return ready
    view = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    view.setBackgroundColor('#00000000')
    ready = view.webContents.loadURL(TIP_HTML).then(
      () => undefined,
      () => undefined
    )
    return ready
  }

  const hide = (): void => {
    if (!shown || !view || ctx.win.isDestroyed()) return
    shown = false
    try {
      ctx.win.contentView.removeChildView(view)
    } catch {
      /* not attached */
    }
  }

  ipcMain.handle('tip:show', async (_e, req: TipRequest) => {
    if (ctx.win.isDestroyed()) return
    await ensureView()
    if (!view) return
    // Set the text/colors in the tip document, measure the resulting bubble.
    const js = `(() => {
      const tip = document.getElementById('tip')
      tip.textContent = ${JSON.stringify(String(req.text))}
      tip.style.background = ${JSON.stringify(String(req.colors.bg))}
      tip.style.color = ${JSON.stringify(String(req.colors.fg))}
      tip.style.borderColor = ${JSON.stringify(String(req.colors.border))}
      return [tip.offsetWidth, tip.offsetHeight]
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
    if (w === 0 || h === 0) return

    const [cw, ch] = ctx.win.getContentSize()
    let x = req.align === 'end' ? req.x + req.width - w : req.x + req.width / 2 - w / 2
    let y = req.pos === 'bottom' ? req.y + req.height + GAP : req.y - GAP - h
    x = Math.max(4, Math.min(x, cw - w - 4))
    y = Math.max(4, Math.min(y, ch - h - 4))

    // (Re-)adding puts the tip view on top of every other child view.
    ctx.win.contentView.addChildView(view)
    view.setBounds({
      x: Math.round(x) - MARGIN,
      y: Math.round(y) - MARGIN,
      width: w + MARGIN * 2,
      height: h + MARGIN * 2
    })
    shown = true
  })

  ipcMain.handle('tip:hide', () => hide())
  ctx.win.on('blur', hide)
  ctx.win.on('resize', hide)
}
