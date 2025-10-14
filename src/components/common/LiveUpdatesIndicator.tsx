import React from 'react';

interface LiveUpdatesIndicatorProps {
  /**
   * Whether the WebSocket is connected
   * @default true - shows as connected by default
   */
  isConnected?: boolean;

  /**
   * Show full text label or just the dot indicator
   * @default 'auto' - shows text on larger screens, dot only on mobile
   */
  displayMode?: 'full' | 'icon-only' | 'auto';

  /**
   * Size variant
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg';

  /**
   * Custom className for additional styling
   */
  className?: string;
}

/**
 * Live Updates Indicator Component
 *
 * Shows the real-time WebSocket connection status with a pulsing dot animation.
 * Designed to be used in management pages to indicate live data synchronization.
 *
 * @example
 * ```tsx
 * // Default usage - shows connected state with auto responsive display
 * <LiveUpdatesIndicator />
 *
 * // With connection status
 * <LiveUpdatesIndicator isConnected={wsConnected} />
 *
 * // Icon only mode for compact spaces
 * <LiveUpdatesIndicator displayMode="icon-only" size="sm" />
 * ```
 */
export const LiveUpdatesIndicator: React.FC<LiveUpdatesIndicatorProps> = ({
  isConnected = true,
  displayMode = 'auto',
  size = 'default',
  className = ''
}) => {
  // Size classes
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs gap-1.5',
      dot: 'w-1.5 h-1.5',
      text: 'text-xs'
    },
    default: {
      container: 'px-3 py-1 text-xs gap-2',
      dot: 'w-2 h-2',
      text: 'text-xs'
    },
    lg: {
      container: 'px-4 py-2 text-sm gap-2',
      dot: 'w-2.5 h-2.5',
      text: 'text-sm'
    }
  };

  const sizes = sizeClasses[size];

  // Status colors
  const statusColors = isConnected
    ? {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      }
    : {
        bg: 'bg-gray-50',
        text: 'text-gray-500',
        border: 'border-gray-200',
        dot: 'bg-gray-400'
      };

  // Display mode classes
  const textDisplayClass = displayMode === 'full'
    ? 'inline'
    : displayMode === 'icon-only'
    ? 'hidden'
    : 'hidden sm:inline'; // auto mode

  return (
    <div
      className={`
        flex items-center rounded-md border
        ${sizes.container}
        ${statusColors.bg}
        ${statusColors.text}
        ${statusColors.border}
        ${className}
      `}
      title={isConnected ? 'Live updates active' : 'Live updates disconnected'}
      role="status"
      aria-live="polite"
      aria-label={isConnected ? 'Live updates active' : 'Live updates disconnected'}
    >
      <div
        className={`
          ${sizes.dot}
          rounded-full
          ${statusColors.dot}
          ${isConnected ? 'animate-pulse' : ''}
        `}
        aria-hidden="true"
      />
      <span className={`${textDisplayClass} ${sizes.text} font-medium`}>
        {isConnected ? 'Live Updates' : 'Offline'}
      </span>
      {displayMode === 'icon-only' && (
        <span className="sr-only">
          {isConnected ? 'Live updates active' : 'Live updates disconnected'}
        </span>
      )}
    </div>
  );
};

export default LiveUpdatesIndicator;
