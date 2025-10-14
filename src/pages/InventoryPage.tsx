import { InventoryManagement } from '@/components/inventory/InventoryManagement';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { useLiveData } from '@/hooks/useLiveData';

const InventoryPage = () => {
  // Enable real-time updates for inventory
  useLiveData(['assets', 'supplies', 'maintenance', 'inventory-requests']);

  return (
    <BranchLoadingWrapper loadingMessage="Loading inventory data...">
      <InventoryManagement />
    </BranchLoadingWrapper>
  );
};

export default InventoryPage;