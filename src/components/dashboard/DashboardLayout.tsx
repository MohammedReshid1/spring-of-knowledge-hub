import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useBranch } from "@/contexts/BranchContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { BranchSelector } from "@/components/branches/BranchSelector";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  GraduationCap,
  Users,
  BookOpen,
  LogOut,
  Home,
  DollarSign,
  UserCheck,
  IdCard,
  Menu,
  X,
  FileText,
  Calendar,
  ClipboardCheck,
  Shield,
  BarChart3,
  Bell,
  Package,
  Heart,
  Wallet,
  Layers,
  ShieldCheck,
  Clock,
  CalendarDays,
  ChevronRight,
  Sparkles,
  MessageSquare,
  KeyRound,
  Library,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
}) => {
  const { user, signOut } = useAuth();
  const { isAdmin, isSuperAdmin, isTeacher, hasPermission, isSuperSuperAdmin } =
    useRoleAccess();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Use sidebar context instead of local state
  const { isSidebarCollapsed, setIsSidebarCollapsed, toggleSidebar } = useSidebar();

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    // Cleanup on component unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  // Auto-close mobile menu when pressing Escape
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isMobileMenuOpen]);
  const { selectedBranch, userBranches } = useBranch();

  // User profile is already available from auth context
  const userProfile = user ? { full_name: user.full_name } : null;

  const adminNav = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      adminOnly: false,
      permission: null,
    }, // Always visible
    {
      name: "Students",
      href: "/students",
      icon: Users,
      adminOnly: false,
      permission: "student.read",
    },
    {
      name: "Classes",
      href: "/classes",
      icon: BookOpen,
      adminOnly: false,
      permission: "class.read",
    },
    {
      name: "Grade Levels",
      href: "/grade-levels",
      icon: Layers,
      adminOnly: false,
      permission: "class.read",
    },
    {
      name: "Subjects",
      href: "/subjects",
      icon: Library,
      adminOnly: false,
      permission: "subject.read",
    },
    {
      name: "Teachers",
      href: "/teachers",
      icon: UserCheck,
      adminOnly: false,
      permission: "teacher.read",
    },
    {
      name: "Payment Management",
      href: "/payments",
      icon: DollarSign,
      adminOnly: false,
      permission: "payment.read",
    },
    {
      name: "Attendance",
      href: "/attendance",
      icon: Clock,
      adminOnly: false,
      permission: "attendance.read",
    },
    {
      name: "Timetable",
      href: "/timetable",
      icon: CalendarDays,
      adminOnly: false,
      permission: "timetable.read",
    },
    {
      name: "Exams",
      href: "/exams",
      icon: FileText,
      adminOnly: false,
      permission: "grade.read",
    },
    {
      name: "Calendar",
      href: "/calendar",
      icon: Calendar,
      adminOnly: false,
      permission: null,
    }, // Always visible
    {
      name: "Discipline",
      href: "/discipline",
      icon: Shield,
      adminOnly: false,
      permission: "discipline.read",
    },
    {
      name: "Notifications",
      href: "/notifications",
      icon: Bell,
      adminOnly: false,
      permission: "announcement.read",
    },
    {
      name: "Messages",
      href: "/messaging",
      icon: MessageSquare,
      adminOnly: false,
      permission: "communication.read",
    },
    {
      name: "Inventory",
      href: "/inventory",
      icon: Package,
      adminOnly: false,
      permission: "inventory.read",
    },
    {
      name: "Accounting",
      href: "/accounting",
      icon: Wallet,
      adminOnly: false,
      comingSoon: true,
      permission: "payment.read",
    },
    {
      name: "Student ID Cards",
      href: "/student-id-cards",
      icon: IdCard,
      adminOnly: false,
      permission: "student.read",
    },
    {
      name: "Account Security",
      href: "/account-security",
      icon: KeyRound,
      adminOnly: false,
      permission: null,
    },
    {
      name: "System Administration",
      href: "/admin",
      icon: ShieldCheck,
      adminOnly: true,
      permission: "system.admin",
    },
  ];

  const teacherNav = [
    {
      name: "My Dashboard",
      href: "/teacher-dashboard",
      icon: Home,
      adminOnly: false,
      permission: null,
    },
    {
      name: "Classes",
      href: "/classes",
      icon: BookOpen,
      adminOnly: false,
      permission: "class.read",
    },
    {
      name: "Subjects",
      href: "/subjects",
      icon: Library,
      adminOnly: false,
      permission: "subject.read",
    },
    {
      name: "Attendance",
      href: "/attendance",
      icon: Clock,
      adminOnly: false,
      permission: "attendance.read",
    },
    {
      name: "Timetable",
      href: "/timetable",
      icon: CalendarDays,
      adminOnly: false,
      permission: "timetable.read",
    },
    {
      name: "Exams",
      href: "/exams",
      icon: FileText,
      adminOnly: false,
      permission: "grade.read",
    },
    {
      name: "Notifications",
      href: "/notifications",
      icon: Bell,
      adminOnly: false,
      permission: "announcement.read",
    },
    {
      name: "Account Security",
      href: "/account-security",
      icon: KeyRound,
      adminOnly: false,
      permission: null,
    },
  ];

  const navigation = isTeacher ? teacherNav : adminNav;

  // Filter navigation items based on user role and permissions using RBAC
  const filteredNavigation = navigation.filter((item) => {
    // Super admin sees everything
    if (isSuperSuperAdmin) return true;

    // If no permission required, show it
    if (!item.permission) return true;

    // Check if user has the required permission (exact match or .manage variant)
    // For example, if item requires "student.read", also accept "student.manage"
    const basePermission = item.permission.replace('.read', '');
    const readPermission = item.permission;
    const managePermission = basePermission + '.manage';

    return hasPermission(readPermission) || hasPermission(managePermission);
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = userProfile?.full_name || user?.email || "User";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Consistent off-white background */}
      <div className="fixed inset-0 bg-slate-50 -z-10" />

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-glass bg-white/80 border-b border-white/20 shadow-premium">
        <div className="w-full px-2 sm:px-4 lg:px-6">
          <div className="flex h-20 items-center justify-between">
            {/* Left side - Logo and Brand at the far left edge */}
            <div className="flex items-center">
              {/* Premium Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2 h-10 w-10 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border border-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:shadow-glow-blue group"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5 text-slate-700 transition-transform duration-300 group-hover:rotate-90" />
                ) : (
                  <Menu className="h-5 w-5 text-slate-700 transition-transform duration-300 group-hover:scale-110" />
                )}
              </Button>

              {/* Premium Brand Area - Far Left Edge */}
              {(() => {
                const branch = userBranches.find(
                  (b) => b.id === selectedBranch,
                );
                const name = branch?.name || "Spring of Knowledge Academy";
                const logo = branch?.logo_url;
                return (
                  <div className="flex items-center group cursor-pointer hover:scale-105 transition-transform duration-300">
                    <div className="relative">
                      {logo ? (
                        <img
                          src={logo}
                          alt={name}
                          className="h-10 w-10 sm:h-12 sm:w-12 mr-2 sm:mr-3 rounded-xl shadow-lg ring-2 ring-white/20 transition-all duration-300 group-hover:shadow-glow-blue group-hover:ring-blue-200/40"
                        />
                      ) : (
                        <div className="h-10 w-10 sm:h-12 sm:w-12 mr-2 sm:mr-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg ring-2 ring-white/20 flex items-center justify-center transition-all duration-300 group-hover:shadow-glow-blue group-hover:ring-blue-200/40">
                          <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                      )}
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm animate-pulse-glow" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent leading-tight truncate">
                        <span className="hidden sm:inline">{name}</span>
                        <span className="sm:hidden">
                          {name.slice(0, 10)}
                          {name.length > 10 ? "…" : ""}
                        </span>
                      </h1>
                      <div className="flex items-center text-xs text-slate-500 mt-0.5">
                        <Sparkles className="h-3 w-3 mr-1 text-purple-400" />
                        <span className="hidden md:inline">
                          Education Management System
                        </span>
                        <span className="md:hidden">EMS</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right side - User Info and Actions at the rightmost edge */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="relative hidden md:block">
                <BranchSelector />
              </div>

              {/* Notification Bell */}
              <NotificationBell />

              {/* Premium User Welcome - Rightmost Edge */}
              <div className="hidden lg:flex items-center space-x-3 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <div className="flex flex-col text-right min-w-0">
                  <span className="text-xs font-medium text-slate-500 leading-none">
                    Welcome back
                  </span>
                  <span className="text-sm font-semibold bg-gradient-to-r from-slate-700 to-slate-800 bg-clip-text text-transparent truncate max-w-24">
                    {displayName}
                  </span>
                </div>
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-md flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Premium Sign Out Button - Far Right */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-1 sm:space-x-2 h-10 px-2 sm:px-4 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 border border-red-200/40 text-red-700 hover:text-red-800 transition-all duration-300 hover:scale-105 hover:shadow-glow-orange group flex-shrink-0"
              >
                <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Premium Mobile Menu with scroll lock */}
        {isMobileMenuOpen && (
          <>
            {/* Background overlay to prevent body scroll */}
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="lg:hidden fixed top-20 left-0 right-0 bottom-0 z-40 animate-fade-in-up overflow-y-auto">
              <div className="mx-4 my-3 backdrop-blur-glass bg-white/95 rounded-2xl shadow-premium border border-white/20 overflow-hidden max-h-[calc(100vh-6rem)]">
                <div className="p-3 space-y-1">
                  {filteredNavigation.map((item, index) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    const isComingSoon = item.comingSoon;

                    return (
                      <div
                        key={item.name}
                        className={`${
                          isComingSoon ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                        onClick={
                          isComingSoon
                            ? undefined
                            : () => setIsMobileMenuOpen(false)
                        }
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {isComingSoon ? (
                          <div
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden opacity-50 bg-slate-100 text-slate-400`}
                          >
                            <div className="p-2 rounded-lg bg-slate-200">
                              <Icon className="h-4 w-4 flex-shrink-0" />
                            </div>
                            <span className="flex-1">{item.name}</span>
                            <div
                              className={`px-3 py-1.5 text-white text-xs rounded-full font-semibold animate-pulse-glow ${
                                item.name === "Accounting"
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-glow-green"
                                  : item.name === "Timetable"
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 shadow-glow-purple"
                                    : item.name === "Notifications"
                                      ? "bg-gradient-to-r from-amber-500 to-orange-600 shadow-glow-orange"
                                      : "bg-gradient-to-r from-blue-500 to-purple-600 shadow-glow-blue"
                              }`}
                            >
                              Soon
                            </div>
                          </div>
                        ) : (
                          <Link
                            to={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden ${
                              isActive
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-glow-blue transform scale-[1.02]"
                                : "text-slate-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-slate-800 hover:scale-105"
                            }`}
                          >
                            <div
                              className={`p-2 rounded-lg transition-all duration-300 ${
                                isActive
                                  ? "bg-white/20 shadow-sm"
                                  : "bg-slate-100 group-hover:bg-white group-hover:shadow-sm"
                              }`}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                            </div>
                            <span className="flex-1">{item.name}</span>
                            <ChevronRight
                              className={`h-4 w-4 transition-all duration-300 ${
                                isActive
                                  ? "text-white/80"
                                  : "text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1"
                              }`}
                            />

                            {/* Hover gradient overlay */}
                            {!isActive && (
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-blue-500/5 transition-all duration-300" />
                            )}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <div className="flex flex-1 pt-1">
        {/* Sidebar Toggle Button - Creative Minimal Design */}
        <div
          className={`hidden lg:block fixed top-28 z-[60] transition-all duration-200 ease-in-out ${
            isSidebarCollapsed ? "left-4" : "left-[290px]"
          }`}
          style={{
            /* Ensure toggle button always stays fixed in position */
            position: "fixed",
          }}
        >
          <button
            onClick={toggleSidebar}
            className="group relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/90 to-purple-600/90 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
          >
            {/* Simple Contextual Arrow */}
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <div
                className={`transition-all duration-300 ease-in-out ${
                  isSidebarCollapsed ? "rotate-0" : "rotate-180"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M9 18l6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/0 to-purple-500/0 group-hover:from-blue-400/30 group-hover:to-purple-500/30 transition-all duration-300" />
          </button>
        </div>

        {/* Premium Desktop Sidebar */}
        <nav
          className={`hidden lg:block transition-all duration-200 ease-in-out ${
            isSidebarCollapsed ? "w-20" : "w-72"
          }`}
        >
          <div
            className={`fixed h-[calc(100vh-6rem)] top-24 left-1 rounded-2xl backdrop-blur-glass bg-white/80 border border-white/20 shadow-premium transition-all duration-200 ease-in-out ${
              isSidebarCollapsed
                ? "w-20 overflow-visible"
                : "w-72 overflow-hidden"
            }`}
            style={{
              /* Fixed positioning ensures sidebar stays in place during page scroll */
              position: "fixed",
              zIndex: 50,
            }}
          >
            {/* Sidebar Header - Always maintain consistent height */}
            <div
              className="border-b border-white/10 transition-all duration-500"
              style={{ height: "88px" }}
            >
              {!isSidebarCollapsed && (
                <div className="p-6 h-full flex items-center">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                        Navigation
                      </h2>
                      <p className="text-xs text-slate-500">Main menu</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Items */}
            <div
              className={`relative transition-all duration-500 scroll-area-relative ${
                isSidebarCollapsed ? "scrollbar-thin p-2 pt-6" : "scrollbar-none p-4"
              }`}
              style={{
                height: "calc(100% - 88px)" /* Subtract header height */,
                overflowY: "auto",
                overflowX: "hidden",
                /* Enhanced scrollbar styling for better UX */
                scrollbarWidth: isSidebarCollapsed
                  ? "thin"
                  : "none" /* Firefox - show thin scrollbar when collapsed */,
                scrollbarColor: isSidebarCollapsed
                  ? "rgba(148, 163, 184, 0.3) transparent"
                  : "transparent transparent",
              }}
            >

              {/* Scroll area wrapper for better event handling */}
              <div
                className={`${isSidebarCollapsed ? "hover:bg-white/5 rounded-lg transition-colors duration-300" : ""} relative`}
              >
                <ul className="space-y-2">
                  {filteredNavigation.map((item, index) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    const isComingSoon = item.comingSoon;

                    // Different gradient themes for navigation groups
                    const getThemeColors = (index: number) => {
                      const themes = [
                        {
                          gradient: "from-blue-500 to-cyan-500",
                          glow: "shadow-glow-blue",
                          bg: "from-blue-50 to-cyan-50",
                        },
                        {
                          gradient: "from-emerald-500 to-teal-500",
                          glow: "shadow-glow-green",
                          bg: "from-emerald-50 to-teal-50",
                        },
                        {
                          gradient: "from-purple-500 to-indigo-500",
                          glow: "shadow-glow-purple",
                          bg: "from-purple-50 to-indigo-50",
                        },
                        {
                          gradient: "from-orange-500 to-red-500",
                          glow: "shadow-glow-orange",
                          bg: "from-orange-50 to-red-50",
                        },
                      ];
                      return themes[index % themes.length];
                    };

                    const theme = getThemeColors(index);

                    return (
                      <li
                        key={item.name}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {isComingSoon ? (
                          <div className="relative group cursor-not-allowed">
                            <div className="flex items-center space-x-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden opacity-50 bg-slate-100 text-slate-400">
                              {/* Icon Container */}
                              <div className="p-2.5 rounded-lg bg-slate-200 relative z-10">
                                <Icon className="h-4 w-4 flex-shrink-0" />
                              </div>

                              {/* Text Content */}
                              <div
                                className={`relative z-10 transition-all duration-500 overflow-hidden ${
                                  isSidebarCollapsed
                                    ? "w-0 opacity-0"
                                    : "flex-1 opacity-100"
                                }`}
                              >
                                <span className="font-semibold whitespace-nowrap">
                                  {item.name}
                                </span>
                              </div>

                              {/* Soon Badge */}
                              <div
                                className={`text-white text-xs rounded-full font-semibold animate-pulse-glow relative z-10 transition-all duration-500 overflow-hidden ${
                                  isSidebarCollapsed
                                    ? "w-0 opacity-0 px-0 py-0"
                                    : "px-3 py-1.5 opacity-100"
                                } ${
                                  item.name === "Accounting"
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-glow-green"
                                    : item.name === "Timetable"
                                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 shadow-glow-purple"
                                      : item.name === "Notifications"
                                        ? "bg-gradient-to-r from-amber-500 to-orange-600 shadow-glow-orange"
                                        : "bg-gradient-to-r from-blue-500 to-purple-600 shadow-glow-blue"
                                }`}
                              >
                                {!isSidebarCollapsed && "Soon"}
                              </div>
                            </div>

                            {/* Enhanced Tooltip for Coming Soon Items */}
                            {isSidebarCollapsed && (
                              <div
                                className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-300 ease-out group-hover:translate-x-2 group-hover:scale-105"
                                style={{ pointerEvents: "none" }}
                              >
                                <div
                                  className="bg-slate-800/95 text-white px-4 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap shadow-2xl border-2 border-slate-600/60 backdrop-blur-xl"
                                  style={{
                                    backdropFilter: "blur(20px)",
                                    WebkitBackdropFilter: "blur(20px)",
                                  }}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className="p-1.5 rounded-lg bg-slate-700/50">
                                      <Icon className="h-4 w-4 flex-shrink-0 text-slate-300" />
                                    </div>
                                    <span className="font-medium text-base">
                                      {item.name}
                                    </span>
                                    <span
                                      className={`text-xs px-3 py-1.5 rounded-full font-bold border-2 shadow-lg ${
                                        item.name === "Accounting"
                                          ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/50 shadow-emerald-500/20"
                                          : item.name === "Timetable"
                                            ? "bg-indigo-500/30 text-indigo-200 border-indigo-400/50 shadow-indigo-500/20"
                                            : item.name === "Notifications"
                                              ? "bg-amber-500/30 text-amber-200 border-amber-400/50 shadow-amber-500/20"
                                              : "bg-blue-500/30 text-blue-200 border-blue-400/50 shadow-blue-500/20"
                                      }`}
                                    >
                                      Soon
                                    </span>
                                  </div>
                                  {/* Enhanced Arrow pointing to the button */}
                                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                                    <div
                                      className="w-4 h-4 bg-slate-800/95 border-l-2 border-b-2 border-slate-600/60 transform rotate-45"
                                      style={{
                                        filter:
                                          "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative group">
                            <Link
                              to={item.href}
                              className={`flex items-center rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden ${
                                isSidebarCollapsed
                                  ? "justify-center p-3 mx-1"
                                  : "space-x-4 px-4 py-3.5"
                              } ${
                                isActive
                                  ? `bg-gradient-to-r ${theme.gradient} text-white ${theme.glow} transform scale-[1.02] shadow-lg`
                                  : `text-slate-700 hover:bg-gradient-to-r hover:${theme.bg} hover:text-slate-800 hover:scale-105 hover:shadow-md`
                              }`}
                              style={{
                                /* Ensure proper touch/mouse event handling */
                                touchAction: "manipulation",
                                userSelect: "none",
                              }}
                            >
                              {/* Icon Container */}
                              <div
                                className={`p-2.5 rounded-lg transition-all duration-300 relative z-10 flex-shrink-0 ${
                                  isActive
                                    ? "bg-white/20 shadow-sm backdrop-blur-sm"
                                    : `bg-slate-100 group-hover:bg-white group-hover:shadow-sm group-hover:bg-gradient-to-r group-hover:${theme.bg}`
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>

                              {/* Text Content - Only show when expanded */}
                              {!isSidebarCollapsed && (
                                <div className="flex-1 relative z-10">
                                  <span className="font-semibold">
                                    {item.name}
                                  </span>
                                  {isActive && (
                                    <div className="text-xs text-white/80 mt-0.5">
                                      Active page
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Active Indicator - Only show when expanded */}
                              {isActive && !isSidebarCollapsed && (
                                <div className="w-1 h-8 bg-white/30 rounded-full relative z-10" />
                              )}

                              {/* Hover Arrow - Only show when expanded */}
                              {!isSidebarCollapsed && (
                                <ChevronRight
                                  className={`h-4 w-4 transition-all duration-300 relative z-10 ${
                                    isActive
                                      ? "text-white/80 transform translate-x-1"
                                      : "text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 opacity-0 group-hover:opacity-100"
                                  }`}
                                />
                              )}

                              {/* Background Effects */}
                              {!isActive && (
                                <>
                                  {/* Subtle hover gradient */}
                                  <div
                                    className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-0 group-hover:opacity-[0.03] transition-all duration-300`}
                                  />
                                  {/* Shimmer effect on hover */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                </>
                              )}

                              {/* Active state background animation */}
                              {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-gradient-shift" />
                              )}
                            </Link>

                            {/* Enhanced Tooltip for Navigation Items */}
                            {isSidebarCollapsed && (
                              <div
                                className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-300 ease-out group-hover:translate-x-2 group-hover:scale-105"
                                style={{ pointerEvents: "none" }}
                              >
                                <div
                                  className={`px-4 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap shadow-2xl backdrop-blur-xl border-2 transition-all duration-300 ${
                                    isActive
                                      ? `bg-gradient-to-r ${theme.gradient} text-white border-white/40 ${theme.glow} shadow-xl`
                                      : "bg-slate-800/95 text-white border-slate-600/60 shadow-slate-900/30"
                                  }`}
                                  style={{
                                    backdropFilter: "blur(20px)",
                                    WebkitBackdropFilter: "blur(20px)",
                                  }}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div
                                      className={`p-1.5 rounded-lg ${
                                        isActive
                                          ? "bg-white/20"
                                          : "bg-slate-700/50"
                                      }`}
                                    >
                                      <Icon className="h-4 w-4 flex-shrink-0" />
                                    </div>
                                    <span className="font-medium text-base">
                                      {item.name}
                                    </span>
                                    {isActive && (
                                      <div className="flex items-center space-x-1.5">
                                        <div className="w-2 h-2 bg-white/70 rounded-full animate-pulse shadow-sm"></div>
                                        <span className="text-xs text-white/90 font-medium bg-white/10 px-2 py-0.5 rounded-full">
                                          Active
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Enhanced Arrow pointing to the button */}
                                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                                    <div
                                      className={`w-4 h-4 transform rotate-45 border-l-2 border-b-2 transition-all duration-300 ${
                                        isActive
                                          ? `bg-gradient-to-r ${theme.gradient} border-white/40`
                                          : "bg-slate-800/95 border-slate-600/60"
                                      }`}
                                      style={{
                                        filter:
                                          "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Bottom section with premium styling - Only show when expanded */}
              {!isSidebarCollapsed && (
                <div className="mt-8 pt-6 border-t border-white/10 transition-all duration-500">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100/80 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-xs text-slate-600 text-center">
                      <div className="font-semibold">System Status</div>
                      <div className="flex items-center justify-center mt-2 space-x-2">
                        <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span>All systems operational</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Premium Main content area with footer */}
        <div
          className={`flex-1 flex flex-col min-w-0 pt-20 transition-all duration-200 ease-in-out ${
            isSidebarCollapsed ? "lg:ml-4" : "lg:ml-4"
          }`}
        >
          <main className="flex-1 p-4 sm:p-8 lg:pr-8">
            <div className="mx-auto max-w-6xl relative">{children}</div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
};
