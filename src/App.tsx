import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Index } from './pages/Index';
import { Overview } from './pages/Overview';
import { StudentList } from './pages/StudentList';
import { ClassManagement } from './pages/ClassManagement';
import { TeacherManagement } from './pages/TeacherManagement';
import { PaymentList } from './pages/PaymentList';
import { PaymentDashboard } from './pages/PaymentDashboard';
import { AccountSettings } from './pages/AccountSettings';
import { NotFound } from './pages/NotFound';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { QueryClient } from '@tanstack/react-query';
import { IDCardManager } from './components/students/IDCardManager';
import { StudentDetailsPage } from '@/pages/StudentDetailsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClient>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><StudentList /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute><StudentDetailsPage /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><ClassManagement /></ProtectedRoute>} />
            <Route path="/teachers" element={<ProtectedRoute><TeacherManagement /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentList /></ProtectedRoute>} />
            <Route path="/payment-dashboard" element={<ProtectedRoute><PaymentDashboard /></ProtectedRoute>} />
            <Route path="/student-id-cards" element={<ProtectedRoute><IDCardManager /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </QueryClient>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
