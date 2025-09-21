import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, DollarSign, TrendingUp, Eye, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
import { cn } from '@/lib/utils';

export const PaymentCollectionWidget: React.FC<WidgetProps> = ({ config }) => {
  const { usePaymentCollection, useAdminStats } = useWidgetData();
  const { data: paymentData, isLoading, error } = usePaymentCollection();
  const { data: overviewData } = useAdminStats();
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  // Get currency from system settings
  const getCurrency = () => {
    const settings = localStorage.getItem('systemSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.currency || 'ETB';
    }
    return 'ETB';
  };

  const formatCurrency = (amount: number) => {
    const currency = getCurrency();
    const symbols = {
      'ETB': 'ETB',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    const symbol = symbols[currency as keyof typeof symbols] || currency;

    if (currency === 'ETB') {
      return `${amount.toFixed(2)} ${symbol}`;
    }
    return `${symbol} ${amount.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Premium Revenue Loading */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50 overflow-hidden">
          <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer"></div>
          <div className="relative text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-200 rounded-xl mx-auto animate-pulse"></div>
            <div className="w-24 h-8 bg-emerald-200 rounded mx-auto animate-pulse"></div>
            <div className="w-20 h-4 bg-emerald-200 rounded mx-auto animate-pulse"></div>
          </div>
        </div>

        {/* Payment Status Loading */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse"></div>
                  <div className="w-16 h-4 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="w-8 h-6 bg-slate-200 rounded animate-pulse"></div>
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
            <CreditCard className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-600">Failed to load payment data</p>
        </div>
      </div>
    );
  }

  const financial = paymentData || {
    paid_count: 0,
    unpaid_count: 0,
    pending_count: 0,
    payment_completion_rate: 0,
    total_revenue: 0
  };

  const overview = overviewData?.overview || {
    total_revenue: financial.total_revenue || 0
  };

  const totalPayments = financial.paid_count + financial.unpaid_count + financial.pending_count;
  const collectionRate = Math.round(financial.payment_completion_rate);

  const paymentStatuses = [
    {
      id: 'paid',
      icon: CheckCircle,
      label: 'Paid',
      count: financial.paid_count,
      percentage: totalPayments > 0 ? Math.round((financial.paid_count / totalPayments) * 100) : 0,
      gradient: 'from-emerald-500 to-green-500',
      bgGradient: 'from-emerald-50 to-green-50',
      borderColor: 'border-emerald-200/50',
      textColor: 'text-emerald-700',
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200/50',
    },
    {
      id: 'pending',
      icon: AlertCircle,
      label: 'Pending',
      count: financial.pending_count,
      percentage: totalPayments > 0 ? Math.round((financial.pending_count / totalPayments) * 100) : 0,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      borderColor: 'border-amber-200/50',
      textColor: 'text-amber-700',
      badgeColor: 'bg-amber-100 text-amber-700 border-amber-200/50',
    },
    {
      id: 'unpaid',
      icon: AlertCircle,
      label: 'Unpaid',
      count: financial.unpaid_count,
      percentage: totalPayments > 0 ? Math.round((financial.unpaid_count / totalPayments) * 100) : 0,
      gradient: 'from-red-500 to-rose-500',
      bgGradient: 'from-red-50 to-rose-50',
      borderColor: 'border-red-200/50',
      textColor: 'text-red-700',
      badgeColor: 'bg-red-100 text-red-700 border-red-200/50',
    }
  ];

  return (
    <div className="space-y-6">
      {/* Premium Revenue Display */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border border-emerald-200/50 overflow-hidden group">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/20 to-emerald-200/20 rounded-full -translate-y-16 translate-x-16"></div>

        <div className="relative text-center space-y-4">
          {/* Premium Currency Icon */}
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50 group-hover:shadow-glow-green transition-all duration-normal">
            <DollarSign className="h-8 w-8 text-emerald-600 animate-bounce-gentle" />
          </div>

          {/* Revenue Amount */}
          <div className="space-y-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              {formatCurrency(overview.total_revenue)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Total Revenue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Payment Status Breakdown */}
      <div className="space-y-3">
        {paymentStatuses.map((status, index) => {
          const Icon = status.icon;
          const isHovered = hoveredStatus === status.id;

          return (
            <div
              key={status.id}
              className={cn(
                'group relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-normal ease-premium',
                'hover:scale-[1.02] hover:-translate-y-0.5',
                status.bgGradient,
                status.borderColor,
                isHovered && 'shadow-premium'
              )}
              onMouseEnter={() => setHoveredStatus(status.id)}
              onMouseLeave={() => setHoveredStatus(null)}
              style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both'
              }}
            >
              {/* Background gradient overlay */}
              <div className={cn(
                'absolute inset-0 bg-gradient-to-r opacity-0 rounded-xl transition-opacity duration-normal',
                status.gradient,
                isHovered && 'opacity-5'
              )}></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg transition-all duration-normal',
                    isHovered && 'animate-bounce-gentle'
                  )}>
                    <Icon className={cn('h-5 w-5', status.textColor)} />
                  </div>
                  <div className="space-y-1">
                    <span className={cn('text-sm font-semibold', status.textColor)}>
                      {status.label}
                    </span>
                    <div className="text-xs text-slate-500">
                      {status.percentage}% of total
                    </div>
                  </div>
                </div>

                <Badge className={cn('font-semibold px-3 py-1', status.badgeColor)}>
                  {status.count.toLocaleString()}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Premium Collection Rate */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-700">Collection Rate</span>
            </div>
            <div className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              {collectionRate}%
            </div>
          </div>

          {/* Premium Progress Bar */}
          <div className="relative">
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-slow ease-premium"
                style={{ width: `${collectionRate}%` }}
              >
                <div className="h-full bg-shimmer bg-[length:200%_100%] animate-shimmer opacity-30"></div>
              </div>
            </div>
            <div className="absolute inset-0 h-3 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Premium Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/payments?filter=pending"
          className="group flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium transition-all duration-normal hover:scale-105 hover:shadow-glow-orange"
        >
          <Eye className="h-4 w-4 transition-transform duration-normal group-hover:scale-110" />
          View Pending
        </Link>
        <Link
          to="/payments?tab=dashboard"
          className="group flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium transition-all duration-normal hover:scale-105 hover:shadow-glow-blue"
        >
          <BarChart3 className="h-4 w-4 transition-transform duration-normal group-hover:scale-110" />
          Dashboard
        </Link>
      </div>
    </div>
  );
};
