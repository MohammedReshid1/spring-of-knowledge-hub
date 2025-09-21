import { TeacherManagement } from '@/components/teachers/TeacherManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const TeachersPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading teachers...">
      <TeacherManagement />
    </BranchLoadingWrapper>
  );
};

export default TeachersPage;