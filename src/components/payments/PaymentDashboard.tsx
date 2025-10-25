import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  Eye,
  Download,
  Filter,
  Activity,
  BarChart2,
  PieChart as PieChartIcon,
  Settings,
  ExternalLink
} from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { Payment } from '@/types/api';
import { useCurrency } from '@/hooks/useSystemSettings';
import { formatCurrency as formatCurrencyUtil, getCurrencySymbol } from '@/utils/currency';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

interface PaymentDashboardProps {
  onCreatePayment?: () => void;
  onViewPayments?: () => void;
  onViewReports?: () => void;
}

export function PaymentDashboard({
  onCreatePayment,
  onViewPayments,
  onViewReports
}: PaymentDashboardProps) {
  const { selectedBranch } = useBranch();
  const { isAuthenticated, user } = useAuth();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();
  const currency = useCurrency();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch && isAuthenticated; // only allow queries when authenticated
  const [dateRange, setDateRange] = useState('30'); // days

  // Parent detection and filtering
  const isParent = user?.role === 'parent';
  const parentId = (user as any)?.parent_id;

  // Enable real-time updates for payment dashboard - replaces 30s polling
  useLiveData(['payments', 'students', 'fees', 'payment-categories'], {
    additionalQueryKeys: ['payment-dashboard-stats', 'recent-payments', 'payments-dashboard-range']
  });

  // Permission checks
  const canRead = isSuperSuperAdmin || hasPermission('payment.read');
  const canCreate = isSuperSuperAdmin || hasPermission('payment.create');

  // Calculate date range
  const endDate = new Date();
  const startDate = subDays(endDate, parseInt(dateRange));
  const prevRangeDays = Math.max(1, parseInt(dateRange));
  const prevEndDate = subDays(startDate, 1);
  const prevStartDate = subDays(prevEndDate, prevRangeDays);

  // Fetch dashboard statistics
  const { data: dashboardStats, isLoading: statsLoading, refetch: refetchStats, isFetching: statsRefreshing } = useQuery({
    queryKey: ['payment-dashboard-stats', branchId ?? 'all', dateRange],
    queryFn: async () => {
      // Ensure token is set on apiClient before making request
      const token = localStorage.getItem('auth_token');
      if (token && !(apiClient as any).token) {
        apiClient.setToken(token);
      }

      return apiClient.getPaymentStatsForDashboard({
        parent_id: isParent && parentId ? parentId : undefined,
        branch_id: branchId,
        date_from: format(startDate, 'yyyy-MM-dd'),
        date_to: format(endDate, 'yyyy-MM-dd'),
        // @ts-expect-error allow backend flexibility
        start_date: format(startDate, 'yyyy-MM-dd'),
        // @ts-expect-error allow backend flexibility
        end_date: format(endDate, 'yyyy-MM-dd'),
      } as any);
    },
    enabled: enableQueries,
    refetchInterval: 30000, // Refresh every 30 seconds
    select: (resp) => (resp as any).data?.data ?? (resp as any).data,
  });

  // Fetch previous period statistics for deltas
  const { data: prevStats } = useQuery({
    queryKey: ['payment-dashboard-stats-prev', branchId ?? 'all', dateRange],
    queryFn: async () => {
      // Ensure token is set on apiClient before making request
      const token = localStorage.getItem('auth_token');
      if (token && !(apiClient as any).token) {
        apiClient.setToken(token);
      }

      return apiClient.getPaymentStatsForDashboard({
        parent_id: isParent && parentId ? parentId : undefined,
        branch_id: branchId,
        date_from: format(prevStartDate, 'yyyy-MM-dd'),
        date_to: format(prevEndDate, 'yyyy-MM-dd'),
        // @ts-expect-error allow backend flexibility
        start_date: format(prevStartDate, 'yyyy-MM-dd'),
        // @ts-expect-error allow backend flexibility
        end_date: format(prevEndDate, 'yyyy-MM-dd'),
      } as any);
    },
    enabled: enableQueries,
    select: (resp) => (resp as any).data?.data ?? (resp as any).data,
    refetchInterval: 30000,
  });

  // Fetch recent payments
  const { data: recentPayments = [], isLoading: paymentsLoading, refetch: refetchPayments, isFetching: paymentsRefreshing } = useQuery({
    queryKey: ['recent-payments', branchId ?? 'all'],
    queryFn: async () => {
      // Ensure token is set on apiClient before making request
      const token = localStorage.getItem('auth_token');
      if (token && !(apiClient as any).token) {
        apiClient.setToken(token);
      }

      return apiClient.getPayments({
        parent_id: isParent && parentId ? parentId : undefined,
        branch_id: branchId,
        limit: 9,
        skip: 0,
      });
    },
    enabled: enableQueries,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    select: (resp) => {
      const d: any = (resp as any).data;
      if (Array.isArray(d)) return d;
      // Handle new pagination format
      return d?.payments || d?.data || d?.items || [];
    },
  });

  // Fetch payments for the selected date range to drive charts (aggregate pages with limit<=500)
  const { data: rangePayments = [], isLoading: rangeLoading } = useQuery({
    queryKey: ['payments-dashboard-range', branchId ?? 'all', dateRange],
    queryFn: async () => {
      // Ensure token is set on apiClient before making request
      const token = localStorage.getItem('auth_token');
      if (token && !(apiClient as any).token) {
        apiClient.setToken(token);
      }

      const limit = 500;
      let skip = 0;
      let all: Payment[] = [];
      while (true) {
        const resp = await apiClient.getPayments({
          parent_id: isParent && parentId ? parentId : undefined,
          branch_id: branchId,
          date_from: format(startDate, 'yyyy-MM-dd'),
          date_to: format(endDate, 'yyyy-MM-dd'),
          // Also include alternative names some backends expect
          // @ts-expect-error pass-through additional params
          start_date: format(startDate, 'yyyy-MM-dd'),
          // @ts-expect-error pass-through additional params
          end_date: format(endDate, 'yyyy-MM-dd'),
          limit,
          skip,
        } as any);
        const d: any = resp.data;
        // Handle new pagination format
        const page: Payment[] = d?.payments || d?.data || d?.items || d?.results || (Array.isArray(d) ? d : []);
        const total: number | undefined = d?.total ?? d?.count;
        all = all.concat(page);
        if ((typeof total === 'number' && all.length >= total) || page.length < limit) break;
        // Safety cap to avoid excessive requests; adjust as needed
        if (all.length >= 2000) break;
        skip += page.length;
      }
      return all;
    },
    enabled: enableQueries,
    refetchInterval: 30000,
  });

  // Prepare chart data from real payments
  const methodColor: Record<string, string> = {
    cash: COLORS[0],
    card: COLORS[1],
    bank_transfer: COLORS[2],
    'bank transfer': COLORS[2],
    online: COLORS[3],
    cheque: COLORS[4],
    check: COLORS[4], // Same color as cheque
    mobile_money: COLORS[5], // Light green - distinct from cash
    'mobile money': COLORS[5],
  };

  const paymentMethodData = Object.values(
    rangePayments.reduce((acc: Record<string, { name: string; value: number; amount: number; fill: string }>, p: Payment) => {
      const raw = ((p as any).payment_method ?? (p as any).method ?? (p as any).paymentMode ?? 'unknown').toString().toLowerCase();
      const key = raw;
      // Standardize payment method names
      const methodNameMap: Record<string, string> = {
        'cheque': 'Check',
        'check': 'Check',
        'cash': 'Cash',
        'card': 'Card',
        'bank_transfer': 'Bank Transfer',
        'bank transfer': 'Bank Transfer',
        'mobile_money': 'Mobile Money',
        'mobile money': 'Mobile Money'
      };
      const name = methodNameMap[key] || key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const color = methodColor[key] || '#94a3b8';
      if (!acc[key]) acc[key] = { name, value: 0, amount: 0, fill: color };
      acc[key].value += 1;
      const paymentAmount = parseFloat((p as any).amount) || parseFloat((p as any).total_amount) || parseFloat((p as any).paid_amount) || 0;
      acc[key].amount += paymentAmount;
      return acc;
    }, {})
  );

  const monthlyTrendData = dashboardStats?.monthly_collection_trend?.map((item) => ({
    month: item.month,
    amount: item.amount,
    count: item.payment_count,
  })) || [];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; icon?: React.ReactNode }> = {
      completed: {
        className: "px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-blue-100 text-blue-700 border border-blue-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200",
        icon: <CheckCircle className="h-3 w-3 mr-1" />
      },
      pending: {
        className: "px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200",
        icon: <Clock className="h-3 w-3 mr-1" />
      },
      cancelled: {
        className: "px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-red-100 to-pink-100 text-red-700 border border-red-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200",
        icon: <AlertCircle className="h-3 w-3 mr-1" />
      },
      refunded: {
        className: "px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200"
      },
      partial: {
        className: "px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200"
      }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={config.className}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentStudentName = (p: any) => {
    // Prefer nested student fields: first_name + father_name + grandfather_name
    if (p?.student) {
      const first = p.student.first_name || '';
      const father = p.student.father_name || '';
      const grand = p.student.grandfather_name || '';
      const full = [first, father, grand].filter(Boolean).join(' ').trim();
      if (full) return full;
    }
    // Flat fields commonly returned by some endpoints
    const first = p?.student_first_name || p?.first_name || '';
    const father = p?.student_father_name || p?.father_name || '';
    const grand = p?.student_grandfather_name || p?.grandfather_name || '';
    const combined = [first, father, grand].filter(Boolean).join(' ').trim();
    if (combined) return combined;
    // Fallbacks
    if (p?.student_name) return p.student_name;
    return 'Unknown Student';
  };

  const getPaymentStudentInitials = (p: any) => {
    const s = p?.student || {};
    const first = s.first_name || p?.student_first_name || p?.first_name || '';
    const father = s.father_name || p?.student_father_name || p?.father_name || '';
    const grand = s.grandfather_name || p?.student_grandfather_name || p?.grandfather_name || '';
    const initials = [first, father, grand].map((n) => (n && typeof n === 'string' ? n.charAt(0) : '')).filter(Boolean);
    const safe = (initials.join('') || 'UN').slice(0, 2);
    return safe;
  };

  const getPaymentCategoryName = (p: any) => {
    return p?.fee_category?.name || p?.fee_category_name || p?.category_name || 'Unknown Category';
  };

  const getPaymentDate = (p: any, fmt: string = 'MMM dd') => {
    const raw = p?.payment_date || p?.date || p?.created_at || p?.updated_at;
    try {
      return raw ? format(parseISO(raw), fmt) : '';
    } catch {
      return '';
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, currency);
  };

  const exportDashboardData = () => {
    if (!dashboardStats) return;

    const data = {
      period: `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
      branch: selectedBranch === 'all' ? 'All Branches' : selectedBranch,
      total_collection: dashboardStats.total_amount_collected,
      total_payments: dashboardStats.total_payments,
      pending_amount: dashboardStats.pending_amount,
      collection_rate: dashboardStats.collection_rate,
      top_categories: dashboardStats.top_fee_categories,
      monthly_trend: dashboardStats.monthly_collection_trend,
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-dashboard-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              {isParent ? "My Children's Payment Summary" : "Payment Dashboard"}
            </h2>
            <p className="text-lg text-gray-600 mt-2">
              {isParent
                ? "Track your children's payment history and status"
                : "Overview of payment activities and financial metrics"
              }
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <LiveUpdatesIndicator />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border-0 bg-gray-100/80 backdrop-blur-sm rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
            {!isParent && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportDashboardData}
                disabled={!dashboardStats}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Premium Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">
                {isParent ? "Total Paid" : "Total Collection"}
              </p>
              {statsLoading ? (
                <div className="h-8 w-24 bg-white/20 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold mb-2">
                  {formatCurrency(dashboardStats?.total_amount_collected || 0)}
                </p>
              )}
              {(() => {
                const current = dashboardStats?.total_amount_collected || 0;
                const previous = prevStats?.total_amount_collected || 0;
                const change = getPercentageChange(current, previous);
                const positive = change >= 0;
                const Icon = positive ? TrendingUp : TrendingDown;
                return (
                  <div className="flex items-center text-xs text-emerald-100">
                    <Icon className={`h-3 w-3 mr-1 ${positive ? 'text-green-200' : 'text-red-200'}`} />
                    <span className={positive ? 'text-green-200' : 'text-red-200'}>
                      {change.toFixed(1)}%
                    </span>
                    <span className="ml-1">from last period</span>
                  </div>
                );
              })()}
            </div>
            <div className="p-3 bg-white/10 rounded-full">
              <DollarSign className="h-8 w-8" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-300 to-green-400" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium mb-1">
                {isParent ? "Number of Payments" : "Total Payments"}
              </p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-white/20 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold mb-2">
                  {dashboardStats?.total_payments || 0}
                </p>
              )}
              {(() => {
                const current = dashboardStats?.total_payments || 0;
                const previous = prevStats?.total_payments || 0;
                const change = getPercentageChange(current, previous);
                const positive = change >= 0;
                const Icon = positive ? TrendingUp : TrendingDown;
                return (
                  <div className="flex items-center text-xs text-teal-100">
                    <Icon className={`h-3 w-3 mr-1 ${positive ? 'text-teal-200' : 'text-red-200'}`} />
                    <span className={positive ? 'text-teal-200' : 'text-red-200'}>
                      {change.toFixed(1)}%
                    </span>
                    <span className="ml-1">from last period</span>
                  </div>
                );
              })()}
            </div>
            <div className="p-3 bg-white/10 rounded-full">
              <FileText className="h-8 w-8" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-300 to-cyan-400" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">
                {isParent ? "Amount Due" : "Pending Amount"}
              </p>
              {statsLoading ? (
                <div className="h-8 w-20 bg-white/20 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold mb-2">
                  {formatCurrency(dashboardStats?.pending_amount || 0)}
                </p>
              )}
              <p className="text-xs text-orange-100">
                {dashboardStats?.pending_payments || 0} {isParent ? "unpaid fees" : "pending payments"}
              </p>
            </div>
            <div className="p-3 bg-white/10 rounded-full">
              <Clock className="h-8 w-8" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-300 to-amber-400" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium mb-1">
                {isParent ? "Payment Status" : "Collection Rate"}
              </p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-white/20 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold mb-2">
                  {dashboardStats?.collection_rate?.toFixed(1) || '0.0'}%
                </p>
              )}
              <p className="text-xs text-purple-100">
                Average: {formatCurrency(dashboardStats?.average_payment_amount || 0)}/payment
              </p>
            </div>
            <div className="p-3 bg-white/10 rounded-full">
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-300 to-violet-400" />
        </div>
      </div>

      {/* Premium Action Buttons - Hidden for parents */}
      {!isParent && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              <p className="text-sm text-gray-600">
                Manage your payment operations efficiently
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {onCreatePayment && canCreate && (
                <Button
                  onClick={onCreatePayment}
                  className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 px-6 py-2.5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Payment
                </Button>
              )}
              {onViewPayments && canRead && (
                <Button
                  variant="outline"
                  onClick={onViewPayments}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white border-0 hover:from-teal-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View All Payments
                </Button>
              )}
              {onViewReports && canRead && (
                <Button
                  variant="outline"
                  onClick={onViewReports}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 hover:from-cyan-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Reports
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium Monthly Trend Chart */}
      {monthlyTrendData.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {isParent ? "Payment History Trend" : "Collection Trend"}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {isParent ? "Monthly payment history overview" : "Monthly payment collection overview"}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full">
              <BarChart2 className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="#888"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#888"
                  tickFormatter={(value) => `${getCurrencySymbol(currency)} ${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#888"
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'amount' ? formatCurrency(value) : value,
                    name === 'amount' ? (isParent ? 'Amount Paid' : 'Collection') : 'Payments'
                  ]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#0088FE"
                  strokeWidth={3}
                  dot={{ fill: '#0088FE', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#0088FE', strokeWidth: 2, fill: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#00C49F"
                  strokeWidth={2}
                  yAxisId="right"
                  dot={{ fill: '#00C49F', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#0088FE]"></div>
                <span className="text-sm text-gray-600">
                  {isParent ? "Amount Paid" : "Collection Amount"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#00C49F]"></div>
                <span className="text-sm text-gray-600">Payment Count</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Distribution */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {isParent ? "How Payments Were Made" : "Payment Methods Distribution"}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {isParent ? "Breakdown of payment methods you've used" : "Breakdown of payment methods used"}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full">
              <PieChartIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value} payments`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {paymentMethodData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.value} payments • {formatCurrency(entry.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status Overview */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {isParent ? "Payment Status" : "Status Overview"}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isParent ? "Current status of your payments" : "Current payment status breakdown"}
            </p>
          </div>
          <div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">Completed</p>
                    <p className="text-xs text-green-600">
                      {formatCurrency(dashboardStats?.total_paid || dashboardStats?.total_amount_collected || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-700">
                    {statsLoading ? '...' : (dashboardStats?.completed_payments || 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-800">Pending</p>
                    <p className="text-xs text-orange-600">
                      {formatCurrency(dashboardStats?.pending_amount || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-700">
                    {statsLoading ? '...' : dashboardStats?.pending_payments || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">Overdue</p>
                    <p className="text-xs text-red-600">
                      {formatCurrency(dashboardStats?.overdue_amount || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-700">
                    {statsLoading ? '...' : dashboardStats?.overdue_payments || 0}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <div className="text-right">
                    <p className="font-semibold">
                      {statsLoading ? '...' : (
                        Math.max(0, (dashboardStats?.total_payments || 0) - (dashboardStats?.pending_payments || 0) - (dashboardStats?.overdue_payments || 0)) +
                        (dashboardStats?.pending_payments || 0) +
                        (dashboardStats?.overdue_payments || 0)
                      )} {isParent ? "items" : "payments"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        Math.max(0, (dashboardStats?.total_amount_collected || 0) - (dashboardStats?.pending_amount || 0) - (dashboardStats?.overdue_amount || 0)) +
                        (dashboardStats?.pending_amount || 0) +
                        (dashboardStats?.overdue_amount || 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments - Full Width */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {isParent ? "Recent Payment Records" : "Recent Payments"}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isParent
                ? "Latest payment records for your children"
                : "Latest payment transactions and activities"
              }
            </p>
          </div>
          {onViewPayments && (
            <Button
              variant="outline"
              onClick={onViewPayments}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white border-0 hover:from-teal-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
                <Eye className="h-4 w-4 mr-2" />
                View All Payments
              </Button>
            )}
        </div>

        <div>
          {paymentsRefreshing && !paymentsLoading && (
            <div className="flex items-center justify-center py-2 mb-4 bg-teal-50 rounded-lg">
              <Activity className="h-4 w-4 mr-2 animate-pulse text-teal-600" />
              <span className="text-sm text-teal-600">Refreshing payments...</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {paymentsLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="p-4 border rounded-lg animate-pulse">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : recentPayments.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No recent payments found</p>
                <p className="text-sm">
                  {isParent ? "Payment records will appear here when available" : "Payment transactions will appear here"}
                </p>
                {onCreatePayment && !isParent && (
                  <Button className="mt-4" onClick={onCreatePayment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Payment
                  </Button>
                )}
              </div>
            ) : (
              recentPayments.map((payment: Payment, index) => (
                <div
                  key={payment.id}
                  className="p-6 bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl hover:bg-white/90 hover:shadow-2xl hover:border-emerald-300/50 transition-all duration-300 transform hover:scale-[1.02] group cursor-pointer relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-emerald-500/0 before:via-emerald-500/5 before:to-teal-500/0 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards'
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-12 w-12 group-hover:scale-110 transition-all duration-300 ring-2 ring-white/50 group-hover:ring-emerald-400/50 shadow-lg">
                      <AvatarImage src={(payment as any).student?.photo_url} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 font-semibold">
                        {getPaymentStudentInitials(payment)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold truncate group-hover:text-emerald-600 transition-colors duration-300">
                          {getPaymentStudentName(payment)}
                        </p>
                        {getStatusBadge(payment.status)}
                      </div>
                      <p className="text-xl font-bold text-transparent bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text mb-2">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-gray-500 font-medium mb-2">{getPaymentCategoryName(payment)}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-gray-500 font-medium">{getPaymentDate(payment, 'MMM dd, yyyy')}</p>
                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 group-hover:translate-x-0">
                          <div className="p-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-lg">
                            <ExternalLink className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Fee Categories */}
      {dashboardStats?.top_fee_categories && dashboardStats.top_fee_categories.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {isParent ? "Fee Categories" : "Top Fee Categories"}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isParent ? "Breakdown of fees paid by category" : "Revenue breakdown by category"}
            </p>
          </div>
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {dashboardStats.top_fee_categories.map((category, index) => (
                <div
                  key={category.category_name}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <h4 className="font-medium text-sm capitalize truncate">
                      {category.category_name}
                    </h4>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(category.total_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {category.payment_count} payment{category.payment_count !== 1 ? 's' : ''}
                    </p>
                    <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                          width: `${Math.min(100, (category.total_amount / (dashboardStats.top_fee_categories?.[0]?.total_amount || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Insights & Analytics Summary - Hidden for parents */}
      {dashboardStats && !isParent && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">Quick Insights</h3>
            <p className="text-sm text-gray-600 mt-1">
              Key metrics and performance indicators
            </p>
          </div>
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Average Payment Value */}
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-blue-800 mb-1">Avg Payment</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(dashboardStats.average_payment_amount || 0)}
                </p>
              </div>

              {/* Collection Efficiency */}
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-800 mb-1">Collection Rate</p>
                <p className="text-xl font-bold text-green-600">
                  {dashboardStats.collection_rate?.toFixed(1) || '0'}%
                </p>
              </div>

              {/* Payment Volume */}
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                <div className="flex items-center justify-center mb-2">
                  <BarChart2 className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-purple-800 mb-1">Daily Avg</p>
                <p className="text-xl font-bold text-purple-600">
                  {(() => {
                    const days = parseInt(dateRange) || 1;
                    const totalPayments = dashboardStats.total_payments || 0;
                    return Math.round(totalPayments / days);
                  })()}
                </p>
                <p className="text-xs text-purple-600">payments/day</p>
              </div>

              {/* Outstanding Amount */}
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                <div className="flex items-center justify-center mb-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-orange-800 mb-1">Outstanding</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency((dashboardStats.pending_amount || 0) + (dashboardStats.overdue_amount || 0))}
                </p>
              </div>
            </div>

            {/* Performance Summary */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Period:</span>
                <span className="font-medium">
                  {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')} ({dateRange} days)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Last updated:</span>
                <span className="font-medium">
                  {format(new Date(), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
