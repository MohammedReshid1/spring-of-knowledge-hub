import { IDCardManager } from '@/components/students/IDCardManager';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { useLiveData } from '@/hooks/useLiveData';

const IDCardsPage = () => {
  // Enable real-time updates for student ID card data
  useLiveData(['students', 'classes']);

  return (
    <BranchLoadingWrapper loadingMessage="Loading student ID card data...">
      <IDCardManager />
    </BranchLoadingWrapper>
  );
};

export default IDCardsPage;