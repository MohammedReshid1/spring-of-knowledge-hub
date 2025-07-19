import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const getToken = () => localStorage.getItem('token');

export const BranchManagement = () => {
  const queryClient = useQueryClient();
  const [editingBranch, setEditingBranch] = useState(null);

  // Fetch branches
  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/branches', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch branches');
      return res.json();
    },
  });

  // Create branch
  const createBranchMutation = useMutation({
    mutationFn: async (branchData: any) => {
      const token = getToken();
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create branch');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Branch created successfully.' });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: `Failed to create branch: ${error.message}`, variant: 'destructive' });
    },
  });

  // Update branch
  const updateBranchMutation = useMutation({
    mutationFn: async ({ id, branchData }: { id: string; branchData: any }) => {
      const token = getToken();
      const res = await fetch(`/api/branches/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update branch');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Branch updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setEditingBranch(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: `Failed to update branch: ${error.message}`, variant: 'destructive' });
    },
  });

  // Delete branch
  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const token = getToken();
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete branch');
      }
      return true;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Branch deleted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: `Failed to delete branch: ${error.message}`, variant: 'destructive' });
    },
  });

  // ...rest of the component (UI, handlers, etc.)
  // Use branches, isLoading, createBranchMutation, updateBranchMutation, deleteBranchMutation
  return null; // Replace with your actual JSX/UI
};