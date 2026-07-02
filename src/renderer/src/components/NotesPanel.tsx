// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import type { NoteInfo } from '@shared/types'
import { noteSlug } from '@shared/wikilink'
import { invoke, useApp, useT } from '@/store'
import NoteEditor from '../editor/NoteEditor'

export default function NotesPanel(): React.JSX.Element {
  const notes = useApp((s) => s.notes)
  const sources = useApp((s) => s.sources)
  const activeRoomId = useApp((s) => s.activeRoomId)
  const t = useT()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = notes.find((n) => n.id === activeId) ?? null

  useEffect(() => {
    if (!activeId && notes.length) setActiveId(notes[0].id)
  }, [notes, activeId])

  // Ctrl-click on a [[wikilink]] opens or creates the target note.
  useEffect(() => {
    const handler = async (e: Event): Promise<void> => {
      const { target, embed } = (e as CustomEvent<{ target: string; embed: boolean }>).detail
      if (embed) return
      if (!activeRoomId) return
      const slug = noteSlug(target)
      const exists = notes.find((n) => n.id === slug)
      if (exists) {
        setActiveId(exists.id)
      } else {
        const note = await invoke<NoteInfo>('notes:create', activeRoomId, target)
        await useApp.getState().refreshRoomData()
        setActiveId(note.id)
      }
    }
    window.addEventListener('wisp:wikilink', handler as EventListener)
    return () => window.removeEventListener('wisp:wikilink', handler as EventListener)
  }, [activeRoomId, notes])

  const createNote = async (title: string): Promise<void> => {
    if (!activeRoomId || !title.trim()) return
    const note = await invoke<NoteInfo>('notes:create', activeRoomId, title.trim())
    await useApp.getState().refreshRoomData()
    setActiveId(note.id)
    setCreating(false)
    setNewTitle('')
  }

  const handleChange = (body: string): void => {
    if (!activeRoomId || !activeId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void invoke('notes:save', activeRoomId, activeId, body).then(() =>
        useApp.getState().refreshRoomData()
      )
    }, 500)
  }

  const insertSourceEmbed = (sourceId: string): void => {
    // Embeds are stored as ![[src-id]] and rendered as cards in the map view.
    window.dispatchEvent(new CustomEvent('wisp:insert-embed', { detail: sourceId }))
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-neutral-950">
      <div className="flex w-56 flex-col border-r border-neutral-800">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            {t('notes.title')}
          </span>
          <button
            className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            onClick={() => setCreating(true)}
            title={t('notes.new')}
          >
            +
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
          {creating && (
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('notes.titlePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createNote(newTitle)
                if (e.key === 'Escape') setCreating(false)
              }}
              onBlur={() => setCreating(false)}
              className="w-full rounded-md border border-accent/50 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 outline-none"
            />
          )}
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveId(n.id)}
              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                n.id === activeId
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{n.title}</span>
              <span
                className="hidden text-neutral-600 group-hover:inline hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  if (activeRoomId) {
                    void invoke('notes:delete', activeRoomId, n.id).then(() => {
                      useApp.getState().refreshRoomData()
                      if (activeId === n.id) setActiveId(null)
                    })
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
          {notes.length === 0 && !creating && (
            <div className="px-2 py-6 text-center text-[11px] text-neutral-600">{t('notes.empty')}</div>
          )}
        </div>
        {sources.length > 0 && (
          <div className="border-t border-neutral-800 p-2">
            <div className="mb-1 px-1 text-[10px] tracking-wide text-neutral-600 uppercase">
              {t('notes.embedSource')}
            </div>
            <div className="max-h-28 space-y-0.5 overflow-y-auto">
              {sources.slice(0, 12).map((s) => (
                <button
                  key={s.id}
                  onClick={() => insertSourceEmbed(s.id)}
                  className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  title={s.title}
                >
                  ↳ {s.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2">
              <span className="text-sm font-medium text-neutral-200">{active.title}</span>
              <span className="text-[10px] text-neutral-600">notes/{active.id}.md</span>
              <span className="ml-auto flex gap-1">
                {active.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-neutral-800 px-1.5 py-px text-[10px] text-neutral-400"
                  >
                    #{t}
                  </span>
                ))}
              </span>
            </div>
            <div className="min-h-0 flex-1 px-2">
              <NoteEditor
                key={active.id}
                noteId={active.id}
                initialBody={active.body}
                onChange={handleChange}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
            {t('notes.pickOne')}
          </div>
        )}
      </div>
    </div>
  )
}
