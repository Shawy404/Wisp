# Reddit post — Wisp

Suggested subreddits: r/SideProject, r/coolgithubprojects, r/Zettelkasten, r/ObsidianMD (as a "browser that plays nice with your vault"), r/selfhosted-adjacent, r/electronjs.

---

## Title options

- I got tired of researching across 40 tabs, a notes app and a citation manager — so I built a browser that keeps them together
- Wisp: a research browser where each topic is a "room" with its own tabs, notes and concept map (local-first, open on GitHub)
- Made a browser for research — rooms, multi-source search, notes, and a concept map, all as plain files on your disk

---

## Body

I do a lot of reading-heavy research, and my workflow was always a mess: a pile of tabs I was afraid to close, a separate notes app that had no idea what those tabs were, and a citation tool that talked to neither. So I spent the last while building the thing I actually wanted.

It's called **Wisp**. The idea is simple: every topic you work on is a **room**. Each room has its own tabs, its own saved sources, its own notes, and its own concept map — and they all swap in and out together as you move between rooms. Close a room and come back a week later and it's exactly how you left it.

A few things it does that I lean on:

- **One search bar hits several sources at once** — Semantic Scholar, Crossref, arXiv, Wikipedia, an image source and the web — and you save the results you like straight into the room. No copy-pasting citations.
- **Notes are just markdown** (works with an Obsidian vault), with `[[wikilinks]]`, images, and the ability to embed a source into a note.
- **The concept map is the same data as a graph** — sources, notes and concepts as nodes. It has templates so you're not staring at a blank canvas, version history, and it auto-links two things when one note mentions the other by name.
- **Clip anything** — a page, a selection (reopening it jumps back to the spot on the page, highlighted), an image, or a chunk of a YouTube video.
- It's still a real browser underneath: find-in-page, ad blocking, reader mode, a download manager, an encrypted password vault, keyboard shortcuts.

Everything is **local-first** — it's all plain files under `~/Wisp/`, nothing leaves your machine unless you explicitly use the optional AI feature.

It's early (pre-alpha, expect rough edges), Linux and Windows, free to download and try, with the source up on GitHub. I'd genuinely love feedback on whether the "rooms" idea clicks for anyone else, or if I've just built a browser only I will ever use.

**GitHub + downloads:** https://github.com/Shawy404/Wisp

*(screenshots of the map, the sources list and the notes view attached)*

---

## Notes for posting
- Attach `docs/media/map.png`, `docs/media/sources.png`, `docs/media/notes.png`.
- Reply to comments quickly in the first hour — it matters a lot for reach.
- Don't oversell; the "expect rough edges" honesty tends to land better than hype.
- If someone asks "why not just Obsidian + browser", the answer is: Wisp is the browser, and the tabs themselves are part of the room — that's the part a plugin can't do.
