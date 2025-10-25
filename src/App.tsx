
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
import { SystemAdministration } from "./components/settings/SystemAdministration";
import { AccountSecurity } from "./components/settings/AccountSecurity";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import TeacherGradingPage from "./pages/TeacherGradingPage";
import TeacherAttendancePage from "./pages/TeacherAttendancePage";
import TeacherClassManagementPage from "./pages/TeacherClassManagementPage";
import TeacherReportsPage from "./pages/TeacherReportsPage";
import TeacherAssignmentsPage from "./pages/TeacherAssignmentsPage";
import TeacherSchedulePage from "./pages/TeacherSchedulePage";
import TeacherCommunicationPage from "./pages/TeacherCommunicationPage";
import TeacherExamsPage from "./pages/TeacherExamsPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import ParentDashboardPage from "./pages/ParentDashboardPage";
import TimetablePage from "./pages/TimetablePage";
import TeacherTimetablePage from "./pages/TeacherTimetablePage";
import PaymentsPage from "./pages/PaymentsPage";
import { SubjectManagement } from "./components/subjects/SubjectManagement";
import PaymentTestPage from "./pages/PaymentTestPage";
import NotificationsPage from "./pages/NotificationsPage";
import StudentTimetablePage from "./pages/StudentTimetablePage";
import ParentStudentExamsPage from "./pages/ParentStudentExamsPage";
// Removed pages: Settings, Branches, System Configuration
import NotFound from "./pages/NotFound";
import ForbiddenPage from "./pages/ForbiddenPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, student, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user && !student) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, student, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user || student) {
    // Redirect to role-specific dashboard
    if (student) {
      return <Navigate to="/student-dashboard" replace />;
    }
    if (user?.role === 'parent') {
      return <Navigate to="/parent-dashboard" replace />;
    }
    if (user?.role === 'teacher') {
      return <Navigate to="/teacher-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function ErrorInitializer() {
  useErrorHandler();
  return null;
}

function TimetableRouter() {
  const { user, student } = useAuth();

  // Determine which timetable page to show based on user role
  if (user?.role === 'teacher') {
    return <TeacherTimetablePage />;
  }
  if (student || user?.role === 'student' || user?.role === 'parent') {
    return <StudentTimetablePage />;
  }
  // For admins and other roles, show the full timetable management page
  return <TimetablePage />;
}

function RoleBasedRedirect() {
  const { user, student, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to role-specific dashboard
  if (student) {
    return <Navigate to="/student-dashboard" replace />;
  }
  if (user?.role === 'parent') {
    return <Navigate to="/parent-dashboard" replace />;
  }
  if (user?.role === 'teacher') {
    return <Navigate to="/teacher-dashboard" replace />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not authenticated, go to auth
  return <Navigate to="/auth" replace />;
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
                        <Route path="/" element={<RoleBasedRedirect />} />
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
                          path="/teacher-grading"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <TeacherGradingPage />
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-attendance"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherAttendancePage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-classes"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherClassManagementPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-reports"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherReportsPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-assignments"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherAssignmentsPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-schedule"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherSchedulePage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-communication"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherCommunicationPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/teacher-exams"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="teacher">
                                <DashboardLayout>
                                  <TeacherExamsPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/parent-dashboard"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute role="parent">
                                <DashboardLayout>
                                  <ParentDashboardPage />
                                </DashboardLayout>
                              </RoleBasedRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/student-dashboard"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <StudentDashboardPage />
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
                        <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/branches" element={<Navigate to="/dashboard" replace />} />
                        <Route
                          path="/exams"
                          element={
                            <ProtectedRoute>
                              <RoleBasedRoute permission="grade.read">
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
                              <DashboardLayout>
                                <CalendarPage />
                              </DashboardLayout>
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
                          path="/inbox"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <NotificationsPage />
                              </DashboardLayout>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/my-timetable"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <StudentTimetablePage />
                              </DashboardLayout>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/my-exams"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <ParentStudentExamsPage />
                              </DashboardLayout>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/messaging"
                          element={
                            <ProtectedRoute>
                              <DashboardLayout>
                                <MessagingPage />
                              </DashboardLayout>
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
                          element={<Navigate to="/parent-dashboard" replace />}
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
                                <TimetableRouter />
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
