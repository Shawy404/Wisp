// Wisp. © Shawy404, MIT.
import { useApp, useT } from '@/store'
import type { TKey } from '@shared/i18n'

const ROWS: { combo: string; key: TKey }[] = [
  { combo: 'Ctrl+T', key: 'shortcuts.palette' },
  { combo: 'Ctrl+L', key: 'shortcuts.address' },
  { combo: 'Ctrl+W', key: 'shortcuts.closeTab' },
  { combo: 'Ctrl+Tab / Ctrl+Shift+Tab', key: 'shortcuts.cycleTabs' },
  { combo: 'Ctrl+1 … Ctrl+9', key: 'shortcuts.gotoTab' },
  { combo: 'Ctrl+F', key: 'shortcuts.find' },
  { combo: 'Ctrl+Shift+F', key: 'shortcuts.roomSearch' },
  { combo: 'Ctrl+H', key: 'shortcuts.history' },
  { combo: 'F11', key: 'shortcuts.fullscreen' },
  { combo: 'Shift+F11', key: 'shortcuts.trueFullscreen' },
  { combo: 'Ctrl+/ · ?', key: 'shortcuts.help' }
]

export default function ShortcutsPanel(): React.JSX.Element {
  const t = useT()
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-950"
      onClick={() => useApp.getState().setOverlay('none')}
    >
      <div
        className="w-[440px] rounded-xl border border-neutral-800 bg-neutral-900/60 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-sm font-semibold text-neutral-200">{t('shortcuts.title')}</div>
        <div className="space-y-1.5">
          {ROWS.map((row) => (
            <div key={row.combo} className="flex items-center gap-3 text-xs">
              <span className="w-52 shrink-0">
                {row.combo.split(' / ').map((c, i) => (
                  <span key={c}>
                    {i > 0 && <span className="text-neutral-600"> / </span>}
                    <kbd className="rounded border border-neutral-700 bg-neutral-850 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                      {c}
                    </kbd>
                  </span>
                ))}
              </span>
              <span className="text-neutral-400">{t(row.key)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
