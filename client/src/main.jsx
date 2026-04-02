import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LocationProvider } from './contexts/LocationContext.jsx'
import LocationPromptModal from './components/LocationPromptModal.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LocationProvider>
        <LocationPromptModal />
        <App />
      </LocationProvider>
    </BrowserRouter>
  </StrictMode>,
)