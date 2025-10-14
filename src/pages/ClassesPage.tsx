import { ClassManagement } from '@/components/classes/ClassManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { useLiveData } from '@/hooks/useLiveData';

const ClassesPage = () => {
  // Enable real-time updates for classes and related data
  useLiveData(['classes', 'students', 'teachers']);

  return (
    <BranchLoadingWrapper loadingMessage="Loading class data...">
      <ClassManagement />
    </BranchLoadingWrapper>
  );
};

export default ClassesPage;