<!-- Wisp — © Shawy404. All rights reserved. -->

# Wisp

Wisp is a desktop browser built around one idea: research shouldn't be
scattered across fifty tabs, a notes app, and a citation manager that never
sync with each other. In Wisp, each topic gets its own **room** — the tabs,
notes, sources, and concept map for that topic all live together, and switch
in and out as you move between rooms. Everything is stored locally on disk.

The name comes from *will-o'-the-wisp*, the ghost light said to lead
travelers through marshland — the Japanese folklore equivalent is
*kitsunebi* (狐火), "fox fire."

Built by Shawy404. © Shawy404, all rights reserved.

## What it does

**Rooms.** Each research topic is a room with its own tabs, notes, sources,
and map. Switch rooms and your tabs swap out; close and reopen a room and
everything comes back where you left it. Rooms live in their own folder on
disk.

**Search.** One search bar queries Semantic Scholar, Crossref, arXiv,
Wikipedia (Turkish and English), Openverse, and DuckDuckGo in parallel, and
sorts the query as academic or general automatically. Academic, wiki, and
image results get saved to the room's sources on their own — no manual
citation entry.

**Adblock.** EasyList and EasyPrivacy, with a settings toggle and per-site
exceptions.

**Reader mode.** Readability-based clean reading view, one click to save
into the room.

**Clipping.** Right-click to save a full page, selected text, or an image
into `clips/`, tied back into sources.

**Notes.** CodeMirror 6 markdown editor writing to `notes/*.md`
(Obsidian-compatible), with `[[wikilink]]` navigation (ctrl-click to open or
create) and `![[src-id]]` embeds for pulling a source straight into a note.

**Concept map.** One graph, three views. Edges come from wikilinks (shown as
a green arrow), tag-based suggestions (dashed, free, deterministic), manual
links (shift-click two nodes), or an AI suggestion pass ("find connections"
— a single on-demand Claude call, API key set in settings).

**Research tools.** Copy BibTeX/APA/MLA straight from a source card, split
view for reading a source next to your notes, and a command palette
(ctrl-K, `?query` for a quick search).

**The rest.** Dark/light theme with a custom accent color, a web-dev mode
(DevTools plus a JSON viewer for search responses), a focus timer, and
profile labels.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+T | New tab |
| Ctrl+W | Close tab |
| Ctrl+L | Address bar |
| Ctrl+K | Command palette |
| Shift-click (two nodes on the map) | Manual link |
| Alt-click (a link on the map) | Delete manual/AI link |
| Ctrl-click (a wikilink in a note) | Open or create the target note |

## Running it

```bash
cd wisp
npm install          # dependencies + Electron binary
npm run dev           # dev mode with hot reload
npm run build         # production bundle (out/)
npm run typecheck     # TS type checking
npm run build:linux   # produce an AppImage (dist/)
```

> The Electron binary is pulled from GitHub releases during install. On a
> restricted network, point `ELECTRON_MIRROR` at a mirror.

## Architecture

Electron + React + TypeScript + Tailwind v4, wired up with electron-vite.
Cytoscape.js drives the concept map, CodeMirror 6 the notes, and
`@mozilla/readability` the reader mode; `@ghostery/adblocker-electron`
handles blocking and `@anthropic-ai/sdk` powers the optional AI link
suggestions.

The main process owns windows and tabs (via `WebContentsView`), the
adblocker, search aggregation (`net.fetch`), the filesystem, and IPC. The
renderer is UI only — `contextIsolation: true`, `nodeIntegration: false`,
everything crosses through a preload bridge.

On Wayland/Hyprland, Wisp runs frameless with its own in-app window
controls (`ozone-platform-hint=auto`).

Everything is local-first: nothing goes to the cloud except the optional AI
link suggestions, and even those only send node titles/tags, only when you
ask for them. All data lives under `~/Wisp/` (override with `WISP_HOME` to
relocate it):

```
~/Wisp/
  config.json                 # global settings (theme, adblock, API key, profile)
  rooms/
    <room>/
      room.json               # room metadata + open tabs + active tab
      notes/*.md               # notes (Obsidian-compatible markdown)
      sources.json             # collected sources + metadata
      map.json                 # concept nodes + persisted links
      clips/                   # clipped images / cleaned pages (.md)
```

One graph feeds three surfaces: the source card in the sidebar, a
`[[wikilink]]`/`![[src-id]]` in a note, and a node on the map are the same
underlying object. `shared/graph.ts` derives the graph from each room's
data, so editing one view updates the others.

## Known limitations

- No real Chrome extension API.
- Not aiming for full multi-process sandbox security — relies on Electron's
  defaults plus contextIsolation; tab content is sandboxed.
- No cloud sync, no mobile.
- Web-dev mode is a global toggle for now (a per-room setting is reserved in
  `room.json` but unused).
- Multiple profiles are just a label right now; use separate `WISP_HOME`
  paths if you need actually separate data directories.
- The DuckDuckGo "Web" results are scraped HTML — if DDG changes their
  markup, that tab can come back empty (other sources aren't affected).

## Up next

- Double-click a map node to jump to the linked note/source.
- Note preview (marked is already wired in, just needs a read-only render).
- Per-room dev mode and per-room focus stats.
- Persist `search:last` results to disk for cross-session search history.
