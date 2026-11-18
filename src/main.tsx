import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerApp from './customer/CustomerApp';
import KioskApp from './kiosk/KioskApp';
import AdminApp from './admin/AdminApp';
import SplashScreen from './components/SplashScreen';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/app/*" element={<CustomerApp />} />
        <Route path="/kiosk" element={<KioskApp />} />
        <Route path="/admin" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);