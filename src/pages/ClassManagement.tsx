import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ClassManagement as ClassManagementComponent } from '@/components/classes/ClassManagement';

export const ClassManagement = () => {
  return (
    <DashboardLayout>
      <ClassManagementComponent />
    </DashboardLayout>
  );
};