// Wisp — © Shawy404. All rights reserved.
export interface WispBridge {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    wisp: WispBridge
  }
}

export {}
