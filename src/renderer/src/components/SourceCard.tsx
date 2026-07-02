// Wisp — © Shawy404. All rights reserved.
import type { SourceItem } from '@shared/types'
import { useApp } from '@/store'

const KIND_LABEL: Record<SourceItem['kind'], string> = {
  academic: 'Akademik',
  wiki: 'Wiki',
  image: 'Görsel',
  web: 'Web',
  clip: 'Klip'
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
              {KIND_LABEL[source.kind]}
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
            <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {props.extraActions}
              {props.onDelete && (
                <button
                  className="rounded px-1.5 py-px text-[10px] text-red-400/80 hover:bg-red-400/10"
                  onClick={props.onDelete}
                >
                  sil
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
