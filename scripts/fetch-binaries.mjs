// Wisp — © Shawy404. All rights reserved.
// Downloads the helper binaries that ship inside packaged builds (yt-dlp for
// video clipping), so users don't have to install anything themselves.
// Runs before electron-builder; skips files that are already present.
import { createWriteStream, existsSync, mkdirSync, chmodSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  {
    // The standalone build — the plain "yt-dlp" artifact needs a system Python.
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
    dest: join(root, 'build/bin/linux/yt-dlp'),
    executable: true
  },
  {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    dest: join(root, 'build/bin/win/yt-dlp.exe'),
    executable: false
  }
]

for (const target of TARGETS) {
  if (existsSync(target.dest)) {
    console.log(`fetch-binaries: keep ${target.dest}`)
    continue
  }
  console.log(`fetch-binaries: ${target.url}`)
  const res = await fetch(target.url, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    console.error(`fetch-binaries: FAILED ${res.status} ${target.url}`)
    process.exitCode = 1
    continue
  }
  mkdirSync(dirname(target.dest), { recursive: true })
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target.dest))
  if (target.executable) chmodSync(target.dest, 0o755)
  console.log(`fetch-binaries: saved ${target.dest}`)
}
