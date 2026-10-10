import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DEMO } from './lib/api';
import DemoBar from './demo/DemoBar';
import './styles.css';
import { I18nProvider } from './i18n';
import { AuthProvider } from './lib/auth';
import { AdminShell, ParentShell, PublicShell } from './components/Shells';
import Portal from './pages/Portal';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/parent/Dashboard';
import OpenFund from './pages/parent/OpenFund';
import ChildPage from './pages/parent/ChildPage';
import KidPortal from './pages/kid/KidPortal';
import { AdminApplications, AdminOutbox, AdminOverview, AdminPayments, AdminUsers } from './pages/admin/Admin';
import { AdminAnalytics } from './pages/admin/Analytics';
import { AdminPartners } from './pages/admin/Partners';
import Expecting from './pages/Expecting';
import { EmployerHome, EmployerSettings, EmployerShell, WorkReport } from './pages/employer/Employer';
import GiftPage from './pages/GiftPage';
import PayPage from './pages/PayPage';
import PledgePage from './pages/PledgePage';
import Thanks from './pages/Thanks';

// The demo build runs inside a sandboxed frame, so routing stays in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <Router>
          {DEMO && <DemoBar />}
          <Routes>
            <Route path="/kid" element={<KidPortal />} />
            <Route path="/parent" element={<ParentShell />}>
              <Route index element={<Dashboard />} />
              <Route path="new" element={<OpenFund />} />
              <Route path="child/:id" element={<ChildPage />} />
            </Route>
            <Route path="/employer" element={<EmployerShell />}>
              <Route index element={<EmployerHome />} />
              <Route path="settings" element={<EmployerSettings />} />
            </Route>
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<AdminOverview />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="partners" element={<AdminPartners />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="outbox" element={<AdminOutbox />} />
            </Route>
            <Route element={<PublicShell />}>
              <Route path="/" element={<Portal />} />
              <Route path="/login/kid" element={<Login portal="kid" />} />
              <Route path="/login/parent" element={<Login portal="parent" />} />
              <Route path="/login/employer" element={<Login portal="employer" />} />
              <Route path="/login/admin" element={<Login portal="admin" />} />
              <Route path="/login" element={<Navigate to="/login/parent" replace />} />
              <Route path="/register" element={<Register />} />
              <Route path="/expecting" element={<Expecting />} />
              <Route path="/g/:code" element={<GiftPage />} />
              <Route path="/g/:code/thanks/:cid" element={<Thanks />} />
              <Route path="/pay/:id" element={<PayPage />} />
              <Route path="/pledge/:token" element={<PledgePage />} />
              <Route path="/work/:slug" element={<WorkReport />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);

// The published demo (VITE_PAGES) is installable too; the single-file demo stays without a worker.
if ('serviceWorker' in navigator && import.meta.env.PROD && (!DEMO || import.meta.env.VITE_PAGES)) {
  window.addEventListener('load', () => navigator.serviceWorker.register(DEMO ? 'sw.js' : '/sw.js').catch(() => {}));
}
