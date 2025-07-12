import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      
      const { data, error } = await supabase
        .rpc('get_user_accessible_branches', { user_id: user.id });
      
      if (error) {
        console.error('Error fetching user branches:', error);
        return [];
      }
      
      return data.map((item: any) => ({
        id: item.branch_id,
        name: item.branch_name,
        is_active: true // All returned branches are active
      }));
    },
    enabled: !!user?.id
  });

  // Get all branches for management purposes
  const { data: allBranches = [] } = useQuery({
    queryKey: ['all-branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching all branches:', error);
        return [];
      }
      
      return data;
    }
  });

  // Get current user's role to determine if they can manage branches
  const { data: currentUser } = useQuery({
    queryKey: ['current-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('users')
        .select('role, branch_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching current user:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id
  });

  // Updated role-based permissions
  const canManageBranches = currentUser?.role === 'super_admin' || currentUser?.role === 'hq_admin';
  const canSwitchBranches = currentUser?.role === 'super_admin' || currentUser?.role === 'hq_admin' || currentUser?.role === 'hq_registrar';
  const isHQRole = currentUser?.role === 'super_admin' || currentUser?.role === 'hq_admin' || currentUser?.role === 'hq_registrar';

  // Set default selected branch when user branches load
  useEffect(() => {
    if (!selectedBranch && userBranches.length > 0) {
      // HQ roles with multiple branches default to "all"
      if (isHQRole && userBranches.length > 1) {
        setSelectedBranch('all');
      } else {
        // Branch-restricted roles or single branch users select their branch
        setSelectedBranch(userBranches[0]?.id || null);
      }
    }
  }, [userBranches, isHQRole, selectedBranch]);

  // Restore selected branch from localStorage
  useEffect(() => {
    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch && userBranches.some(branch => branch.id === savedBranch)) {
      setSelectedBranch(savedBranch);
    }
  }, [userBranches]);

  // Save selected branch to localStorage
  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', selectedBranch);
    }
  }, [selectedBranch]);

  const handleSetSelectedBranch = (branchId: string | null) => {
    // Prevent rapid successive switches
    if (isDebouncing || isSwitching) return;
    
    // Don't show dialog if it's the same branch
    if (branchId === selectedBranch) return;
    
    // Show confirmation dialog for branch switch
    setPendingBranchId(branchId);
    setShowConfirmDialog(true);
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
