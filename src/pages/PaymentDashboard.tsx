import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { PaymentDashboard as PaymentDashboardComponent } from '@/components/payments/PaymentDashboard';

export const PaymentDashboard = () => {
  return (
    <DashboardLayout>
      <PaymentDashboardComponent />
    </DashboardLayout>
  );
};