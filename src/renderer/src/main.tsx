// Wisp — © Shawy404. All rights reserved.
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

// The React boot splash has taken over — drop the static one from index.html
// on the next frame so it doesn't linger underneath.
requestAnimationFrame(() => document.getElementById('boot-splash')?.remove())
