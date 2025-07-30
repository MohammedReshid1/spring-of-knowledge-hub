import { StudentList } from '@/components/students/StudentList';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { MultiFileStudentSync } from '@/components/students/MultiFileStudentSync';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StudentsPage = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading students...">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="list">Student List</TabsTrigger>
          <TabsTrigger value="sync">Multi-File Sync</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          <StudentList />
        </TabsContent>
        
        <TabsContent value="sync">
          <MultiFileStudentSync />
        </TabsContent>
      </Tabs>
    </BranchLoadingWrapper>
  );
};

export default StudentsPage;