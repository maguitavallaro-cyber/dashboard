import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Storage polyfill para fuera de Claude
if (!window.storage) {
  window.storage = {
    _store: {},
    get: async (key) => {
      const val = localStorage.getItem('budget_' + key)
      if (val === null) throw new Error('Key not found')
      return { key, value: val }
    },
    set: async (key, value) => {
      localStorage.setItem('budget_' + key, value)
      return { key, value }
    },
    delete: async (key) => {
      localStorage.removeItem('budget_' + key)
      return { key, deleted: true }
    },
    list: async (prefix) => {
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('budget_' + (prefix || '')))
        .map(k => k.replace('budget_', ''))
      return { keys }
    }
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
