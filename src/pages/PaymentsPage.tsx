import { PaymentList } from '@/components/payments/PaymentList';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const PaymentsPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading payments...">
      <PaymentList />
    </BranchLoadingWrapper>
  );
};

export default PaymentsPage;