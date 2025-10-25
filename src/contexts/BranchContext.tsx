import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { BranchSwitchDialog } from '@/components/common/BranchSwitchDialog';
import { FullScreenLoading } from '@/components/common/FullScreenLoading';

interface Branch {
  id: string;
  name: string;
  address?: string;
  contact_info?: string;
  logo_url?: string;
  is_active: boolean;
}

interface BranchContextType {
  branches: Branch[];
  selectedBranch: string | null;
  setSelectedBranch: (branchId: string | null) => void;
  isLoading: boolean;
  canManageBranches: boolean;
  canSwitchBranches: boolean;
  isHQRole: boolean;
  isSuperAdmin: boolean;
  userBranches: Branch[];
  isSwitching: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Get all branches (for admins) or user's accessible branches
  const { data: userBranches = [], isLoading } = useQuery({
    queryKey: ['user-branches', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await apiClient.getBranches();
      
      if (error) {
        console.error('Error fetching user branches:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id
  });

  // Get all branches for management purposes
  const { data: allBranches = [] } = useQuery({
    queryKey: ['all-branches'],
    queryFn: async () => {
      const { data, error } = await apiClient.getBranches();

      if (error) {
        console.error('Error fetching all branches:', error);
        return [];
      }

      return data?.filter((branch: Branch) => branch.is_active) || [];
    },
    enabled: !!user?.id  // Only fetch when user is authenticated
  });

  // Get current user's role to determine if they can manage branches
  const { data: currentUser } = useQuery({
    queryKey: ['current-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      return user; // User data is already available from auth context
    },
    enabled: !!user?.id
  });

  // Updated role-based permissions - use user directly from auth context
  const userRole = user?.role || currentUser?.role;
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'superadmin' || userRole === 'superadmin';
  const canManageBranches = isSuperAdmin;
  const canSwitchBranches = isSuperAdmin; // Only super admin can switch branches
  const isHQRole = isSuperAdmin; // Only super admin is HQ role

  // Initialize selected branch - restore from localStorage first, then set defaults
  useEffect(() => {
    if (userBranches.length === 0) return; // Wait for branches to load
    
    const savedBranch = localStorage.getItem('selectedBranch');
    
    // Priority 1: Restore valid saved branch from localStorage
    if (savedBranch === 'all' && isSuperAdmin) {
      setSelectedBranch(savedBranch);
      return;
    }
    
    if (savedBranch && userBranches.some(branch => branch.id === savedBranch)) {
      setSelectedBranch(savedBranch);
      return;
    }
    
    // Clear invalid saved branch
    if (savedBranch) {
      localStorage.removeItem('selectedBranch');
    }
    
    // Priority 2: Set defaults only if no valid saved branch and no current selection
    if (!selectedBranch) {
      if (isSuperAdmin) {
        // Super admin ALWAYS defaults to "All Branches" - this takes priority over user.branch_id
        setSelectedBranch('all');
      } else if (user?.branch_id && userBranches.some(branch => branch.id === user.branch_id)) {
        // Other users default to their assigned branch (if it exists in userBranches)
        setSelectedBranch(user.branch_id);
      } else if (userBranches.length === 1) {
        // If user has only one branch, select it
        setSelectedBranch(userBranches[0].id);
      } else if (userBranches.length > 0) {
        // If user has multiple branches, select first one
        setSelectedBranch(userBranches[0].id);
      }
    }
  }, [userBranches, isSuperAdmin, user?.branch_id]);

  // Allow super admin to choose any branch, including "all"; do not override their choice

  // Save selected branch to localStorage
  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', selectedBranch);
    }
  }, [selectedBranch]);

  const handleSetSelectedBranch = (branchId: string | null) => {
    // Don't show dialog if it's the same branch
    if (branchId === selectedBranch) return;
    
    // For super admin, allow immediate switch without confirmation dialog
    // Only show confirmation for significant data-affecting switches
    const isSignificantSwitch = selectedBranch && 
      ((selectedBranch === 'all' && branchId !== 'all') || 
       (selectedBranch !== 'all' && branchId === 'all'));
    
    if (isSuperAdmin && !isSignificantSwitch) {
      // Direct switch for super admin without confirmation
      setIsDebouncing(true);
      setIsSwitching(true);
      
      // Clear cached data for clean switch
      queryClient.invalidateQueries();
      
      // Set the new branch
      setSelectedBranch(branchId);
      
      // Reset states after brief loading
      setTimeout(() => {
        setIsSwitching(false);
        setTimeout(() => {
          setIsDebouncing(false);
        }, 300);
      }, 1000);
    } else {
      // Show confirmation dialog for significant switches or non-super-admin users
      setPendingBranchId(branchId);
      setShowConfirmDialog(true);
    }
  };

  const confirmBranchSwitch = () => {
    if (!pendingBranchId) return;
    
    setIsDebouncing(true);
    setIsSwitching(true);
    setShowConfirmDialog(false);
    
    // Aggressively clear all cached data
    queryClient.clear();
    
    // Set the new branch
    setSelectedBranch(pendingBranchId);
    setPendingBranchId(null);
    
    // Reset states after data loading
    setTimeout(() => {
      setIsSwitching(false);
      setTimeout(() => {
        setIsDebouncing(false);
      }, 500);
    }, 2000);
  };

  const cancelBranchSwitch = () => {
    setShowConfirmDialog(false);
    setPendingBranchId(null);
  };

  const value: BranchContextType = {
    branches: allBranches,
    selectedBranch,
    setSelectedBranch: handleSetSelectedBranch,
    isLoading: isLoading || isSwitching,
    canManageBranches,
    canSwitchBranches,
    isHQRole,
    isSuperAdmin,
    userBranches,
    isSwitching
  };

  return (
    <>
      <BranchContext.Provider value={value}>
        {children}
      </BranchContext.Provider>
      
      <BranchSwitchDialog
        isOpen={showConfirmDialog}
        onClose={cancelBranchSwitch}
        onConfirm={confirmBranchSwitch}
        branchName={
          pendingBranchId === 'all' 
            ? 'All Branches' 
            : allBranches?.find(b => b.id === pendingBranchId)?.name || 'Unknown Branch'
        }
      />
      
      <FullScreenLoading
        isOpen={isSwitching}
        message="Switching branch and loading fresh data..."
      />
    </>
  );
};
