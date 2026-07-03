# Reddit post — Wisp

I can't post to Reddit for you (no account access from here), so this is ready to copy and paste. Attach the images listed at the bottom.

Suggested subreddits: r/SideProject, r/coolgithubprojects, r/Zettelkasten, r/ObsidianMD, r/electronjs.

---

## Title options

1. I got tired of doing research across 40 tabs, a notes app, and a citation manager, so I built a browser that keeps them together
2. Wisp: a research browser where every topic is a "room" with its own tabs, notes, and concept map
3. I made a local-first browser for research and I'd love to know if the idea makes sense to anyone but me

---

## Body

I do a lot of reading-heavy research and my setup was always a mess. A pile of tabs I was too scared to close, a notes app that had no idea what any of those tabs were, and a citation tool that didn't talk to either. So I spent the last while building the thing I actually wanted to use.

It's called Wisp. The idea is pretty simple. Every topic you work on becomes a "room". Each room keeps its own tabs, its own saved sources, its own notes, and its own concept map. When you switch rooms, your whole workspace switches with you. Close a room, come back a week later, and everything is exactly where you left it.

A few things I lean on every day:

One search bar hits several places at once. Semantic Scholar, Crossref, arXiv, Wikipedia, an image source, and the web, all together. It sorts the results into Academic, Overview, Images, and Web, and you save the ones you want straight into the room. No more copying citations by hand.

Notes are just markdown files, so they work with an Obsidian vault too. You get wikilinks, inline images, and you can drop a source right into a note.

The concept map is the same data seen as a graph. Sources, notes, and concepts are all nodes. It comes with templates so you're not staring at an empty canvas, it has version history, and it quietly links two things when one note mentions the other by name.

You can clip almost anything. A whole page, a selection that jumps you back to the exact spot when you reopen it, an image, or a chunk of a YouTube video.

And it's still a normal browser underneath. Find in page, ad blocking, reader mode, a download manager, an encrypted password vault, keyboard shortcuts.

The important part for me is that it's all local. Everything lives as plain files in a folder on your machine. Nothing leaves unless you use the optional AI suggestion, and even then it only sends node titles.

It's early and rough, honestly. Pre-alpha, Linux and Windows, free to download and try, source is on GitHub. What I really want to know is whether the rooms idea clicks for anyone else, or whether I've just built a browser that only I will ever use.

Repo and downloads: https://github.com/Shawy404/Wisp

---

## Images to attach
- `docs/media/map.png` (a filled-in concept map)
- `docs/media/search.png` (the multi-source search)
- `docs/media/sources.png` (collected sources)
- `docs/media/map-template.png` (a project-plan map from a template)

## Tips
- Reply to comments fast in the first hour, it matters a lot for reach.
- The honest "it's rough" tone tends to land better than a polished pitch.
- If someone asks why not just Obsidian plus a browser: the browser is the point here, the tabs themselves are part of the room, which a plugin can't do.
