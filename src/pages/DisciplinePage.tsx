import React from 'react';
import { DisciplinaryManagement } from '@/components/discipline/DisciplinaryManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { useLiveDataForPage } from '@/hooks/useLiveData';

const DisciplinePage: React.FC = () => {
  // Enable real-time updates for discipline data
  useLiveDataForPage('incidents', {
    relatedCollections: ['disciplinary-actions', 'behavior-points', 'rewards', 'counseling', 'behavior-contracts', 'students']
  });

  return (
    <BranchLoadingWrapper loadingMessage="Loading discipline data...">
      <div className="container mx-auto py-6">
        <DisciplinaryManagement />
      </div>
    </BranchLoadingWrapper>
  );
};

export default DisciplinePage;
