// Wisp. © Shawy404, MIT.
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

/** What a split pane can show. 'live' is a real, interactive web page. */
type PaneMode = 'live' | 'reader' | 'note' | 'sources'

const MODE_KEY: Record<PaneMode, TKey> = {
  live: 'splitView.mode.live',
  reader: 'splitView.mode.reader',
  note: 'splitView.mode.note',
  sources: 'splitView.mode.sources'
}

/**
 * Split view: two independent panes, each showing a live page, the reader, a
 * note, or the room's sources — pick per pane from its header. Both panes can
 * be live pages at once (a different tab in each), so you can read two pages
 * side by side, or a page next to a note. Each live pane hands its rect and
 * chosen tab to the main process, which attaches that tab's real web view into
 * exactly that pane. A tab can only be live in one pane at a time — there's a
 * single web view per tab.
 */
export default function SplitView(): React.JSX.Element {
  const sources = useApp((s) => s.sources)
  const notes = useApp((s) => s.notes)
  const tabs = useApp((s) => s.tabs)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const activeTabId = useApp((s) => s.activeTabId)
  const splitSide = useApp((s) => s.splitSide)
  const t = useT()

  const pickTab = useCallback(
    (otherTabId: string | null): string | null => {
      if (activeTabId && activeTabId !== otherTabId) return activeTabId
      return tabs.find((tb) => tb.id !== otherTabId)?.id ?? activeTabId ?? null
    },
    [activeTabId, tabs]
  )

  // Default layout: put the active tab on the side it was dragged to and a
  // different tab on the other side, so with two or more tabs open you get two
  // live pages side by side straight away. A side with no tab falls back to a
  // note (or reader when there's nothing at all).
  const otherTab = tabs.find((tb) => tb.id !== activeTabId)?.id ?? null
  const initLeftTab = splitSide === 'right' ? otherTab : activeTabId
  const initRightTab = splitSide === 'right' ? activeTabId : otherTab
  const [leftMode, setLeftMode] = useState<PaneMode>(
    initLeftTab ? 'live' : activeTabId || otherTab ? 'note' : 'reader'
  )
  const [rightMode, setRightMode] = useState<PaneMode>(
    initRightTab ? 'live' : activeTabId || otherTab ? 'note' : 'reader'
  )
  const [leftTab, setLeftTab] = useState<string | null>(initLeftTab)
  const [rightTab, setRightTab] = useState<string | null>(initRightTab)

  // Fraction of the width the left pane takes; dragged via the middle divider.
  const [leftFrac, setLeftFrac] = useState(0.5)
  const [draggingDivider, setDraggingDivider] = useState(false)
  const draggingRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!needsReader || !activeTabId) return
    setReaderLoading(true)
    invoke<ReaderArticle | null>('reader:extract', activeTabId).then((a) => {
      setArticle(a)
      setReaderLoading(false)
    })
  }, [needsReader, activeTabId])

  const setMode = (side: 'left' | 'right', mode: PaneMode): void => {
    if (side === 'left') {
      setLeftMode(mode)
      if (mode === 'live') setLeftTab((cur) => (cur && cur !== rightTab ? cur : pickTab(rightTab)))
    } else {
      setRightMode(mode)
      if (mode === 'live') setRightTab((cur) => (cur && cur !== leftTab ? cur : pickTab(leftTab)))
    }
  }

  // Gap left between the two live views so the drag divider (DOM) shows through
  // — native views are drawn over all DOM, so without a gap they'd bury it.
  const DIVIDER_GAP = 10

  // Hand each live pane's tab + rect to the main process so the real web views
  // land in the panes. Rects are computed from the container's geometry + the
  // split fraction (robust — never a stale per-pane measurement), so the views
  // track the sidebar collapsing/revealing and the divider moving exactly.
  const pushSplit = useCallback((): void => {
    // While the divider is dragged the native views are hidden so the pointer
    // reaches the DOM; don't re-attach them mid-drag.
    if (draggingRef.current) return
    const root = rootRef.current
    if (!root) return
    const r = root.getBoundingClientRect()
    // Content sits below the pane header; take its top from a content div.
    const cTop = (leftContent.current ?? rightContent.current)?.getBoundingClientRect().top ?? r.top
    const top = Math.round(cTop)
    const height = Math.round(r.bottom - cTop)
    const splitX = r.x + r.width * leftFrac
    const panes: { tabId: string; rect: { x: number; y: number; width: number; height: number } }[] = []
    const seen = new Set<string>()
    if (leftMode === 'live' && leftTab && !seen.has(leftTab)) {
      seen.add(leftTab)
      panes.push({
        tabId: leftTab,
        rect: { x: Math.round(r.x), y: top, width: Math.round(splitX - DIVIDER_GAP / 2 - r.x), height }
      })
    }
    if (rightMode === 'live' && rightTab && !seen.has(rightTab)) {
      seen.add(rightTab)
      const rx = Math.round(splitX + DIVIDER_GAP / 2)
      panes.push({ tabId: rightTab, rect: { x: rx, y: top, width: Math.round(r.right - rx), height } })
    }
    if (panes.length === 0) {
      useApp.getState().setSplitLive(false)
      void invoke('split:hide')
      void invoke('viewport:visible', false)
    } else {
      useApp.getState().setSplitLive(true)
      void invoke('split:show', panes)
    }
  }, [leftMode, rightMode, leftTab, rightTab, leftFrac])

  useEffect(() => {
    pushSplit()
    // Observe the whole split container so any size change — including the
    // sidebar collapsing/revealing beside it — re-lays the live views.
    const ro = new ResizeObserver(pushSplit)
    if (rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', pushSplit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', pushSplit)
    }
  }, [pushSplit])

  // Leaving split view releases the web views back to the single viewport.
  useEffect(() => {
    return () => {
      useApp.getState().setSplitLive(false)
      void invoke('split:hide')
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

  const PaneHeader = ({ side }: { side: 'left' | 'right' }): React.JSX.Element => {
    const mode = side === 'left' ? leftMode : rightMode
    const liveTab = side === 'left' ? leftTab : rightTab
    const otherLiveTab = side === 'left' ? rightTab : leftTab
    const otherLive = side === 'left' ? rightMode === 'live' : leftMode === 'live'
    return (
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
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
        {mode === 'live' && tabs.length > 0 && (
          <select
            value={liveTab ?? ''}
            onChange={(e) => (side === 'left' ? setLeftTab(e.target.value) : setRightTab(e.target.value))}
            className="max-w-[40%] rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 outline-none"
          >
            {tabs.map((tb) => (
              <option key={tb.id} value={tb.id} disabled={otherLive && tb.id === otherLiveTab}>
                {tb.title || tb.url}
              </option>
            ))}
          </select>
        )}
        {side === 'right' && (
          <button
            className="ml-auto rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800"
            onClick={() => useApp.getState().setOverlay('none')}
          >
            {t('splitView.close')}
          </button>
        )}
      </div>
    )
  }

  const PaneBody = ({
    mode,
    contentRef
  }: {
    mode: PaneMode
    contentRef: React.RefObject<HTMLDivElement | null>
  }): React.JSX.Element => {
    if (mode === 'live') {
      // The main process positions the real web view over this element.
      return (
        <div ref={contentRef} className="relative h-full w-full">
          {tabs.length === 0 && (
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

  const startDividerDrag = (): void => {
    // Hide the live views for the duration of the drag so mouse events land on
    // the DOM overlay, not the native page. Restored on release.
    draggingRef.current = true
    setDraggingDivider(true)
    useApp.getState().setSplitLive(false)
    void invoke('split:hide')
    void invoke('viewport:visible', false)
  }
  const onDividerMove = (e: React.MouseEvent): void => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setLeftFrac(Math.min(0.8, Math.max(0.2, (e.clientX - r.left) / r.width)))
  }
  const endDividerDrag = (): void => {
    draggingRef.current = false
    setDraggingDivider(false)
    // Let the panes settle at the new width, then re-attach the live views.
    requestAnimationFrame(pushSplit)
  }

  return (
    <div ref={rootRef} className="absolute inset-0 flex overflow-hidden bg-neutral-950">
      <div className="flex min-w-0 flex-col" style={{ flex: `${leftFrac} 1 0%` }}>
        <PaneHeader side="left" />
        <div className="min-h-0 flex-1">
          <PaneBody mode={leftMode} contentRef={leftContent} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col" style={{ flex: `${1 - leftFrac} 1 0%` }}>
        <PaneHeader side="right" />
        <div className="min-h-0 flex-1">
          <PaneBody mode={rightMode} contentRef={rightContent} />
        </div>
      </div>

      {/* The divider sits in the gap the live views leave for it, so it's always
          visible and grabbable — even between two live pages. */}
      <div
        onMouseDown={startDividerDrag}
        style={{ left: `${leftFrac * 100}%` }}
        className="group absolute top-0 bottom-0 z-30 flex w-2.5 -translate-x-1/2 cursor-col-resize items-stretch justify-center"
        data-tip={t('splitView.resize')}
      >
        <div className={`w-px ${draggingDivider ? 'bg-accent' : 'bg-neutral-700'} group-hover:bg-accent/60`} />
      </div>

      {/* Full-window capture layer while dragging — native views are hidden
          meanwhile so these events actually land here. */}
      {draggingDivider && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize"
          onMouseMove={onDividerMove}
          onMouseUp={endDividerDrag}
          onMouseLeave={endDividerDrag}
        />
      )}
    </div>
  )
}
