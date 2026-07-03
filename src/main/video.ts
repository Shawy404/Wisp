// Wisp — © Shawy404. All rights reserved.
import * as fs from 'fs'
import { spawn, execFile } from 'child_process'
import { basename, join } from 'path'
import { app, ipcMain } from 'electron'
import type { SourceItem } from '@shared/types'
import { stableId } from '@shared/tags'
import { translate } from '@shared/i18n'
import * as store from './storage'
import { addSources } from './search-ipc'
import { trackExternal, externalCancel, cancelExternalMark } from './downloads'
import type { WispContext } from './ipc'

/**
 * Video clipping via yt-dlp (must be installed on the system). The whole
 * video — or just a start–end range — is saved into the room's clips dir and
 * becomes a `video` source. Progress shows in the downloads panel.
 */

/** Packaged builds ship yt-dlp under resources/bin; dev falls back to PATH. */
function ytDlpPath(): string {
  if (app.isPackaged) {
    const bundled = join(
      process.resourcesPath,
      'bin',
      process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    )
    if (fs.existsSync(bundled)) return bundled
  }
  return 'yt-dlp'
}

function hasYtDlp(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(ytDlpPath(), ['--version'], (err) => resolve(!err))
  })
}

function videoMeta(url: string): Promise<{ id: string; title: string } | null> {
  return new Promise((resolve) => {
    execFile(
      ytDlpPath(),
      ['--no-playlist', '--print', '%(id)s\n%(title)s', '--skip-download', url],
      { timeout: 30_000 },
      (err, stdout) => {
        if (err) return resolve(null)
        const [id, ...title] = stdout.trim().split('\n')
        resolve(id ? { id, title: title.join(' ').trim() || id } : null)
      }
    )
  })
}

/** "1:23" / "01:02:03" / "83" — what yt-dlp's section syntax accepts. */
const TIME_RE = /^(\d{1,2}:)?\d{1,2}:\d{2}$|^\d+$/

export function registerVideo(ctx: WispContext): void {
  const t = (key: Parameters<typeof translate>[1]): string =>
    translate(ctx.config.language ?? 'tr', key)
  const toast = (text: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('toast', text)
  }
  const notify = (roomId: string): void => {
    if (!ctx.win.isDestroyed()) ctx.win.webContents.send('room:updated', roomId)
  }

  ipcMain.handle(
    'video:clip',
    async (_e, url: string, start?: string, end?: string): Promise<{ error?: string }> => {
      const roomId = ctx.tabs.currentRoomId()
      if (!roomId) return { error: t('main.video.noRoom') }
      if (!(await hasYtDlp())) return { error: t('main.video.needYtdlp') }
      if ((start && !TIME_RE.test(start)) || (end && !TIME_RE.test(end))) {
        return { error: t('main.video.badTime') }
      }

      const meta = await videoMeta(url)
      if (!meta) return { error: t('main.video.metaFailed') }

      const clipping = Boolean(start || end)
      const stem = `yt-${meta.id}${clipping ? `-${stableId(`${start}-${end}`)}` : ''}`
      const outTpl = join(store.clipsDir(roomId), `${stem}.%(ext)s`)
      const args = [
        '--no-playlist',
        '--newline',
        '-f',
        'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
        '--print',
        'after_move:filepath',
        '--no-simulate',
        '-o',
        outTpl
      ]
      if (clipping) {
        args.push('--download-sections', `*${start || '0'}-${end || 'inf'}`, '--force-keyframes-at-cuts')
      }
      args.push(url)

      const tracker = trackExternal(`${meta.title}${clipping ? ` (${start || '0'}–${end || '…'})` : ''}.mp4`, url)
      const proc = spawn(ytDlpPath(), args)
      externalCancel.set(tracker.id, () => {
        proc.kill('SIGTERM')
        cancelExternalMark(tracker.id)
      })
      toast(t('main.video.started'))

      let filePath = ''
      let stdoutTail = ''
      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stdoutTail = (stdoutTail + text).slice(-4096)
        // "[download]  42.1% of ~ 12.34MiB at ..." → panel progress.
        const m = text.match(/\[download\]\s+([\d.]+)% of ~?\s*([\d.]+)(K|M|G)iB/)
        if (m) {
          const mult = m[3] === 'K' ? 1024 : m[3] === 'M' ? 1024 ** 2 : 1024 ** 3
          const total = Math.round(parseFloat(m[2]) * mult)
          tracker.update(Math.round((parseFloat(m[1]) / 100) * total), total)
        }
        // The --print after_move:filepath line is the final file location.
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (trimmed.startsWith('/') && trimmed.includes(stem)) filePath = trimmed
        }
      })
      proc.stderr.on('data', () => {})

      proc.once('close', (code) => {
        externalCancel.delete(tracker.id)
        if (code !== 0 || !filePath) {
          tracker.fail()
          return
        }
        tracker.done(filePath)
        const source: SourceItem = {
          id: `src-${stableId(url + (clipping ? `${start}-${end}` : ''))}`,
          kind: 'video',
          title: clipping ? `${meta.title} (${start || '0'}–${end || '…'})` : meta.title,
          url,
          clipFile: basename(filePath),
          tags: [],
          addedAt: new Date().toISOString(),
          origin: 'clip'
        }
        addSources(roomId, [source])
        notify(roomId)
        toast(t('main.video.done'))
      })

      return {}
    }
  )
}
