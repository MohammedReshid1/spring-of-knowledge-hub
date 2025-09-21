import React from 'react';
import { DisciplinaryManagement } from '@/components/discipline/DisciplinaryManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';

const DisciplinePage: React.FC = () => {
  return (
    <BranchLoadingWrapper loadingMessage="Loading discipline data...">
      <div className="container mx-auto py-6">
        <DisciplinaryManagement />
      </div>
    </BranchLoadingWrapper>
  );
};

export default DisciplinePage;
