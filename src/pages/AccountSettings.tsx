import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AccountSettings as AccountSettingsComponent } from '@/components/settings/AccountSettings';

export const AccountSettings = () => {
  return (
    <DashboardLayout>
      <AccountSettingsComponent />
    </DashboardLayout>
  );
};