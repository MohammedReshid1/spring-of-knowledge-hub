import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BranchSwitchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  branchName: string;
}

export const BranchSwitchDialog = ({ isOpen, onClose, onConfirm, branchName }: BranchSwitchDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch Branch</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to switch to "{branchName}"? This will reload all data and may take a moment to complete.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, Switch Branch
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};