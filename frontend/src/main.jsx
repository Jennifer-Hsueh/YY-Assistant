import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme, getStoredTheme } from './lib/theme'
import { initSentry, Sentry } from './lib/sentry'

initSentry()
// 網頁開著時收到推播也要跳出通知
if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
  import('./lib/firebase').then((m) => m.initForegroundPush()).catch(() => {})
}

applyTheme(getStoredTheme())

// 畫面出錯(React)也送到 Sentry
createRoot(document.getElementById('root'), {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
