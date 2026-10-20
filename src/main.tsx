import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ItemsProvider } from './data/itemsStore.tsx'
import './style.css'

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ItemsProvider>
      <App />
    </ItemsProvider>
  </React.StrictMode>,
)
