import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  submessage?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  submessage = 'Please wait while we fetch your data',
  size = 'md',
  fullScreen = true,
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  const textSizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const submessageSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const LoadingContent = () => (
    <div className="text-center">
      <div className="relative mb-6 inline-block">
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
        <Loader2
          className={`${sizeClasses[size]} text-blue-600 animate-spin relative z-10`}
        />
      </div>
      <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-glass border border-white/30 shadow-premium inline-block">
        <p
          className={`text-slate-700 font-semibold ${textSizeClasses[size]} mb-2`}
        >
          {message}
        </p>
        <p className={`text-slate-500 ${submessageSizeClasses[size]}`}>
          {submessage}
        </p>
      </div>
    </div>
  );

  if (!fullScreen) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingContent />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Premium Loading Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-100/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-blue-500/6 to-indigo-500/8 animate-gradient-shift bg-[length:400%_400%] pointer-events-none" />
      </div>

      <div className="relative z-10 flex items-center justify-center h-screen">
        <LoadingContent />
      </div>
    </div>
  );
};
