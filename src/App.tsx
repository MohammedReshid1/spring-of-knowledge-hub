
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { AuthForm } from "./components/auth/AuthForm";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { Overview } from "./components/dashboard/Overview";
import StudentsPage from "./pages/StudentsPage";
import ClassesPage from "./pages/ClassesPage";
import PaymentsPage from "./pages/PaymentsPage";
import IDCardsPage from "./pages/IDCardsPage";
import { TeacherManagement } from "./components/teachers/TeacherManagement";
import { PaymentDashboard } from "./components/payments/PaymentDashboard";
import { AccountSettings } from "./components/settings/AccountSettings";
import { BranchManagement } from "./components/branches/BranchManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BranchProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/auth"
              element={
                <PublicRoute>
                  <AuthForm />
                </PublicRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Overview />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StudentsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ClassesPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teachers"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <TeacherManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PaymentsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PaymentDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student-id-cards"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <IDCardsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AccountSettings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BranchManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </BranchProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
