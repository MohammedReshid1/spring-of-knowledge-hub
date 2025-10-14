import React from 'react';

// Import all widget components
import { AdminStatsWidget } from './admin/AdminStatsWidget';
import { PaymentCollectionWidget } from './admin/PaymentCollectionWidget';
import { AttendanceOverviewWidget } from './admin/AttendanceOverviewWidget';
import { SystemStatusWidget } from './admin/SystemStatusWidget';
import { TeacherScheduleWidget } from './teacher/TeacherScheduleWidget';
import { PendingGradesWidget } from './teacher/PendingGradesWidget';
import { TeacherNotificationsWidget } from './teacher/TeacherNotificationsWidget';
import { StudentProgressWidget } from './teacher/StudentProgressWidget';
import { StudentGradesWidget } from './student/StudentGradesWidget';
import { UpcomingExamsWidget } from './student/UpcomingExamsWidget';
import { AttendanceSummaryWidget } from './student/AttendanceSummaryWidget';
import { AnnouncementsWidget } from './student/AnnouncementsWidget';
import { ParentOverviewWidget } from './student/ParentOverviewWidget';
import { FeeStatusWidget } from './student/FeeStatusWidget';

// Widget interfaces
export interface WidgetProps {
  config: any;
  data?: any;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// Widget registry type
export interface WidgetRegistryType {
  [key: string]: React.ComponentType<WidgetProps>;
}

// Default placeholder widget
const PlaceholderWidget: React.FC<WidgetProps> = ({ config }) => (
  <div className="h-24 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-200 rounded">
    <div className="text-center">
      <div className="text-sm font-medium">{config.title}</div>
      <div className="text-xs text-gray-400">Coming Soon</div>
    </div>
  </div>
);

// Widget registry with actual components
export const widgetRegistry: WidgetRegistryType = {
  // Admin widgets
  'admin-stats': AdminStatsWidget,
  'payment-collection': PaymentCollectionWidget,
  'attendance-overview': AttendanceOverviewWidget,
  'system-status': SystemStatusWidget,
  
  // Teacher widgets
  'teacher-schedule': TeacherScheduleWidget,
  'pending-grades': PendingGradesWidget,
  'teacher-notifications': TeacherNotificationsWidget,
  'student-progress': StudentProgressWidget,
  
  // Student/Parent widgets
  'student-grades': StudentGradesWidget,
  'upcoming-exams': UpcomingExamsWidget,
  'attendance-summary': AttendanceSummaryWidget,
  'announcements': AnnouncementsWidget,
  'parent-overview': ParentOverviewWidget,
  'fee-status': FeeStatusWidget,
};

// Helper function to get widget component
export const getWidgetComponent = (widgetId: string): React.ComponentType<WidgetProps> => {
  return widgetRegistry[widgetId] || PlaceholderWidget;
};

// Helper function to register a new widget
export const registerWidget = (widgetId: string, component: React.ComponentType<WidgetProps>) => {
  widgetRegistry[widgetId] = component;
};