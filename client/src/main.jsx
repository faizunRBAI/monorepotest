import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import App from './App.jsx'
import { initGtm } from './utils/analytics.js'
import './styles/vendor.css' // Bootstrap/Vendor
import './styles/main.css'   // Our Custom Light Theme

// Before render, so the container is loading while React mounts and no early
// dataLayer push is missed.
initGtm()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
