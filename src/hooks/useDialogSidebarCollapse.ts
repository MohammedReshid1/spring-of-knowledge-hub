import { useEffect } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

/**
 * Hook that automatically collapses the sidebar when a dialog/modal is opened
 * Usage: Call this hook in any component where a dialog opens
 *
 * @param isOpen - Boolean indicating if the dialog is open
 *
 * @example
 * ```tsx
 * const [isDialogOpen, setIsDialogOpen] = useState(false);
 * useDialogSidebarCollapse(isDialogOpen);
 *
 * return (
 *   <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 *     ...
 *   </Dialog>
 * );
 * ```
 */
export function useDialogSidebarCollapse(isOpen: boolean) {
  const { isSidebarCollapsed, collapseSidebar } = useSidebar();

  useEffect(() => {
    if (isOpen && !isSidebarCollapsed) {
      collapseSidebar();
    }
  }, [isOpen, isSidebarCollapsed, collapseSidebar]);
}
