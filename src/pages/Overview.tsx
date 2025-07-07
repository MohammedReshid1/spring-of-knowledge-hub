import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Overview as OverviewComponent } from '@/components/dashboard/Overview';

export const Overview = () => {
  return (
    <DashboardLayout>
      <OverviewComponent />
    </DashboardLayout>
  );
};