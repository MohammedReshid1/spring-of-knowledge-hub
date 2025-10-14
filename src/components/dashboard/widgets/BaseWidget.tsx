import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, MoreVertical, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WidgetConfig {
  id: string;
  title: string;
  icon?: LucideIcon;
  size?: 'small' | 'medium' | 'large';
  refreshInterval?: number;
  canMinimize?: boolean;
  canResize?: boolean;
  allowedRoles?: string[];
}

export interface BaseWidgetProps {
  config: WidgetConfig;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onRefresh?: () => void;
  onMinimize?: () => void;
  onResize?: (size: 'small' | 'medium' | 'large') => void;
}

export const BaseWidget: React.FC<BaseWidgetProps & { children: React.ReactNode }> = ({
  config,
  isLoading = false,
  error,
  className,
  children,
  onRefresh,
  onMinimize,
  onResize
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const Icon = config.icon;

  const sizeClasses = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-2 row-span-1',
    large: 'col-span-2 row-span-2'
  };

  return (
    <Card
      className={cn(
        // Base styling with glass morphism
        'group relative overflow-hidden bg-white/80 backdrop-blur-glass border border-white/20',
        'hover:bg-white/90 hover:border-white/30',

        // Premium transitions (shadows removed)
        '',
        'transition-all duration-normal ease-premium',

        // Transform on hover
        'hover:scale-[1.02] hover:-translate-y-1',

        // Size classes
        sizeClasses[config.size || 'medium'],

        // Animation entrance
        'animate-scale-in',

        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowActions(false);
      }}
    >
      {/* Glass morphism background overlay */}
      <div className="absolute inset-0 bg-gradient-glass opacity-50 pointer-events-none"></div>

      {/* Shimmer effect on hover */}
      <div className={cn(
        'absolute inset-0 bg-shimmer bg-[length:200%_100%] transition-opacity duration-fast pointer-events-none',
        isHovered ? 'animate-shimmer opacity-30' : 'opacity-0'
      )}></div>

      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4">
        <CardTitle className="flex items-center gap-3 text-lg font-semibold text-slate-800">
          {Icon && (
            <div className={cn(
              'p-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50',
              'transition-all duration-normal',
              isHovered && 'animate-bounce-gentle'
            )}>
              <Icon className="h-5 w-5 text-slate-600" />
            </div>
          )}
          <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            {config.title}
          </span>
        </CardTitle>

        {/* Premium Action Controls */}
        <div className="flex items-center gap-1">
          {/* Actions Menu */}
          <div className={cn(
            'flex items-center gap-1 rounded-lg bg-white/50 border border-white/30 px-2 py-1',
            'transition-all duration-fast',
            isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
          )}>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className={cn(
                  'p-1.5 rounded-md text-slate-600 hover:text-slate-800 hover:bg-slate-100',
                  'transition-all duration-fast disabled:opacity-50',
                  isLoading && 'animate-spin'
                )}
                title="Refresh"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}

            {config.canResize && onResize && (
              <button
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all duration-fast"
                title="Resize"
                onClick={() => setShowActions(!showActions)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}

            {config.canMinimize && onMinimize && (
              <button
                onClick={onMinimize}
                className="p-1.5 rounded-md text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-all duration-fast"
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Size selector dropdown */}
          {showActions && config.canResize && onResize && (
            <div className="absolute top-full right-0 mt-2 z-10 animate-scale-in">
              <div className="bg-white/95 backdrop-blur-glass border border-white/30 rounded-lg p-1">
                {['small', 'medium', 'large'].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      onResize(size as 'small' | 'medium' | 'large');
                      setShowActions(false);
                    }}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm rounded-md transition-all duration-fast',
                      'hover:bg-slate-100 hover:text-slate-800',
                      config.size === size ? 'bg-slate-200 text-slate-800 font-medium' : 'text-slate-700'
                    )}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative px-4 pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-24 space-y-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-200"></div>
              <div className="absolute top-0 h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-24 space-y-3">
            <div className="p-2 rounded-full bg-red-50 border border-red-200">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-red-600 font-medium text-center">
              {error}
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {children}
          </div>
        )}
      </CardContent>

    </Card>
  );
};