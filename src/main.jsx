import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AccountProvider } from './lib/accounts.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccountProvider><App /></AccountProvider>
  </StrictMode>,
)
