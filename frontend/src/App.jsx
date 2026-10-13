import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { AlertStreamProvider } from './context/AlertStreamContext';
import { ToastProvider } from './context/ToastContext';
import { DemoProvider } from './context/DemoContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { GovernmentFooter } from './components/GovernmentFooter';
import { MobileNavigation } from './components/MobileNavigation';
import { DemoScenarioModal } from './components/DemoScenarioModal';
import { Assistant88 } from './components/assistant/Assistant88';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { HowToUsePage } from './pages/HowToUsePage';
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
import { GovernmentIntegrationsPage } from './pages/GovernmentIntegrationsPage';
import { WeatherPage } from './pages/WeatherPage';
import { BridgesPage } from './pages/BridgesPage';
import { DistrictsPage } from './pages/DistrictsPage';
import { Welcome } from './pages/Welcome';

import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Protected layout — wraps authenticated dashboard pages with Government Navbar + Desktop Sidebar + Footer
 */
const ProtectedLayout = ({ children, allowedRoles }) => {
  const { user, token } = useAuth();

  // Require BOTH token AND user — either missing means unauthenticated
  if (!token || !user) {
    return <Navigate to="/welcome" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role || 'Viewer')) {
    return <Navigate to="/command-center" replace />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F7F8F6] text-ner-text w-full max-w-[100vw] font-sans">
      <Navbar />
      <div className="flex-1 overflow-y-auto w-full flex flex-col bg-[#F7F8F6]">
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
          <ErrorBoundary sectionName="Operational Workspace">
            {children}
          </ErrorBoundary>
        </main>
        <GovernmentFooter />
      </div>
      <MobileNavigation />
      <DemoScenarioModal />
      <Assistant88 />
    </div>
  );
};

// Root redirect — unauthenticated → /welcome, authenticated → /command-center
const RootRedirect = () => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/welcome" replace />;
  return <Navigate to="/command-center" replace />;
};

// Login guard — redirect already-authenticated users to /command-center
const LoginGuard = ({ children }) => {
  const { user, token } = useAuth();
  if (token && user) return <Navigate to="/command-center" replace />;
  return children;
};

export default function App() {
  return (
    <ErrorBoundary sectionName="Root Application Context">
      <AuthProvider>
        <ToastProvider>
          <DemoProvider>
            <OfflineSyncProvider>
              <AlertStreamProvider>
                <ErrorBoundary sectionName="Application Shell">
                  <BrowserRouter>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<LoginGuard><Login /></LoginGuard>} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />

                      {/* Root — smart redirect */}
                      <Route path="/" element={<RootRedirect />} />
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/overview" element={<Welcome />} />

                      {/* PRIMARY OPERATIONAL NAVIGATION (Section 8) */}
                      <Route path="/command-center" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
                      <Route path="/dashboard" element={<Navigate to="/command-center" replace />} />

                      <Route path="/network" element={<ProtectedLayout><MapPage /></ProtectedLayout>} />
                      <Route path="/map" element={<Navigate to="/network" replace />} />

                      <Route path="/vehicles" element={<ProtectedLayout><VehiclesPage /></ProtectedLayout>} />
                      <Route path="/deliveries" element={<ProtectedLayout><DeliveriesPage /></ProtectedLayout>} />

                      <Route path="/incidents" element={<ProtectedLayout><IncidentsPage /></ProtectedLayout>} />
                      <Route path="/alerts" element={<ProtectedLayout><AlertsPage /></ProtectedLayout>} />

                      <Route path="/routes" element={<ProtectedLayout><RoutesPage /></ProtectedLayout>} />
                      <Route path="/corridors" element={<Navigate to="/routes" replace />} />

                      <Route path="/field-report" element={<ProtectedLayout allowedRoles={['Admin', 'Dispatcher', 'Field Officer']}><FieldReportPage /></ProtectedLayout>} />
                      <Route path="/analytics" element={<ProtectedLayout><AnalyticsPage /></ProtectedLayout>} />

                      {/* Supporting Operational Routes */}
                      <Route path="/weather" element={<ProtectedLayout><WeatherPage /></ProtectedLayout>} />
                      <Route path="/bridges" element={<ProtectedLayout><BridgesPage /></ProtectedLayout>} />
                      <Route path="/districts" element={<ProtectedLayout><DistrictsPage /></ProtectedLayout>} />
                      <Route path="/how-to-use" element={<ProtectedLayout><HowToUsePage /></ProtectedLayout>} />
                      <Route path="/help" element={<Navigate to="/how-to-use" replace />} />

                      {/* Administration Routes */}
                      <Route path="/settings" element={<ProtectedLayout allowedRoles={['Admin']}><SettingsPage /></ProtectedLayout>} />
                      <Route path="/government-integrations" element={<ProtectedLayout><GovernmentIntegrationsPage /></ProtectedLayout>} />
                      <Route path="/data-sources" element={<Navigate to="/government-integrations" replace />} />
                      <Route path="/audit-logs" element={<ProtectedLayout allowedRoles={['Admin']}><AuditLogsPage /></ProtectedLayout>} />
                      <Route path="/user-management" element={<ProtectedLayout allowedRoles={['Admin']}><UserManagementPage /></ProtectedLayout>} />

                      {/* Catch-all */}
                      <Route path="*" element={<Navigate to="/command-center" replace />} />
                    </Routes>
                  </BrowserRouter>
                </ErrorBoundary>
              </AlertStreamProvider>
            </OfflineSyncProvider>
          </DemoProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
