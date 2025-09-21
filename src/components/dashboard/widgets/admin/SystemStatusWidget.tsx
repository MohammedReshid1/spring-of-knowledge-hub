import React, { useState, useEffect } from 'react';
import { Activity, Database, Wifi, Shield, AlertTriangle, CheckCircle, Clock, Zap, Server, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
import { cn } from '@/lib/utils';

interface SystemStatus {
  database: 'online' | 'offline' | 'degraded';
  realtime: 'active' | 'inactive' | 'error';
  security: 'secure' | 'warning' | 'alert';
  performance: 'good' | 'slow' | 'critical';
  lastUpdate: Date;
}

export const SystemStatusWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useSystemStatus } = useWidgetData();
  const { data: statusData, isLoading, error } = useSystemStatus();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  // Update time every second for live uptime
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Premium Uptime Loading */}
        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50 overflow-hidden">
          <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer"></div>
          <div className="relative text-center space-y-2">
            <div className="w-8 h-8 bg-emerald-200 rounded-xl mx-auto animate-pulse"></div>
            <div className="w-24 h-6 bg-emerald-200 rounded mx-auto animate-pulse"></div>
            <div className="w-20 h-3 bg-emerald-200 rounded mx-auto animate-pulse"></div>
          </div>
        </div>

        {/* Premium Status Loading */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse"></div>
                  <div className="w-16 h-4 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="w-12 h-5 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/50">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <Server className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-600">Failed to load system status</p>
        </div>
      </div>
    );
  }

  const status = statusData || {
    database: 'online',
    realtime: 'active',
    security: 'secure',
    performance: 'good',
    lastUpdate: new Date(),
    uptime: 86400
  };

  // Format uptime with live calculation
  const formatUptime = (seconds: number) => {
    const currentSeconds = Math.floor(Date.now() / 1000);
    const uptimeSeconds = seconds + Math.floor((Date.now() - new Date(status.lastUpdate).getTime()) / 1000);

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusConfig = (statusType: string, statusValue: string) => {
    const configs: { [key: string]: { [key: string]: any } } = {
      database: {
        online: {
          gradient: 'from-emerald-500 to-green-500',
          bgGradient: 'from-emerald-50 to-green-50',
          borderColor: 'border-emerald-200/50',
          textColor: 'text-emerald-700',
          icon: Database,
          badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200/50',
          status: 'Online'
        },
        degraded: {
          gradient: 'from-amber-500 to-orange-500',
          bgGradient: 'from-amber-50 to-orange-50',
          borderColor: 'border-amber-200/50',
          textColor: 'text-amber-700',
          icon: Database,
          badgeColor: 'bg-amber-100 text-amber-700 border-amber-200/50',
          status: 'Degraded'
        },
        offline: {
          gradient: 'from-red-500 to-rose-500',
          bgGradient: 'from-red-50 to-rose-50',
          borderColor: 'border-red-200/50',
          textColor: 'text-red-700',
          icon: Database,
          badgeColor: 'bg-red-100 text-red-700 border-red-200/50',
          status: 'Offline'
        }
      },
      realtime: {
        active: {
          gradient: 'from-blue-500 to-indigo-500',
          bgGradient: 'from-blue-50 to-indigo-50',
          borderColor: 'border-blue-200/50',
          textColor: 'text-blue-700',
          icon: Wifi,
          badgeColor: 'bg-blue-100 text-blue-700 border-blue-200/50',
          status: 'Active'
        },
        inactive: {
          gradient: 'from-amber-500 to-orange-500',
          bgGradient: 'from-amber-50 to-orange-50',
          borderColor: 'border-amber-200/50',
          textColor: 'text-amber-700',
          icon: Wifi,
          badgeColor: 'bg-amber-100 text-amber-700 border-amber-200/50',
          status: 'Inactive'
        },
        error: {
          gradient: 'from-red-500 to-rose-500',
          bgGradient: 'from-red-50 to-rose-50',
          borderColor: 'border-red-200/50',
          textColor: 'text-red-700',
          icon: Wifi,
          badgeColor: 'bg-red-100 text-red-700 border-red-200/50',
          status: 'Error'
        }
      },
      security: {
        secure: {
          gradient: 'from-green-500 to-emerald-500',
          bgGradient: 'from-green-50 to-emerald-50',
          borderColor: 'border-green-200/50',
          textColor: 'text-green-700',
          icon: Shield,
          badgeColor: 'bg-green-100 text-green-700 border-green-200/50',
          status: 'Secure'
        },
        warning: {
          gradient: 'from-amber-500 to-orange-500',
          bgGradient: 'from-amber-50 to-orange-50',
          borderColor: 'border-amber-200/50',
          textColor: 'text-amber-700',
          icon: Shield,
          badgeColor: 'bg-amber-100 text-amber-700 border-amber-200/50',
          status: 'Warning'
        },
        alert: {
          gradient: 'from-red-500 to-rose-500',
          bgGradient: 'from-red-50 to-rose-50',
          borderColor: 'border-red-200/50',
          textColor: 'text-red-700',
          icon: Shield,
          badgeColor: 'bg-red-100 text-red-700 border-red-200/50',
          status: 'Alert'
        }
      },
      performance: {
        good: {
          gradient: 'from-cyan-500 to-blue-500',
          bgGradient: 'from-cyan-50 to-blue-50',
          borderColor: 'border-cyan-200/50',
          textColor: 'text-cyan-700',
          icon: Zap,
          badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200/50',
          status: 'Good'
        },
        slow: {
          gradient: 'from-amber-500 to-orange-500',
          bgGradient: 'from-amber-50 to-orange-50',
          borderColor: 'border-amber-200/50',
          textColor: 'text-amber-700',
          icon: Zap,
          badgeColor: 'bg-amber-100 text-amber-700 border-amber-200/50',
          status: 'Slow'
        },
        critical: {
          gradient: 'from-red-500 to-rose-500',
          bgGradient: 'from-red-50 to-rose-50',
          borderColor: 'border-red-200/50',
          textColor: 'text-red-700',
          icon: Zap,
          badgeColor: 'bg-red-100 text-red-700 border-red-200/50',
          status: 'Critical'
        }
      }
    };
    return configs[statusType]?.[statusValue];
  };

  const isSystemHealthy = [status.database, status.realtime, status.security, status.performance].every(s =>
    ['online', 'active', 'secure', 'good'].includes(s)
  );

  const systemServices = [
    { key: 'database', label: 'Database', value: status.database },
    { key: 'realtime', label: 'Real-time', value: status.realtime },
    { key: 'security', label: 'Security', value: status.security },
    { key: 'performance', label: 'Performance', value: status.performance }
  ];

  return (
    <div className="space-y-6">
      {/* Premium System Uptime Display */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border border-emerald-200/50 overflow-hidden group">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/20 to-emerald-200/20 rounded-full -translate-y-16 translate-x-16"></div>

        <div className="relative text-center space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50 group-hover:shadow-glow-green transition-all duration-normal">
            <Activity className="h-6 w-6 text-emerald-600 animate-pulse-glow" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              {formatUptime(status.uptime)}
            </div>
            <div className="text-sm font-semibold text-emerald-700">System Uptime</div>
            <div className="text-xs text-emerald-600">
              Running since {new Date(Date.now() - (status.uptime * 1000)).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Status Services Grid */}
      <div className="space-y-3">
        {systemServices.map((service, index) => {
          const config = getStatusConfig(service.key, service.value);
          const isHovered = hoveredStatus === service.key;
          const Icon = config?.icon || Monitor;

          return (
            <div
              key={service.key}
              className={cn(
                'group relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-normal ease-premium',
                'hover:scale-[1.02] hover:-translate-y-0.5',
                config?.bgGradient,
                config?.borderColor,
                isHovered && 'shadow-premium'
              )}
              onMouseEnter={() => setHoveredStatus(service.key)}
              onMouseLeave={() => setHoveredStatus(null)}
              style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both'
              }}
            >
              {/* Background gradient overlay */}
              <div className={cn(
                'absolute inset-0 bg-gradient-to-r opacity-0 rounded-xl transition-opacity duration-normal',
                config?.gradient,
                isHovered && 'opacity-5'
              )}></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2.5 rounded-lg transition-all duration-normal',
                    service.value === 'online' || service.value === 'active' || service.value === 'secure' || service.value === 'good'
                      ? 'animate-pulse-glow' : '',
                    isHovered && 'animate-bounce-gentle'
                  )}>
                    <Icon className={cn('h-5 w-5', config?.textColor)} />
                  </div>
                  <span className={cn('text-sm font-semibold', config?.textColor)}>
                    {service.label}
                  </span>
                </div>

                <Badge className={cn('font-semibold px-3 py-1', config?.badgeColor)}>
                  {config?.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Premium Overall Status Display */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200/50 overflow-hidden">
        <div className="relative text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 text-slate-600" />
            <span className="text-xs text-slate-600 font-medium">
              Last checked: {new Date(status.lastUpdate).toLocaleTimeString()}
            </span>
          </div>

          <div className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-normal',
            isSystemHealthy
              ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200/50 shadow-glow-green'
              : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200/50'
          )}>
            {isSystemHealthy ? (
              <CheckCircle className="h-4 w-4 animate-pulse-glow" />
            ) : (
              <AlertTriangle className="h-4 w-4 animate-pulse-glow" />
            )}
            {isSystemHealthy ? 'All Systems Operational' : 'System Issues Detected'}
          </div>
        </div>
      </div>
    </div>
  );
};