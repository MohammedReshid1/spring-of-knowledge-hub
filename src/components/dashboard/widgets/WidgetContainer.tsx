import React, { useState, useEffect } from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { BaseWidget, WidgetConfig } from './BaseWidget';
import { getWidgetComponent } from './WidgetRegistry';
import { cn } from '@/lib/utils';

interface WidgetRegistry {
  [key: string]: React.ComponentType<any>;
}

interface UserPreferences {
  [widgetId: string]: {
    size?: 'small' | 'medium' | 'large';
    position?: { x: number; y: number };
    isMinimized?: boolean;
    isVisible?: boolean;
  };
}

export const WidgetContainer: React.FC = () => {
  const { userRole, isAdmin, isSuperAdmin, isTeacher, isStudent, isParent, hasPermission, isSuperSuperAdmin, isAdminRole } = useRoleAccess();
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [minimizedWidgets, setMinimizedWidgets] = useState<Set<string>>(new Set());

  // Load user preferences from localStorage
  useEffect(() => {
    const savedPrefs = localStorage.getItem(`dashboard-preferences-${userRole}`);
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs);
      setPreferences(parsed);
      setMinimizedWidgets(new Set(
        Object.entries(parsed)
          .filter(([_, pref]) => (pref as any).isMinimized)
          .map(([id]) => id)
      ));
    }
  }, [userRole]);

  // Save preferences to localStorage
  const savePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem(`dashboard-preferences-${userRole}`, JSON.stringify(newPrefs));
  };

  const handleWidgetResize = (widgetId: string, size: 'small' | 'medium' | 'large') => {
    const newPrefs = {
      ...preferences,
      [widgetId]: { ...preferences[widgetId], size }
    };
    savePreferences(newPrefs);
  };

  const handleWidgetMinimize = (widgetId: string) => {
    const newMinimized = new Set(minimizedWidgets);
    if (newMinimized.has(widgetId)) {
      newMinimized.delete(widgetId);
    } else {
      newMinimized.add(widgetId);
    }
    setMinimizedWidgets(newMinimized);

    const newPrefs = {
      ...preferences,
      [widgetId]: { ...preferences[widgetId], isMinimized: newMinimized.has(widgetId) }
    };
    savePreferences(newPrefs);
  };

  // Get role-specific widget configurations with permission checks
  const getRoleWidgets = (): WidgetConfig[] => {
    const baseWidgets: WidgetConfig[] = [];

    // Helper function to check if user can see widget
    const canSeeWidget = (permission?: string): boolean => {
      if (isSuperSuperAdmin) return true; // Super admin sees everything
      if (!permission) return true; // No permission required

      // For admin roles, check multiple permission variants
      if (isAdminRole) {
        // Check if user has the specific permission
        if (hasPermission(permission)) return true;

        // Check for .manage permission variants
        if (permission && permission.includes('.')) {
          const [resource, action] = permission.split('.');
          const managePermission = `${resource}.manage`;
          if (hasPermission(managePermission)) return true;

          // Check for scoped permission variants (for branch admins)
          if (action === 'read') {
            // Branch admins should be able to see widgets with view_branch permissions
            const scopedPermissions = [
              `${resource}.view_branch`,
              `${resource}.view_all`,
              `${resource}.view_own`
            ];
            for (const scopedPerm of scopedPermissions) {
              if (hasPermission(scopedPerm)) return true;
            }
          }
        }
      }

      return hasPermission(permission);
    };

    if (isAdminRole) {
      // Admin Stats - requires system view or any student read permission
      if (canSeeWidget('system.view') || canSeeWidget('student.read') || canSeeWidget('student.view_branch') || canSeeWidget('student.view_all')) {
        baseWidgets.push({
          id: 'admin-stats',
          title: 'System Overview',
          size: 'large',
          allowedRoles: ['superadmin', 'super_admin', 'hq_admin', 'branch_admin', 'admin']
        });
      }

      // Payment Collection - requires any payment read permission
      if (canSeeWidget('payment.read') || canSeeWidget('payment.view_branch') || canSeeWidget('payment.view_all')) {
        baseWidgets.push({
          id: 'payment-collection',
          title: 'Payment Collection',
          size: 'large',
          allowedRoles: ['superadmin', 'super_admin', 'hq_admin', 'branch_admin', 'admin']
        });
      }

      // Attendance Overview - requires any attendance read permission
      if (canSeeWidget('attendance.read') || canSeeWidget('attendance.view_branch') || canSeeWidget('attendance.view_all')) {
        baseWidgets.push({
          id: 'attendance-overview',
          title: 'Attendance Overview',
          size: 'large',
          allowedRoles: ['superadmin', 'super_admin', 'hq_admin', 'branch_admin', 'admin']
        });
      }

      // System Status - requires system view
      if (canSeeWidget('system.view')) {
        baseWidgets.push({
          id: 'system-status',
          title: 'System Status',
          size: 'large',
          allowedRoles: ['superadmin', 'super_admin', 'hq_admin', 'branch_admin', 'admin']
        });
      }
    }

    if (isTeacher) {
      // Teacher widgets - require class and attendance permissions
      if (canSeeWidget('class.read')) {
        baseWidgets.push({
          id: 'teacher-schedule',
          title: "Today's Classes",
          size: 'large',
          allowedRoles: ['teacher']
        });
      }

      if (canSeeWidget('grade.read')) {
        baseWidgets.push({
          id: 'pending-grades',
          title: 'Pending Grades',
          size: 'medium',
          allowedRoles: ['teacher']
        });
      }

      if (canSeeWidget('message.read')) {
        baseWidgets.push({
          id: 'teacher-notifications',
          title: 'Notifications',
          size: 'medium',
          allowedRoles: ['teacher']
        });
      }

      if (canSeeWidget('student.read')) {
        baseWidgets.push({
          id: 'student-progress',
          title: 'Student Progress',
          size: 'medium',
          allowedRoles: ['teacher']
        });
      }
    }

    if (isStudent) {
      // Student widgets - require grade and attendance view own permissions
      if (canSeeWidget('grade.view_own')) {
        baseWidgets.push({
          id: 'student-grades',
          title: 'Recent Grades',
          size: 'large',
          allowedRoles: ['student']
        });
      }

      if (canSeeWidget('grade.view_own')) {
        baseWidgets.push({
          id: 'upcoming-exams',
          title: 'Upcoming Exams',
          size: 'medium',
          allowedRoles: ['student']
        });
      }

      if (canSeeWidget('attendance.view_own')) {
        baseWidgets.push({
          id: 'attendance-summary',
          title: 'Attendance Summary',
          size: 'medium',
          allowedRoles: ['student']
        });
      }

      baseWidgets.push({
        id: 'announcements',
        title: 'Announcements',
        size: 'medium',
        allowedRoles: ['student']
      }); // Announcements always visible
    }

    if (isParent) {
      // Parent widgets - require student view own permissions
      if (canSeeWidget('student.view_own')) {
        baseWidgets.push({
          id: 'parent-overview',
          title: 'Children Overview',
          size: 'large',
          allowedRoles: ['parent']
        });
      }

      if (canSeeWidget('payment.view_own')) {
        baseWidgets.push({
          id: 'fee-status',
          title: 'Fee Status',
          size: 'medium',
          allowedRoles: ['parent']
        });
      }

      if (canSeeWidget('grade.view_own')) {
        baseWidgets.push({
          id: 'upcoming-exams',
          title: 'Upcoming Exams',
          size: 'medium',
          allowedRoles: ['parent']
        });
      }

      baseWidgets.push({
        id: 'announcements',
        title: 'School Announcements',
        size: 'medium',
        allowedRoles: ['parent']
      }); // Announcements always visible
    }

    return baseWidgets.filter(widget =>
      !widget.allowedRoles || widget.allowedRoles.includes(userRole as string)
    );
  };

  const widgets = getRoleWidgets();
  const visibleWidgets = widgets.filter(widget => 
    !minimizedWidgets.has(widget.id)
  );

  return (
    <div className="space-y-8">
      {/* Premium Minimized Widgets Bar */}
      {minimizedWidgets.size > 0 && (
        <div className="relative p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border border-slate-200/50 backdrop-blur-sm animate-fade-in">
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-100/50 via-slate-200/50 to-slate-100/50 rounded-2xl"></div>

          <div className="relative flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-glow"></div>
              <span className="text-sm font-medium text-slate-700">Minimized Widgets:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.from(minimizedWidgets).map((widgetId, index) => {
                const widget = widgets.find(w => w.id === widgetId);
                return widget ? (
                  <button
                    key={widgetId}
                    onClick={() => handleWidgetMinimize(widgetId)}
                    className="group px-3 py-2 bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all duration-normal hover:scale-105"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'both'
                    }}
                  >
                    <span className="animate-scale-in">{widget.title}</span>
                  </button>
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Premium Main Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 auto-rows-max">
        {visibleWidgets.map((widget, index) => (
          <div
            key={widget.id}
            className={cn(
              getWidgetGridClass(widget, preferences[widget.id]?.size),
              'animate-fade-in-up group'
            )}
            style={{
              animationDelay: `${index * 200}ms`,
              animationFillMode: 'both'
            }}
          >
            {/* Premium widget wrapper with enhanced effects */}
            <div className="relative h-full transition-all duration-normal ease-premium group-hover:scale-[1.02] group-hover:-translate-y-1">

              <BaseWidget
                config={{
                  ...widget,
                  size: preferences[widget.id]?.size || widget.size,
                  canMinimize: false,
                  canResize: false
                }}
                onMinimize={() => handleWidgetMinimize(widget.id)}
                onResize={(size) => handleWidgetResize(widget.id, size)}
                className="relative z-10 h-full bg-white/90 backdrop-blur-glass border border-white/30 rounded-2xl overflow-hidden"
              >
                <WidgetRenderer widgetId={widget.id} />
              </BaseWidget>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

const getWidgetGridClass = (widget: WidgetConfig, overrideSize?: string) => {
  const size = overrideSize || widget.size || 'large';
  switch (size) {
    case 'small': return 'col-span-1';
    case 'medium': return 'col-span-1 md:col-span-1';
    case 'large': return 'col-span-1 md:col-span-2';
    default: return 'col-span-1 md:col-span-2';
  }
};

// Widget renderer that uses the registry
const WidgetRenderer: React.FC<{ widgetId: string }> = ({ widgetId }) => {
  const WidgetComponent = getWidgetComponent(widgetId);
  return <WidgetComponent config={{ id: widgetId }} />;
};