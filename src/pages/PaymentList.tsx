import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { PaymentList as PaymentListComponent } from '@/components/payments/PaymentList';

export const PaymentList = () => {
  return (
    <DashboardLayout>
      <PaymentListComponent />
    </DashboardLayout>
  );
};