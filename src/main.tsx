import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CustomerApp from './customer/CustomerApp';
import KioskApp from './kiosk/KioskApp';
import AdminApp from './admin/AdminApp';
import './index.css';

/* تسجيل Service Worker (PWA) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* /* حتى تطابق جميع مسارات منصة العميل (/login, /signup, /account …) */}
        <Route path="/*" element={<CustomerApp />} />
        <Route path="/kiosk" element={<KioskApp />} />
        <Route path="/admin" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
