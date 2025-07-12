import { PaymentDashboard } from '@/components/payments/PaymentDashboard';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const PaymentsPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading payment data...">
      <PaymentDashboard />
    </BranchLoadingWrapper>
  );
};

export default PaymentsPage;