import { StudentList } from '@/components/students/StudentList';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { useLiveData } from '@/hooks/useLiveData';

const StudentsPage = () => {
  // Enable real-time updates for students and related data
  useLiveData(['students', 'classes']);

  return (
    <BranchLoadingWrapper loadingMessage="Loading students...">
      <StudentList />
    </BranchLoadingWrapper>
  );
};

export default StudentsPage;