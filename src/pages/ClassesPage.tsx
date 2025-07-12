import { ClassManagement } from '@/components/classes/ClassManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const ClassesPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading class data...">
      <ClassManagement />
    </BranchLoadingWrapper>
  );
};

export default ClassesPage;