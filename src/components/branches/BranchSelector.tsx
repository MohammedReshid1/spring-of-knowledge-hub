import { Building, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useBranch } from '@/contexts/BranchContext';

export const BranchSelector = () => {
  const { userBranches = [], selectedBranch, setSelectedBranch, canSwitchBranches, isHQRole } = useBranch();

  // Only show selector for super admin (who can switch branches)
  // Hide for other users who are locked to their branch
  if (!canSwitchBranches) {
    return null;
  }

  const getSelectedBranchName = () => {
    if (selectedBranch === 'all') return 'All Branches';
    if (!selectedBranch) return 'Select Branch';
    const branch = userBranches.find(b => b.id === selectedBranch);
    return branch?.name || 'Select Branch';
  };

  const getSelectedBranchCount = () => {
    if (selectedBranch === 'all') return userBranches.length || 0;
    if (!selectedBranch) return '?';
    return 1;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building className="h-4 w-4" />
          <span className="hidden sm:inline">{getSelectedBranchName()}</span>
          <Badge variant="secondary" className="ml-1">
            {getSelectedBranchCount()}
          </Badge>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isHQRole && (
          <DropdownMenuItem
            onClick={() => setSelectedBranch('all')}
            className={selectedBranch === 'all' ? 'bg-accent' : ''}
          >
            <Building className="h-4 w-4 mr-2" />
            All Branches
            <Badge variant="outline" className="ml-auto">
              {userBranches.length || 0}
            </Badge>
          </DropdownMenuItem>
        )}
        {userBranches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => setSelectedBranch(branch.id)}
            className={selectedBranch === branch.id ? 'bg-accent' : ''}
          >
            <Building className="h-4 w-4 mr-2" />
            {branch.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};