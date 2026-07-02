// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import type { NoteInfo } from '@shared/types'
import { invoke, useApp } from '@/store'
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

/**
 * Split view: read a source (reader-cleaned page, or the source list) on the
 * left while taking notes on the right — the classic research posture.
 */
export default function SplitView(): React.JSX.Element {
  const sources = useApp((s) => s.sources)
  const notes = useApp((s) => s.notes)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const activeTabId = useApp((s) => s.activeTabId)
  const [left, setLeft] = useState<'reader' | 'sources'>(activeTabId ? 'reader' : 'sources')
  const [article, setArticle] = useState<ReaderArticle | null>(null)
  const [readerLoading, setReaderLoading] = useState(false)
  const [noteId, setNoteId] = useState<string | null>(notes[0]?.id ?? null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeNote = notes.find((n) => n.id === noteId) ?? null

  useEffect(() => {
    if (!noteId && notes.length) setNoteId(notes[0].id)
  }, [notes, noteId])

  useEffect(() => {
    if (left !== 'reader' || !activeTabId) return
    setReaderLoading(true)
    invoke<ReaderArticle | null>('reader:extract', activeTabId).then((a) => {
      setArticle(a)
      setReaderLoading(false)
    })
  }, [left, activeTabId])

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
    const title = article?.title?.slice(0, 60) || 'Yeni not'
    const note = await invoke<NoteInfo>('notes:create', activeRoomId, title)
    await useApp.getState().refreshRoomData()
    setNoteId(note.id)
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-neutral-950">
      <div className="flex min-w-0 flex-1 flex-col border-r border-neutral-800">
        <div className="flex items-center gap-1 border-b border-neutral-800 px-3 py-2">
          <button
            className={`rounded px-2 py-1 text-[11px] ${left === 'reader' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => setLeft('reader')}
          >
            Reader
          </button>
          <button
            className={`rounded px-2 py-1 text-[11px] ${left === 'sources' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => setLeft('sources')}
          >
            Kaynaklar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {left === 'reader' &&
            (readerLoading ? (
              <div className="pt-10 text-center text-xs text-neutral-500">Temizleniyor…</div>
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
              <div className="pt-10 text-center text-xs text-neutral-600">
                Okunabilir sayfa yok — bir makale aç.
              </div>
            ))}
          {left === 'sources' && (
            <div className="space-y-2 p-4">
              {sources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
              {sources.length === 0 && (
                <div className="pt-8 text-center text-xs text-neutral-600">Kaynak yok.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-[46%] min-w-0 flex-col">
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
            + not
          </button>
          <button
            className="ml-auto rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800"
            onClick={() => useApp.getState().setOverlay('none')}
          >
            Kapat
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
              Not oluştur ve yanında oku.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
