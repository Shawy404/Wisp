// Wisp. © Shawy404, MIT.

/**
 * The app's icon set. One hand-drawn 24px stroke style everywhere, replacing
 * the old grab-bag of unicode glyphs (⌕ ▤ ✎ ❋ …) that rendered with a
 * different personality on every platform font. Stroke rides currentColor,
 * so the tailwind text classes keep driving the color like they always did.
 */

export type IconName =
  | 'search'
  | 'sources'
  | 'notes'
  | 'map'
  | 'split'
  | 'downloads'
  | 'vault'
  | 'clock'
  | 'music'
  | 'plus'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'glasses'
  | 'arrow-up'
  | 'pause'
  | 'play'
  | 'ram'
  | 'sleep'
  | 'check'

const PATHS: Record<IconName, React.JSX.Element> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8 20.5 20.5" />
    </>
  ),
  sources: (
    <>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 13.5 9 5 9-5" />
    </>
  ),
  notes: <path d="M17 3.5a2.6 2.6 0 0 1 3.7 3.7L7.8 20.1 2.5 21.5l1.4-5.3Z" />,
  map: (
    <>
      <circle cx="5.5" cy="6" r="2.3" />
      <circle cx="18.5" cy="6" r="2.3" />
      <circle cx="12" cy="18" r="2.3" />
      <path d="M7.8 6h8.4M6.7 8.1 10.8 16M17.3 8.1 13.2 16" />
    </>
  ),
  split: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M12 4.5v15" />
    </>
  ),
  downloads: (
    <>
      <path d="M12 3.5V15M7 10.5l5 5 5-5" />
      <path d="M4 20.5h16" />
    </>
  ),
  vault: (
    <>
      <circle cx="8" cy="16" r="4.5" />
      <path d="m11.5 12.5 9-9M17 7l3.5 3.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </>
  ),
  music: (
    <>
      <path d="M9.5 18V6l10-2.5V15" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="15" r="2.5" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  'chevron-up': <path d="m6 14.5 6-6 6 6" />,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  glasses: (
    <>
      <path d="M2 9.5h20" />
      <path d="M4 9.5a3.5 3.5 0 1 0 7 0M13 9.5a3.5 3.5 0 1 0 7 0" fill="currentColor" />
    </>
  ),
  'arrow-up': <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />,
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  play: <path d="M8.5 5.5 18 12l-9.5 6.5Z" fill="currentColor" />,
  ram: (
    <>
      <rect x="4.5" y="7" width="15" height="10" rx="1.5" />
      <path d="M8 7V4M12 7V4M16 7V4M8 20v-3M12 20v-3M16 20v-3" />
    </>
  ),
  sleep: <path d="M20.5 14A8.5 8.5 0 1 1 10 3.5 6.8 6.8 0 0 0 20.5 14Z" />,
  check: <path d="m4.5 12.5 5.5 5.5L19.5 7" />
}

export function Icon(props: {
  name: IconName
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg
      width={props.size ?? 15}
      height={props.size ?? 15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      {PATHS[props.name]}
    </svg>
  )
}
