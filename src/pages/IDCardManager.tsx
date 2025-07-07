import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { IDCardManager as IDCardManagerComponent } from '@/components/students/IDCardManager';

export const IDCardManager = () => {
  return (
    <DashboardLayout>
      <IDCardManagerComponent />
    </DashboardLayout>
  );
};