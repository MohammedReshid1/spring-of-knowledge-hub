
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { ErrorProvider } from "./contexts/ErrorContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RoleAccessProvider } from "./contexts/RoleAccessContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
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
import { MessagingPage } from "./pages/MessagingPage";
import { InventoryManagement } from "./components/inventory/InventoryManagement";
import { ParentPortal } from "./components/parent-portal/ParentPortal";
import { SystemAdministration } from "./components/settings/SystemAdministration";
import { AccountSecurity } from "./components/settings/AccountSecurity";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import TimetablePage from "./pages/TimetablePage";
import PaymentsPage from "./pages/PaymentsPage";
import { SubjectManagement } from "./components/subjects/SubjectManagement";
// Removed pages: Settings, Branches, System Configuration
import NotFound from "./pages/NotFound";
import ForbiddenPage from "./pages/ForbiddenPage";

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
      <WebSocketProvider>
        <RoleAccessProvider>
          <ErrorProvider>
            <BranchProvider>
              <SidebarProvider>
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
                              <RoleBasedRoute permission="student.read">
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
                              <RoleBasedRoute permission="class.read">
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
                              <RoleBasedRoute permission="teacher.read">
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
                              <RoleBasedRoute permission="class.read">
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
                              <RoleBasedRoute permission="class.read">
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
                              <RoleBasedRoute permission="discipline.read">
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
                              <RoleBasedRoute permission="attendance.read">
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
                              <RoleBasedRoute permission="announcement.view">
                                <DashboardLayout>
                                  <NotificationsManagement />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/messaging"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute permission="communication.read">
                                <DashboardLayout>
                                  <MessagingPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/inventory"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute permission="inventory.read">
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
                              <RoleBasedRoute permission="student.read">
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
                              <RoleBasedRoute permission="class.read">
                                <DashboardLayout>
                                  <GradeLevelsPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/subjects"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute permission="subject.read">
                                <DashboardLayout>
                                  <SubjectManagement />
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
                          path="/account-security"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <AccountSecurity />
                              </DashboardLayout>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/timetable"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <TimetablePage />
                              </DashboardLayout>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/payments"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute permission="payment.read">
                                <DashboardLayout>
                                  <PaymentsPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/system-configuration" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/403" element={<ForbiddenPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </BrowserRouter>
                  </TooltipProvider>
                </NotificationProvider>
              </SidebarProvider>
            </BranchProvider>
          </ErrorProvider>
        </RoleAccessProvider>
      </WebSocketProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
