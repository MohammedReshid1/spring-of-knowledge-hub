import { TeacherManagement } from '@/components/teachers/TeacherManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { useLiveData } from '@/hooks/useLiveData';

const TeachersPage = () => {
  // Enable real-time updates for teachers and related data
  useLiveData(['teachers', 'classes', 'subjects']);

  return (
    <BranchLoadingWrapper loadingMessage="Loading teachers...">
      <TeacherManagement />
    </BranchLoadingWrapper>
  );
};

export default TeachersPage;