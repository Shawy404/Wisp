// Wisp. © Shawy404, MIT.
import { RangeSetBuilder, StateField, type Extension, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { invoke, useApp } from '@/store'

/**
 * Inline previews for `![alt](src)` images in notes. The markdown stays as-is
 * in the document; a block widget under the line shows the actual picture.
 * Remote http(s) images load directly; `../clips/<file>` references (pasted or
 * dropped into the note) are resolved to data URLs through the main process,
 * since the sandboxed renderer can't read room files itself.
 */

const IMG_RE = /!\[[^\]]*\]\(([^)\s]+)\)/g
const resolved = new Map<string, string>()

class ImageWidget extends WidgetType {
  constructor(readonly src: string) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'padding:2px 0 6px'
    const img = document.createElement('img')
    img.style.cssText =
      'max-width:min(420px,100%);max-height:260px;border-radius:8px;display:block;' +
      'border:1px solid rgb(255 255 255 / 0.08)'
    img.onload = () => view.requestMeasure()
    img.onerror = () => wrap.remove()
    wrap.appendChild(img)

    const cached = resolved.get(this.src)
    if (cached) {
      img.src = cached
    } else if (/^https?:\/\//i.test(this.src)) {
      resolved.set(this.src, this.src)
      img.src = this.src
    } else {
      const file = this.src.replace(/^(\.\.\/)?clips\//, '')
      const roomId = useApp.getState().activeRoomId
      const key = this.src
      if (roomId) {
        void invoke<string | null>('clips:dataUrl', roomId, file).then((url) => {
          if (url) {
            resolved.set(key, url)
            img.src = url
          } else {
            wrap.remove()
          }
        })
      }
    }
    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }
}

function isImageSrc(src: string): boolean {
  return (
    src.startsWith('../clips/') ||
    src.startsWith('clips/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp)([?#]|$)/i.test(src)
  )
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const text = state.doc.toString()
  IMG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  let lastLine = -1
  while ((m = IMG_RE.exec(text))) {
    if (!isImageSrc(m[1])) continue
    const line = state.doc.lineAt(m.index)
    if (line.number === lastLine) continue // one preview per line is enough
    lastLine = line.number
    builder.add(
      line.to,
      line.to,
      Decoration.widget({ widget: new ImageWidget(m[1]), block: true, side: 1 })
    )
  }
  return builder.finish()
}

/** Block widgets must come from a StateField (not a ViewPlugin). */
export function imagePreview(): Extension {
  return StateField.define<DecorationSet>({
    create: buildDecorations,
    update: (deco, tr) => (tr.docChanged ? buildDecorations(tr.state) : deco),
    provide: (f) => EditorView.decorations.from(f)
  })
}
