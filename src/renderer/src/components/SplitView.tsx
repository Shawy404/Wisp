// Wisp — © Shawy404. All rights reserved.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteInfo } from '@shared/types'
import type { TKey } from '@shared/i18n'
import { invoke, useApp, useT } from '@/store'
import NoteEditor from '../editor/NoteEditor'
import SourceCard from './SourceCard'

interface ReaderArticle {
  title: string
  byline?: string
  siteName?: string
  html: string
  url: string
  words: number
}

/** What a split pane can show. 'live' is the actual interactive web page. */
type PaneMode = 'live' | 'reader' | 'note' | 'sources'

const MODE_KEY: Record<PaneMode, TKey> = {
  live: 'splitView.mode.live',
  reader: 'splitView.mode.reader',
  note: 'splitView.mode.note',
  sources: 'splitView.mode.sources'
}

/**
 * Split view: two independent panes, each showing the live page, the reader,
 * a note, or the room's sources — pick per pane from its header. Dragging a tab
 * to a viewport edge opens this with the live page on that side and a note on
 * the other, so you can read a page and take notes side by side. Only one pane
 * can be the live page at a time (there's a single active web view); its rect
 * is handed to the main process, which positions the native page into exactly
 * that pane while the other pane is drawn here.
 */
export default function SplitView(): React.JSX.Element {
  const sources = useApp((s) => s.sources)
  const notes = useApp((s) => s.notes)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const activeTabId = useApp((s) => s.activeTabId)
  const splitSide = useApp((s) => s.splitSide)
  const t = useT()

  // Default layout: the page side (from a drag, or wherever the tab is) shows
  // the live page; the other side takes notes. With no open tab, fall back to
  // reader/sources so the panes still show something useful.
  const pageSide = splitSide
  const [leftMode, setLeftMode] = useState<PaneMode>(
    pageSide === 'left' ? (activeTabId ? 'live' : 'reader') : 'note'
  )
  const [rightMode, setRightMode] = useState<PaneMode>(
    pageSide === 'right' ? (activeTabId ? 'live' : 'reader') : 'note'
  )

  const [article, setArticle] = useState<ReaderArticle | null>(null)
  const [readerLoading, setReaderLoading] = useState(false)
  const [noteId, setNoteId] = useState<string | null>(notes[0]?.id ?? null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leftContent = useRef<HTMLDivElement>(null)
  const rightContent = useRef<HTMLDivElement>(null)
  const activeNote = notes.find((n) => n.id === noteId) ?? null
  const needsReader = leftMode === 'reader' || rightMode === 'reader'

  useEffect(() => {
    if (!noteId && notes.length) setNoteId(notes[0].id)
  }, [notes, noteId])

  // Pull the reader article only when some pane actually shows it.
  useEffect(() => {
    if (!needsReader || !activeTabId) return
    setReaderLoading(true)
    invoke<ReaderArticle | null>('reader:extract', activeTabId).then((a) => {
      setArticle(a)
      setReaderLoading(false)
    })
  }, [needsReader, activeTabId])

  // Setting one pane to 'live' takes the live page away from the other — there
  // is only one active web view to position.
  const setMode = (side: 'left' | 'right', mode: PaneMode): void => {
    if (side === 'left') {
      setLeftMode(mode)
      if (mode === 'live' && rightMode === 'live') setRightMode('note')
    } else {
      setRightMode(mode)
      if (mode === 'live' && leftMode === 'live') setLeftMode('note')
    }
  }

  // Hand the live pane's rect to the main process so the native page view lands
  // exactly there; clear it (and hide the view) when neither pane is live.
  const liveSide = leftMode === 'live' ? 'left' : rightMode === 'live' ? 'right' : null
  const pushLiveRect = useCallback((): void => {
    const el = liveSide === 'left' ? leftContent.current : liveSide === 'right' ? rightContent.current : null
    if (!el) {
      useApp.getState().setSplitLiveRect(null)
      void invoke('viewport:visible', false)
      return
    }
    const r = el.getBoundingClientRect()
    const rect = { x: r.x, y: r.y, width: r.width, height: r.height }
    useApp.getState().setSplitLiveRect(rect)
    void invoke('viewport:bounds', rect)
    void invoke('viewport:visible', true)
  }, [liveSide])

  useEffect(() => {
    pushLiveRect()
    if (!liveSide) return
    const el = liveSide === 'left' ? leftContent.current : rightContent.current
    const ro = el ? new ResizeObserver(pushLiveRect) : null
    if (el && ro) ro.observe(el)
    window.addEventListener('resize', pushLiveRect)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', pushLiveRect)
    }
  }, [liveSide, pushLiveRect])

  // Leaving split view releases the native page view back to the full viewport.
  useEffect(() => {
    return () => {
      useApp.getState().setSplitLiveRect(null)
    }
  }, [])

  const handleChange = (body: string): void => {
    if (!activeRoomId || !noteId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void invoke('notes:save', activeRoomId, noteId, body).then(() =>
        useApp.getState().refreshRoomData()
      )
    }, 500)
  }

  const createNote = async (): Promise<void> => {
    if (!activeRoomId) return
    const title = article?.title?.slice(0, 60) || t('splitView.defaultNoteTitle')
    const note = await invoke<NoteInfo>('notes:create', activeRoomId, title)
    await useApp.getState().refreshRoomData()
    setNoteId(note.id)
  }

  const ModePicker = ({ side, mode }: { side: 'left' | 'right'; mode: PaneMode }): React.JSX.Element => (
    <div className="flex items-center gap-1">
      {(['live', 'reader', 'note', 'sources'] as PaneMode[]).map((m) => (
        <button
          key={m}
          className={`rounded px-2 py-1 text-[11px] ${
            mode === m ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
          }`}
          onClick={() => setMode(side, m)}
        >
          {t(MODE_KEY[m])}
        </button>
      ))}
    </div>
  )

  const PaneBody = ({
    mode,
    contentRef
  }: {
    mode: PaneMode
    contentRef: React.RefObject<HTMLDivElement | null>
  }): React.JSX.Element => {
    if (mode === 'live') {
      // The native page view is positioned over this element by the main
      // process; the placeholder only shows if there's no page to place.
      return (
        <div ref={contentRef} className="relative h-full w-full">
          {!activeTabId && (
            <div className="flex h-full items-center justify-center text-xs text-neutral-600">
              {t('splitView.noPage')}
            </div>
          )}
        </div>
      )
    }
    if (mode === 'sources') {
      return (
        <div ref={contentRef} className="h-full overflow-y-auto">
          <div className="space-y-2 p-4">
            {sources.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
            {sources.length === 0 && (
              <div className="pt-8 text-center text-xs text-neutral-600">{t('splitView.noSources')}</div>
            )}
          </div>
        </div>
      )
    }
    if (mode === 'note') {
      return (
        <div ref={contentRef} className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
            <select
              value={noteId ?? ''}
              onChange={(e) => setNoteId(e.target.value)}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none"
            >
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
            <button
              className="rounded bg-accent/15 px-2 py-1 text-[11px] text-accent hover:bg-accent/25"
              onClick={() => void createNote()}
            >
              {t('splitView.newNote')}
            </button>
          </div>
          <div className="min-h-0 flex-1 px-2">
            {activeNote ? (
              <NoteEditor
                key={activeNote.id}
                noteId={activeNote.id}
                initialBody={activeNote.body}
                onChange={handleChange}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-600">
                {t('splitView.pickNote')}
              </div>
            )}
          </div>
        </div>
      )
    }
    // reader
    return (
      <div ref={contentRef} className="h-full overflow-y-auto">
        {readerLoading ? (
          <div className="pt-10 text-center text-xs text-neutral-500">{t('splitView.cleaning')}</div>
        ) : article ? (
          <article className="mx-auto max-w-xl px-5 py-6 select-text">
            <h1 className="text-xl font-semibold text-neutral-100">{article.title}</h1>
            <div className="mt-1 text-[11px] text-neutral-500">
              {[article.byline, article.siteName].filter(Boolean).join(' · ')}
            </div>
            <div
              className="wisp-reader mt-4 text-sm leading-relaxed text-neutral-300"
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
          </article>
        ) : (
          <div className="pt-10 text-center text-xs text-neutral-600">{t('splitView.noArticle')}</div>
        )}
      </div>
    )
  }

  const Pane = ({
    side,
    mode,
    contentRef,
    border
  }: {
    side: 'left' | 'right'
    mode: PaneMode
    contentRef: React.RefObject<HTMLDivElement | null>
    border: string
  }): React.JSX.Element => (
    <div className={`flex min-w-0 flex-1 flex-col ${border}`}>
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <ModePicker side={side} mode={mode} />
        {side === 'right' && (
          <button
            className="ml-auto rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800"
            onClick={() => useApp.getState().setOverlay('none')}
          >
            {t('splitView.close')}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <PaneBody mode={mode} contentRef={contentRef} />
      </div>
    </div>
  )

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-neutral-950">
      <Pane side="left" mode={leftMode} contentRef={leftContent} border="border-r border-neutral-800" />
      <Pane side="right" mode={rightMode} contentRef={rightContent} border="" />
    </div>
  )
}
