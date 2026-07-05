// Wisp. © Shawy404, MIT.
import { useEffect, useState } from 'react'
import { invoke, useApp, useT } from '@/store'

interface Article {
  title: string
  byline?: string
  siteName?: string
  html: string
  text: string
  url: string
  words: number
}

export default function ReaderPanel(): React.JSX.Element {
  const activeTabId = useApp((s) => s.activeTabId)
  const t = useT()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    invoke<Article | null>('reader:extract', activeTabId).then((a) => {
      if (!cancelled) {
        setArticle(a)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeTabId])

  const save = async (): Promise<void> => {
    await invoke('reader:save', activeTabId)
    setSaved(true)
    await useApp.getState().refreshRoomData()
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-6 py-3">
        <span className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          {t('reader.title')}
        </span>
        {article && (
          <span className="text-[11px] text-neutral-600">
            {t('reader.wordCount', { count: article.words })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
            onClick={() => void save()}
            disabled={!article || saved}
          >
            {saved ? t('reader.saved') : t('reader.save')}
          </button>
          <button
            className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            onClick={() => useApp.getState().setOverlay('none')}
          >
            {t('reader.close')}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 pt-16 text-sm text-neutral-500">
            <span className="h-4 w-4 animate-spin rounded-full border border-neutral-600 border-t-accent" />
            {t('reader.loading')}
          </div>
        )}
        {!loading && !article && (
          <div className="pt-16 text-center text-sm text-neutral-600">{t('reader.noArticle')}</div>
        )}
        {article && (
          <article className="mx-auto max-w-2xl px-6 py-8 select-text">
            <h1 className="text-2xl leading-tight font-semibold text-neutral-100">
              {article.title}
            </h1>
            <div className="mt-2 text-xs text-neutral-500">
              {[article.byline, article.siteName].filter(Boolean).join(' · ')}
            </div>
            <div
              className="wisp-reader mt-6 text-[15px] leading-relaxed text-neutral-300"
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
          </article>
        )}
      </div>
    </div>
  )
}
