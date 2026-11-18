import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { unlockAudio } from './components/scream'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')

// Turn sound on with the first tap anywhere (iPad Safari needs one), so a screen left on the court can scream later.
window.addEventListener('pointerdown', unlockAudio, { once: true })
