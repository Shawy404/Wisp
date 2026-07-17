// Wisp. © Shawy404, MIT.
import { useEffect, useRef, useState } from 'react'
import { invoke, useT } from '@/store'
import { Icon } from './icons'

/**
 * Find-in-page. Lives in the title-bar row (the only place a DOM element can
 * sit without being covered by the native page view). Ctrl+F opens it via the
 * 'wisp:find-open' event; matches count streams in over 'find:result'.
 */
export default function FindBar(): React.JSX.Element | null {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [result, setResult] = useState({ matches: 0, active: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onOpen = (): void => {
      setOpen(true)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
    window.addEventListener('wisp:find-open', onOpen)
    const off = window.wisp.on('find:result', (r) => {
      setResult(r as { matches: number; active: number })
    })
    return () => {
      window.removeEventListener('wisp:find-open', onOpen)
      off()
    }
  }, [])

  const close = (): void => {
    setOpen(false)
    setText('')
    setResult({ matches: 0, active: 0 })
    void invoke('find:stop')
  }

  if (!open) return null

  return (
    <div className="no-drag flex h-8 shrink-0 items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/70 px-2">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          void invoke('find:start', e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void invoke('find:next', !e.shiftKey)
          if (e.key === 'Escape') close()
        }}
        placeholder={t('find.placeholder')}
        className="h-6 w-40 bg-transparent px-1 text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
        spellCheck={false}
      />
      <span className="min-w-[38px] text-center text-[10px] tabular-nums text-neutral-500">
        {t('find.count', { active: result.active, total: result.matches })}
      </span>
      <button
        className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        onClick={() => void invoke('find:next', false)}
        data-tip={t('find.prev')}
        data-tip-pos="bottom"
        aria-label={t('find.prev')}
      >
        <Icon name="chevron-up" size={12} />
      </button>
      <button
        className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        onClick={() => void invoke('find:next', true)}
        data-tip={t('find.next')}
        data-tip-pos="bottom"
        aria-label={t('find.next')}
      >
        <Icon name="chevron-down" size={12} />
      </button>
      <button
        className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        onClick={close}
        data-tip={t('find.close')}
        data-tip-pos="bottom"
        aria-label={t('find.close')}
      >
        <Icon name="close" size={11} />
      </button>
    </div>
  )
}
