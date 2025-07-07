import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { StudentList as StudentListComponent } from '@/components/students/StudentList';

export const StudentList = () => {
  return (
    <DashboardLayout>
      <StudentListComponent />
    </DashboardLayout>
  );
};