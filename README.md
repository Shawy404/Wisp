<!-- Wisp - © Shawy404. All rights reserved. -->

# Wisp

**v0.1.0-pre-alpha.** Early days, things will break, expect rough edges.

Wisp is a desktop browser for people who do research and are sick of it
living in fifty tabs, a separate notes app, and a citation manager that
never talks to any of it. Each topic gets its own room, and the tabs,
notes, sources and concept map for that topic all live together and
switch in and out as you move between rooms. Nothing leaves your disk
unless you ask it to.

The name is from *will-o'-the-wisp*, the ghost light that leads travelers
through marshland. The Japanese folklore version is *kitsunebi* (狐火),
"fox fire."

Built by Shawy404. © Shawy404, all rights reserved.

## What it does

**Rooms.** Each research topic is a room with its own tabs, notes, sources
and map. Switch rooms and your tabs swap out; close and reopen a room and
everything's right where you left it. Rooms get their own folder on disk.

**Search.** One search bar hits Semantic Scholar, Crossref, arXiv,
Wikipedia (Turkish and English), Openverse and DuckDuckGo at the same
time, and figures out on its own whether you're asking something academic
or general. Academic, wiki and image hits get saved into the room's
sources automatically, so you're not copy-pasting citations by hand.

**Adblock.** The full filter set — ads, trackers, annoyances and cookie
banners — with a toggle, per-site exceptions in settings, a blocked-request
counter in the address bar, and the compiled engine cached on disk so
launches (even offline ones) don't wait on a download.

**Privacy & security.** Web pages run in their own sandboxed, isolated
session — their cookies and storage never touch the app shell. Permission
prompts (camera, microphone, location, notifications) are denied outright,
only http/https ever loads in a tab, and anything else gets handed to the
OS only if it's a scheme worth trusting.

**Reader mode.** Strips a page down to just the article, Readability-style.
One click saves it to the room.

**Clipping.** Right-click a page, some selected text, or an image to save
it into `clips/` and tie it back to your sources.

**Notes.** CodeMirror 6 markdown, writing straight to `notes/*.md`
(works fine with Obsidian too), `[[wikilink]]` navigation (ctrl-click to
open or create the target), and `![[src-id]]` to embed a source right in
a note.

**Concept map.** One graph, three views of it. Edges come from wikilinks
(green arrow), tag-based suggestions (dashed, free, deterministic), manual
links (shift-click two nodes), or an on-demand AI pass that suggests
connections (needs your own API key, only runs when you ask for it).

**Research tools.** Copy BibTeX/APA/MLA off a source card, split view for
reading a source next to your notes, and a command palette (ctrl-K,
prefix with `?` to search).

**Everything else.** Six themes (Dark, Midnight, Forest, Plum, Light,
Sepia) with a custom accent color on top, a web-dev mode (DevTools plus a
JSON viewer for search responses), a focus timer, and profile labels.

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

### Linux

```bash
git clone https://github.com/Shawy404/Wisp.git
cd Wisp
npm install          # pulls deps + the Electron binary
npm run dev           # dev mode, hot reload
npm run build:linux   # AppImage, ends up in dist/
```

### Windows

```powershell
git clone https://github.com/Shawy404/Wisp.git
cd Wisp
npm install
npm run dev            # dev mode, hot reload
npm run build:win      # installer + portable exe, ends up in dist/
```

Same codebase, no native/platform-specific bits, so both just work off
`npm install`. If npm can't reach GitHub to grab the Electron binary,
point `ELECTRON_MIRROR` at a mirror before installing.

```bash
npm run typecheck   # TS type checking, no build needed
```

## Architecture

Electron + React + TypeScript + Tailwind v4, glued together with
electron-vite. Cytoscape.js runs the concept map, CodeMirror 6 the notes,
`@mozilla/readability` the reader mode. `@ghostery/adblocker-electron`
handles blocking, `@anthropic-ai/sdk` powers the optional AI link
suggestions.

The main process owns windows and tabs (via `WebContentsView`), the
adblocker, search aggregation (`net.fetch`), the filesystem and IPC. The
renderer is UI only: `contextIsolation: true`, `nodeIntegration: false`,
everything crosses through a preload bridge.

Everything's local-first. Nothing goes anywhere except the optional AI
link suggestions, and even that only sends node titles/tags, only when
you ask for it. All data lives under `~/Wisp/` (or `%USERPROFILE%\Wisp`
on Windows; override with `WISP_HOME` to move it):

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
`[[wikilink]]`/`![[src-id]]` in a note, and a node on the map are the
same underlying object. `shared/graph.ts` derives the graph from each
room's data, so editing one view updates the others.

## Known limitations

- No real Chrome extension API.
- Not aiming for full multi-process sandbox security, relies on Electron's
  defaults plus contextIsolation; tab content is sandboxed.
- No cloud sync, no mobile.
- Web-dev mode is a global toggle for now (a per-room setting is reserved
  in `room.json` but unused).
- Multiple profiles are just a label right now; use separate `WISP_HOME`
  paths if you actually need separate data directories.
- The DuckDuckGo "Web" results are scraped HTML, so if DDG changes their
  markup that tab can come back empty (other sources aren't affected).

## Up next

- Double-click a map node to jump to the linked note/source.
- Note preview (marked is already wired in, just needs a read-only render).
- Per-room dev mode and per-room focus stats.
- Persist `search:last` results to disk for cross-session search history.
