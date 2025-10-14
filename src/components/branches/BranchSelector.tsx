import { useState } from 'react';
import { ChevronDown, Loader2, MapPin, Globe, Check } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

  const handleBranchClick = (branchId: string) => {
    // Don't show confirmation if selecting the same branch
    if (branchId === selectedBranch) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setSelectedBranch(branchId);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="relative gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 hover:from-slate-100 hover:to-slate-200/80 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 group"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-md bg-gradient-to-br from-blue-100 to-purple-100 group-hover:from-blue-200 group-hover:to-purple-200 transition-colors">
                  {selectedBranch === 'all' ? (
                    <Globe className="h-3 w-3 text-blue-600" />
                  ) : (
                    <MapPin className="h-3 w-3 text-purple-600" />
                  )}
                </div>
                <span className="hidden sm:inline font-medium text-slate-700 group-hover:text-slate-800">
                  {getSelectedBranchName()}
                </span>
                <Badge
                  variant="secondary"
                  className="ml-1 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-200/50 text-xs font-semibold"
                >
                  {getSelectedBranchCount()}
                </Badge>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-72 p-2 bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-2xl"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-200/50 mb-2">
            <h3 className="font-semibold text-slate-800 text-sm">Switch Branch</h3>
            <p className="text-xs text-slate-500">Select a branch to manage</p>
          </div>

          {/* All Branches Option */}
          {isHQRole && (
            <DropdownMenuItem
              onClick={() => handleBranchClick('all')}
              className={`group rounded-xl p-3 transition-all duration-200 cursor-pointer ${
                selectedBranch === 'all'
                  ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50 shadow-sm'
                  : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  selectedBranch === 'all'
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                    : 'bg-slate-100 group-hover:bg-slate-200'
                }`}>
                  <Globe className={`h-4 w-4 ${
                    selectedBranch === 'all' ? 'text-white' : 'text-slate-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-slate-800">All Branches</span>
                    {selectedBranch === 'all' && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Global system view</p>
                </div>
                <Badge
                  variant="outline"
                  className={`ml-auto text-xs font-semibold ${
                    selectedBranch === 'all'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {userBranches.length || 0}
                </Badge>
              </div>
            </DropdownMenuItem>
          )}

          {/* Individual Branches */}
          <div className="space-y-1">
            {userBranches.map((branch, index) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => handleBranchClick(branch.id)}
                className={`group rounded-xl p-3 transition-all duration-200 cursor-pointer ${
                  selectedBranch === branch.id
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 shadow-sm'
                    : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    selectedBranch === branch.id
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}>
                    <MapPin className={`h-4 w-4 ${
                      selectedBranch === branch.id ? 'text-white' : 'text-slate-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-800">{branch.name}</span>
                      {selectedBranch === branch.id && (
                        <Check className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Branch location</p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-200/50 mt-2">
            <p className="text-xs text-slate-400 text-center">
              {userBranches.length} {userBranches.length === 1 ? 'branch' : 'branches'} available
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
  );
};