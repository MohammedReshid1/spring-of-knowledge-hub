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
  const { userBranches, selectedBranch, setSelectedBranch, canManageBranches } = useBranch();

  // Don't show selector if user has no branches or only one branch (and can't manage branches)
  if (userBranches.length === 0 || (userBranches.length === 1 && !canManageBranches)) {
    return null;
  }

  const getSelectedBranchName = () => {
    if (selectedBranch === 'all') return 'All Branches';
    const branch = userBranches.find(b => b.id === selectedBranch);
    return branch?.name || 'Select Branch';
  };

  const getSelectedBranchCount = () => {
    if (selectedBranch === 'all') return userBranches.length;
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
        {canManageBranches && userBranches.length > 1 && (
          <DropdownMenuItem
            onClick={() => setSelectedBranch('all')}
            className={selectedBranch === 'all' ? 'bg-accent' : ''}
          >
            <Building className="h-4 w-4 mr-2" />
            All Branches
            <Badge variant="outline" className="ml-auto">
              {userBranches.length}
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