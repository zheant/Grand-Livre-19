import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/variables.css'
import './theme/base.css'
import './theme/extra.css'
import App from './App.tsx'
import { applyTheme, getStoredTheme } from './lib/theme'

applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
