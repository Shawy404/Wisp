// Wisp. © Shawy404, MIT.
import { Decoration, EditorView, ViewPlugin, type DecorationSet, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'

const WIKILINK = /(!?)\[\[([^\]]+)\]\]/g

/**
 * Highlights [[wikilinks]] and ![[embeds]] in the note editor and makes them
 * ctrl/cmd-clickable. Clicking dispatches a DOM event the notes panel handles
 * (open/create the target note, or scroll to an embedded source).
 */
export function wikilinkExtension(): Extension[] {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = this.build(view)
      }
      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view)
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>()
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to)
          let m: RegExpExecArray | null
          WIKILINK.lastIndex = 0
          while ((m = WIKILINK.exec(text))) {
            const start = from + m.index
            const end = start + m[0].length
            const embed = m[1] === '!'
            builder.add(
              start,
              end,
              Decoration.mark({
                class: embed ? 'cm-wisp-embed' : 'cm-wisp-link',
                attributes: { 'data-target': m[2].split('|')[0].trim() }
              })
            )
          }
        }
        return builder.finish()
      }
    },
    { decorations: (v) => v.decorations }
  )

  const clicks = EditorView.domEventHandlers({
    mousedown(event) {
      const el = (event.target as HTMLElement).closest('.cm-wisp-link, .cm-wisp-embed')
      if (el && (event.ctrlKey || event.metaKey)) {
        const target = el.getAttribute('data-target')
        const embed = el.classList.contains('cm-wisp-embed')
        if (target) {
          window.dispatchEvent(
            new CustomEvent('wisp:wikilink', { detail: { target, embed } })
          )
          event.preventDefault()
          return true
        }
      }
      return false
    }
  })

  return [plugin, clicks]
}
