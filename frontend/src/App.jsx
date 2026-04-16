import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DocumentEditorPage from './pages/DocumentEditorPage'
import VersionHistoryPage from './pages/VersionHistoryPage'
import VersionViewPage from './pages/VersionViewPage'

// Components
import ProtectedRoute from './components/common/ProtectedRoute'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/editor/:docId" element={
            <ProtectedRoute>
              <DocumentEditorPage />
            </ProtectedRoute>
          } />
          
          <Route path="/history/:docId" element={
            <ProtectedRoute>
              <VersionHistoryPage />
            </ProtectedRoute>
          } />

          <Route path="/history/:docId/view/:versionId" element={
            <ProtectedRoute>
              <VersionViewPage />
            </ProtectedRoute>
          } />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
