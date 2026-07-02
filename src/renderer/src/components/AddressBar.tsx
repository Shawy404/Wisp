// Wisp — © Shawy404. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import { resolveAddress } from '@shared/address'
import { invoke, useApp } from '@/store'

function NavButton(props: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    >
      {props.children}
    </button>
  )
}

export default function AddressBar(): React.JSX.Element {
  const tabs = useApp((s) => s.tabs)
  const activeTabId = useApp((s) => s.activeTabId)
  const devMode = useApp((s) => s.config?.devMode ?? false)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused) setValue(activeTab?.url === 'about:blank' ? '' : (activeTab?.url ?? ''))
  }, [activeTab?.url, activeTabId, focused])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        useApp.getState().newTab()
        inputRef.current?.focus()
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        const { activeTabId, closeTab } = useApp.getState()
        if (activeTabId) closeTab(activeTabId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const submit = (): void => {
    const resolved = resolveAddress(value)
    const { activeTabId, navigate, newTab, setOverlay } = useApp.getState()
    if (resolved.type === 'url') {
      if (activeTabId) navigate(activeTabId, resolved.url)
      else newTab(resolved.url)
    } else if (resolved.query) {
      // Route queries into the room's search strip — searching *is* collecting.
      window.dispatchEvent(new CustomEvent('wisp:search', { detail: resolved.query }))
      setOverlay('search')
    }
    inputRef.current?.blur()
  }

  return (
    <div className="no-drag mx-auto flex h-8 min-w-0 flex-1 max-w-2xl items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/70 px-1.5 focus-within:border-accent/50">
      <NavButton
        title="Geri"
        disabled={!activeTab?.canGoBack}
        onClick={() => activeTabId && invoke('tabs:back', activeTabId)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M8 1 L3 6 L8 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </NavButton>
      <NavButton
        title="İleri"
        disabled={!activeTab?.canGoForward}
        onClick={() => activeTabId && invoke('tabs:forward', activeTabId)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M4 1 L9 6 L4 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </NavButton>
      <NavButton title="Yenile" onClick={() => activeTabId && invoke('tabs:reload', activeTabId)}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M10.5 6 A4.5 4.5 0 1 1 6 1.5 M6 1.5 L8.5 1.5 M6 1.5 L6 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      </NavButton>
      {devMode && (
        <NavButton
          title="DevTools (web dev modu)"
          disabled={!activeTab}
          onClick={() => invoke('tabs:devtools')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M4.5 3 L2 6 L4.5 9 M7.5 3 L10 6 L7.5 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </NavButton>
      )}
      <NavButton
        title="Reader modu"
        disabled={!activeTab || activeTab.url === 'about:blank'}
        onClick={() => useApp.getState().setOverlay('reader')}
      >
        <svg width="13" height="13" viewBox="0 0 14 14">
          <path
            d="M2 2.5 h10 M2 5 h10 M2 7.5 h7 M2 10 h9"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </NavButton>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          setFocused(true)
          e.target.select()
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="URL yaz ya da ara — aramalar odaya kaydedilir"
        className="h-7 min-w-0 flex-1 bg-transparent px-2 text-center text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:text-left"
        spellCheck={false}
      />
    </div>
  )
}
