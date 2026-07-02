// Wisp — © Shawy404. All rights reserved.
import { useState } from 'react'
import type { SourceItem } from '@shared/types'
import { formatCitation, type CitationFormat } from '@shared/citation'
import { useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'

const KIND_KEY: Record<SourceItem['kind'], TKey> = {
  academic: 'sourceCard.kind.academic',
  wiki: 'sourceCard.kind.wiki',
  image: 'sourceCard.kind.image',
  web: 'sourceCard.kind.web',
  clip: 'sourceCard.kind.clip'
}

const KIND_COLOR: Record<SourceItem['kind'], string> = {
  academic: 'text-sky-400 border-sky-400/30',
  wiki: 'text-amber-300 border-amber-300/30',
  image: 'text-fuchsia-400 border-fuchsia-400/30',
  web: 'text-neutral-400 border-neutral-500/30',
  clip: 'text-accent border-accent/30'
}

export default function SourceCard(props: {
  source: SourceItem
  onDelete?: () => void
  extraActions?: React.ReactNode
}): React.JSX.Element {
  const { source } = props
  const { newTab, setOverlay } = useApp.getState()
  const t = useT()
  const [citeOpen, setCiteOpen] = useState(false)
  const [copied, setCopied] = useState<CitationFormat | null>(null)

  const copyCite = async (fmt: CitationFormat): Promise<void> => {
    await navigator.clipboard.writeText(formatCitation(source, fmt))
    setCopied(fmt)
    setTimeout(() => {
      setCopied(null)
      setCiteOpen(false)
    }, 900)
  }

  const meta = [
    source.authors?.slice(0, 3).join(', '),
    source.year ? String(source.year) : undefined,
    source.venue
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="group rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 hover:border-neutral-700">
      <div className="flex items-start gap-2">
        {source.imageUrl && (
          <img
            src={source.imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded border px-1 py-px text-[9px] tracking-wide uppercase ${KIND_COLOR[source.kind]}`}
            >
              {t(KIND_KEY[source.kind])}
            </span>
            <button
              className="min-w-0 flex-1 truncate text-left text-xs font-medium text-neutral-200 hover:text-accent"
              title={source.url ?? source.title}
              onClick={() => {
                if (source.url) {
                  newTab(source.url)
                  setOverlay('none')
                }
              }}
            >
              {source.title}
            </button>
          </div>
          {meta && <div className="mt-0.5 truncate text-[11px] text-neutral-500">{meta}</div>}
          {(source.abstract || source.excerpt) && (
            <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-400 select-text">
              {source.excerpt ?? source.abstract}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {source.tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="rounded-full bg-neutral-800 px-1.5 py-px text-[10px] text-neutral-400"
              >
                #{t}
              </span>
            ))}
            <span className="relative ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {props.extraActions}
              <button
                className="rounded px-1.5 py-px text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                onClick={() => setCiteOpen((v) => !v)}
              >
                {t('sourceCard.cite')}
              </button>
              {citeOpen && (
                <span className="absolute top-5 right-0 z-20 flex overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-xl">
                  {(['bibtex', 'apa', 'mla'] as CitationFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      className="px-2 py-1 text-[10px] text-neutral-300 uppercase hover:bg-neutral-800"
                      onClick={() => void copyCite(fmt)}
                    >
                      {copied === fmt ? '✓' : fmt}
                    </button>
                  ))}
                </span>
              )}
              {props.onDelete && (
                <button
                  className="rounded px-1.5 py-px text-[10px] text-red-400/80 hover:bg-red-400/10"
                  onClick={props.onDelete}
                >
                  {t('sourceCard.delete')}
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
