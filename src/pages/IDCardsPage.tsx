import { IDCardManager } from '@/components/students/IDCardManager';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const IDCardsPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading student ID card data...">
      <IDCardManager />
    </BranchLoadingWrapper>
  );
};

export default IDCardsPage;