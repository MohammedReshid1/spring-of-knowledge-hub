import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { ConnectionStatus as ConnectionStatusEnum } from '@/hooks/useWebSocket';

interface ConnectionStatusProps {
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  size = 'md'
}) => {
  const {
    connectionStatus,
    isConnected,
    isAuthenticated,
    connectionId,
    reconnectCount,
    reconnect
  } = useNotifications();

  const getStatusIcon = () => {
    const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
    
    switch (connectionStatus) {
      case ConnectionStatusEnum.CONNECTED:
      case ConnectionStatusEnum.AUTHENTICATED:
        return <Wifi className={`${iconSize} text-green-500`} />;
      case ConnectionStatusEnum.CONNECTING:
      case ConnectionStatusEnum.AUTHENTICATING:
        return <Loader2 className={`${iconSize} text-blue-500 animate-spin`} />;
      case ConnectionStatusEnum.RECONNECTING:
        return <RefreshCw className={`${iconSize} text-yellow-500 animate-spin`} />;
      case ConnectionStatusEnum.ERROR:
        return <AlertCircle className={`${iconSize} text-red-500`} />;
      default:
        return <WifiOff className={`${iconSize} text-gray-500`} />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case ConnectionStatusEnum.CONNECTED:
        return 'Connected';
      case ConnectionStatusEnum.AUTHENTICATED:
        return 'Live';
      case ConnectionStatusEnum.CONNECTING:
        return 'Connecting';
      case ConnectionStatusEnum.AUTHENTICATING:
        return 'Authenticating';
      case ConnectionStatusEnum.RECONNECTING:
        return `Reconnecting (${reconnectCount})`;
      case ConnectionStatusEnum.ERROR:
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case ConnectionStatusEnum.CONNECTED:
      case ConnectionStatusEnum.AUTHENTICATED:
        return 'bg-green-50 text-green-700 border-green-200';
      case ConnectionStatusEnum.CONNECTING:
      case ConnectionStatusEnum.AUTHENTICATING:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case ConnectionStatusEnum.RECONNECTING:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case ConnectionStatusEnum.ERROR:
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (!showDetails) {
    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${getStatusColor()} flex items-center gap-1`}
      >
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Badge 
          variant="outline" 
          className={`text-sm ${getStatusColor()} flex items-center gap-2`}
        >
          {getStatusIcon()}
          {getStatusText()}
        </Badge>
        
        {!isConnected && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={reconnect}
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
      
      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>Status: {getStatusText()}</div>
            <div>Auth: {isAuthenticated ? 'Yes' : 'No'}</div>
          </div>
          {connectionId && (
            <div>ID: {connectionId.slice(-8)}</div>
          )}
          {reconnectCount > 0 && (
            <div>Reconnects: {reconnectCount}</div>
          )}
        </div>
      )}
    </div>
  );
};