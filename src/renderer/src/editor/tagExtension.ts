// Wisp. © Shawy404, MIT.
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { useApp } from '@/store'

/**
 * Type # in a note and every tag this room already knows about shows up.
 * Pick one and the note joins the club: anything else wearing that tag gets
 * connected to it on the map. No new tag registry, no config, the tags that
 * exist are simply the tags you see.
 */

function allTags(): string[] {
  const s = useApp.getState()
  const tags = new Set<string>()
  for (const n of s.notes) for (const t of n.tags) tags.add(t)
  for (const src of s.sources) for (const t of src.tags) tags.add(t)
  for (const c of s.map.concepts) for (const t of c.tags) tags.add(t)
  return [...tags].sort()
}

function tagCompletions(ctx: CompletionContext): CompletionResult | null {
  // the word being typed, hash included. matches right after a lone # too,
  // which is the whole point: # and the list is already open.
  const word = ctx.matchBefore(/#[\p{L}\p{N}_-]*/u)
  if (!word) return null
  const typed = ctx.state.sliceDoc(word.from + 1, word.to).toLowerCase()
  const options = allTags()
    .filter((t) => !typed || (t.includes(typed) && t !== typed))
    .slice(0, 12)
    .map((t) => ({ label: `#${t}`, type: 'keyword' as const }))
  if (options.length === 0) return null
  return { from: word.from, options, validFor: /^#[\p{L}\p{N}_-]*$/u }
}

export function tagAutocomplete(): Extension {
  return autocompletion({ override: [tagCompletions], icons: false })
}
