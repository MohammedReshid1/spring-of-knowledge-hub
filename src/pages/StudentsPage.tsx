import { StudentList } from '@/components/students/StudentList';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const StudentsPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading students...">
      <StudentList />
    </BranchLoadingWrapper>
  );
};

export default StudentsPage;