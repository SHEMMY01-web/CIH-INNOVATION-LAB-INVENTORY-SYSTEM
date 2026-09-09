import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import AlertPopup from './components/AlertPopup';
import OfflineIndicator from './components/OfflineIndicator';
import ScrollToTopButton from './components/ScrollToTopButton';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages for code splitting (reduces initial bundle ~60%)
const Home = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Items = lazy(() => import('./pages/Items'));
const Tools = lazy(() => import('./pages/Tools'));
const Assets = lazy(() => import('./pages/Assets'));
const Requests = lazy(() => import('./pages/Requests'));
const GrnReport = lazy(() => import('./pages/GrnReport'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'));
const LoginSuccessful = lazy(() => import('./pages/LoginSuccessful'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Branded page loading spinner
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '16px',
      background: 'var(--bg-color, #ffffff)'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#1c21df',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AlertProvider>
        <AuthProvider>
          <AlertPopup />
          <OfflineIndicator />
          <ScrollToTopButton />
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot_password" element={<ForgotPassword />} />
                <Route path="/update_password" element={<UpdatePassword />} />
                <Route path="/login_successful" element={<LoginSuccessful />} />
                
                {/* Centralized Protected Staff/Admin Routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/items" element={<ProtectedRoute><Items /></ProtectedRoute>} />
                <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
                <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                <Route path="/project_detail" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
                <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
                <Route path="/grn-report" element={<ProtectedRoute><GrnReport /></ProtectedRoute>} />
                <Route path="/grn_report" element={<Navigate to="/grn-report" replace />} />
                
                {/* 404 Catch-All */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </AlertProvider>
    </Router>
  );
}

export default App;
