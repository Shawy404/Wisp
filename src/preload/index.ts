// Wisp — © Shawy404. All rights reserved.
import { contextBridge, ipcRenderer } from 'electron'

/**
 * The single, typed bridge between the sandboxed UI and the main process.
 * Grows with each phase; every call is a plain invoke/on pair.
 */
const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_e: Electron.IpcRendererEvent, ...args: unknown[]): void => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  }
}

contextBridge.exposeInMainWorld('wisp', api)

export type WispBridge = typeof api
