import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'

import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker for offline-first caching
serviceWorkerRegistration.register();

