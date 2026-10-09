import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MiniTimer } from '@renderer/components/MiniTimer'
import { App } from './App'
import './assets/main.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root is missing.')
}

const mini = new URLSearchParams(window.location.search).get('view') === 'mini'

createRoot(root).render(
  <StrictMode>{mini ? <MiniTimer /> : <App />}</StrictMode>
)
