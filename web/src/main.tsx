import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { I18nProvider } from './i18n';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ChildPage from './pages/child/ChildPage';
import KidMode from './pages/KidMode';
import GiftPage from './pages/GiftPage';
import PayPage from './pages/PayPage';
import Thanks from './pages/Thanks';
import Admin from './pages/Admin';

function Private({ children, admin }: { children: JSX.Element; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/app" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/kid/:id" element={<Private><KidMode /></Private>} />
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/app" element={<Private><Dashboard /></Private>} />
              <Route path="/app/onboarding" element={<Private><Onboarding /></Private>} />
              <Route path="/app/child/:id" element={<Private><ChildPage /></Private>} />
              <Route path="/admin" element={<Private admin><Admin /></Private>} />
              <Route path="/g/:code" element={<GiftPage />} />
              <Route path="/g/:code/thanks/:cid" element={<Thanks />} />
              <Route path="/pay/:id" element={<PayPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
