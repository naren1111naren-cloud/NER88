import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { AlertStreamProvider } from './context/AlertStreamContext';
import { ToastProvider } from './context/ToastContext';
import { DemoProvider } from './context/DemoContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DemoScenarioModal } from './components/DemoScenarioModal';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Welcome } from './pages/Welcome';
import { Dashboard } from './pages/Dashboard';
import { MapPage } from './pages/MapPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { RoutesPage } from './pages/RoutesPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { FieldReportPage } from './pages/FieldReportPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { HelpPage } from './pages/HelpPage';
import { GovernmentIntegrationsPage } from './pages/GovernmentIntegrationsPage';

// Protected layout — wraps authenticated dashboard pages with Navbar + Sidebar
const ProtectedLayout = ({ children, allowedRoles }) => {
  const { user, token } = useAuth();

  // Require BOTH token AND user — either missing means unauthenticated
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role || 'Viewer')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7FB] text-[#1F2937]">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <DemoScenarioModal />
    </div>
  );
};

// Root redirect — unauthenticated → /login, authenticated → /welcome
const RootRedirect = () => {
  const { user, token } = useAuth();
  // Require BOTH token AND user
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to="/welcome" replace />;
};

// Login guard — redirect already-authenticated users to /welcome
const LoginGuard = ({ children }) => {
  const { user, token } = useAuth();
  if (token && user) return <Navigate to="/welcome" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DemoProvider>
          <OfflineSyncProvider>
            <AlertStreamProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public routes — LoginGuard prevents re-visiting login when authenticated */}
                  <Route path="/login" element={<LoginGuard><Login /></LoginGuard>} />
                  <Route path="/register" element={<Register />} />

                  {/* Root — smart redirect */}
                  <Route path="/" element={<RootRedirect />} />

                  {/* Welcome page — own layout, auth guard inside component AND here */}
                  <Route path="/welcome" element={<Welcome />} />

                  {/* Protected dashboard routes */}
                  <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
                  <Route path="/map" element={<ProtectedLayout><MapPage /></ProtectedLayout>} />
                  <Route path="/deliveries" element={<ProtectedLayout><DeliveriesPage /></ProtectedLayout>} />
                  <Route path="/vehicles" element={<ProtectedLayout><VehiclesPage /></ProtectedLayout>} />
                  <Route path="/routes" element={<ProtectedLayout><RoutesPage /></ProtectedLayout>} />
                  <Route path="/incidents" element={<ProtectedLayout><IncidentsPage /></ProtectedLayout>} />
                  <Route path="/alerts" element={<ProtectedLayout><AlertsPage /></ProtectedLayout>} />
                  <Route path="/government-integrations" element={<ProtectedLayout><GovernmentIntegrationsPage /></ProtectedLayout>} />
                  <Route path="/analytics" element={<ProtectedLayout><AnalyticsPage /></ProtectedLayout>} />
                  <Route path="/field-report" element={<ProtectedLayout allowedRoles={['Admin', 'Field Officer']}><FieldReportPage /></ProtectedLayout>} />
                  <Route path="/settings" element={<ProtectedLayout allowedRoles={['Admin']}><SettingsPage /></ProtectedLayout>} />
                  <Route path="/audit-logs" element={<ProtectedLayout allowedRoles={['Admin']}><AuditLogsPage /></ProtectedLayout>} />
                  <Route path="/user-management" element={<ProtectedLayout allowedRoles={['Admin']}><UserManagementPage /></ProtectedLayout>} />
                  <Route path="/help" element={<ProtectedLayout><HelpPage /></ProtectedLayout>} />

                  {/* Catch-all — unknown routes go to login for safety */}
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </BrowserRouter>
            </AlertStreamProvider>
          </OfflineSyncProvider>
        </DemoProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
