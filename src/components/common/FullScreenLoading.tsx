import React from 'react';
import { Loader2 } from 'lucide-react';

interface FullScreenLoadingProps {
  isOpen: boolean;
  message?: string;
}

export const FullScreenLoading = ({ isOpen, message = "Loading..." }: FullScreenLoadingProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center space-y-4 min-w-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Switching Branch</h3>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
};