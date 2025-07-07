import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TeacherManagement as TeacherManagementComponent } from '@/components/teachers/TeacherManagement';

export const TeacherManagement = () => {
  return (
    <DashboardLayout>
      <TeacherManagementComponent />
    </DashboardLayout>
  );
};