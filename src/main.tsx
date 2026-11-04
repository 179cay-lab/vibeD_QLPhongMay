import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MonitorProvider } from './monitor'
import { StoreProvider } from './store'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <MonitorProvider>
        <App />
      </MonitorProvider>
    </StoreProvider>
  </React.StrictMode>,
)
