// Wisp. © Shawy404, MIT.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installTooltips } from './tooltip'
import { installShortcuts } from './shortcuts'
import './styles.css'

installTooltips()
installShortcuts()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// React's own full-window splash has taken over — drop the static index.html
// one on the next frame so it doesn't linger underneath.
requestAnimationFrame(() => document.getElementById('boot-splash')?.remove())
