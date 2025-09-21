
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { ErrorProvider } from "./contexts/ErrorContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { useErrorHandler } from "./hooks/useErrorHandler";
import { RoleBasedRoute } from "./components/rbac/RoleBasedRoute";
import { AuthForm } from "./components/auth/AuthForm";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { Overview } from "./components/dashboard/Overview";
import StudentsPage from "./pages/StudentsPage";
import ClassesPage from "./pages/ClassesPage";
import IDCardsPage from "./pages/IDCardsPage";
import ExamsPage from "./pages/ExamsPage";
import CalendarPage from "./pages/CalendarPage";
import GradeLevelsPage from "./pages/GradeLevelsPage";
import { TeacherManagement } from "./components/teachers/TeacherManagement";
import { DisciplinaryManagement } from "./components/discipline/DisciplinaryManagement";
import AttendancePage from "./pages/AttendancePage";
import { NotificationsManagement } from "./components/notifications/NotificationsManagement";
import { InventoryManagement } from "./components/inventory/InventoryManagement";
import { ParentPortal } from "./components/parent-portal/ParentPortal";
import { SystemAdministration } from "./components/settings/SystemAdministration";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import TimetablePage from "./pages/TimetablePage";
import PaymentsPage from "./pages/PaymentsPage";
// Removed pages: Settings, Branches, System Configuration
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

function ErrorInitializer() {
  useErrorHandler();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ErrorProvider>
        <BranchProvider>
          <NotificationProvider>
            <ErrorInitializer />
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
                      <RoleBasedRoute permission="read_student">
                        <DashboardLayout>
                          <StudentsPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/classes"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_class">
                        <DashboardLayout>
                          <ClassesPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teachers"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_teacher">
                        <DashboardLayout>
                          <TeacherManagement />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher-dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute role="teacher">
                        <DashboardLayout>
                          <TeacherDashboardPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
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
                <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                <Route path="/branches" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/exams"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_class">
                        <DashboardLayout>
                          <ExamsPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_class">
                        <DashboardLayout>
                          <CalendarPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/discipline"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_behavior_record">
                        <DashboardLayout>
                          <DisciplinaryManagement />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_attendance">
                        <DashboardLayout>
                          <AttendancePage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_messages">
                        <DashboardLayout>
                          <NotificationsManagement />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_inventory">
                        <DashboardLayout>
                          <InventoryManagement />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/parent-portal"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_student">
                        <DashboardLayout>
                          <ParentPortal />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/grade-levels"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_class">
                        <DashboardLayout>
                          <GradeLevelsPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute requireAdmin={true}>
                        <DashboardLayout>
                          <SystemAdministration />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/timetable"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_class">
                        <DashboardLayout>
                          <TimetablePage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRoute permission="read_student">
                        <DashboardLayout>
                          <PaymentsPage />
                        </DashboardLayout>
                      </RoleBasedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="/system-configuration" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </BranchProvider>
    </ErrorProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
