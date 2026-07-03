// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { wikilinkExtension } from './wikilinkExtension'
import { imagePreview } from './imageExtension'
import { invoke, useApp } from '@/store'

/**
 * Images pasted or dropped into a note are saved into the room's clips dir
 * and referenced as `![name](../clips/<file>)` — the preview extension then
 * renders them inline.
 */
function insertImages(dt: DataTransfer | null, view: EditorView): boolean {
  const files = dt ? [...dt.files].filter((f) => f.type.startsWith('image/')) : []
  if (files.length === 0) return false
  const roomId = useApp.getState().activeRoomId
  if (!roomId) return false
  void (async () => {
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const file = await invoke<string | null>('notes:saveImage', roomId, f.name || 'image.png', bytes)
      if (!file) continue
      const alt = (f.name || 'image').replace(/\.[^.]+$/, '')
      const pos = view.state.selection.main.head
      const insert = `![${alt}](../clips/${file})\n`
      view.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } })
    }
  })()
  return true
}

const imageInput = EditorView.domEventHandlers({
  paste: (event, view) => insertImages(event.clipboardData, view),
  drop: (event, view) => insertImages(event.dataTransfer, view)
})

const wispTheme = EditorView.theme(
  {
    '&': { color: '#d4d4d4', backgroundColor: 'transparent', height: '100%', fontSize: '14px' },
    '.cm-content': {
      caretColor: 'var(--wisp-accent)',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      padding: '16px 4px',
      lineHeight: '1.7'
    },
    '.cm-cursor': { borderLeftColor: 'var(--wisp-accent)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': { backgroundColor: 'transparent', color: '#525252', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.02)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(125,211,168,0.18) !important' },
    '.cm-wisp-link': { color: 'var(--wisp-accent)', cursor: 'pointer', textDecoration: 'underline' },
    '.cm-wisp-embed': {
      color: '#c58af8',
      cursor: 'pointer',
      backgroundColor: 'rgba(197,138,248,0.12)',
      borderRadius: '3px'
    }
  },
  { dark: true }
)

export default function NoteEditor(props: {
  noteId: string
  initialBody: string
  onChange: (body: string) => void
}): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(props.onChange)
  onChangeRef.current = props.onChange

  // Rebuild the editor only when switching to a different note.
  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: props.initialBody,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        ...wikilinkExtension(),
        imagePreview(),
        imageInput,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        wispTheme,
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        })
      ]
    })
    view.current = new EditorView({ state, parent: host.current })
    return () => {
      view.current?.destroy()
      view.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.noteId])

  // Source-embed inserter: the notes sidebar dispatches the source id here.
  useEffect(() => {
    const handler = (e: Event): void => {
      const id = (e as CustomEvent<string>).detail
      const v = view.current
      if (!v) return
      const pos = v.state.selection.main.head
      v.dispatch({
        changes: { from: pos, insert: `![[${id}]] ` },
        selection: { anchor: pos + id.length + 6 }
      })
      v.focus()
    }
    window.addEventListener('wisp:insert-embed', handler as EventListener)
    return () => window.removeEventListener('wisp:insert-embed', handler as EventListener)
  }, [])

  return <div ref={host} className="h-full overflow-auto" />
}
