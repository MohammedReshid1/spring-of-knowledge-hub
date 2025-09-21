import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, Calendar, DollarSign, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
const mockFeeData = {
  student: 'Emma Johnson',
  academicYear: '2024-2025',
  total: {
    tuition: 2500,
    fees: 300,
    materials: 150,
    activities: 100,
    transport: 200,
    total: 3250
  },
  paid: {
    tuition: 2500,
    fees: 300,
    materials: 150,
    activities: 100,
    transport: 100,
    total: 3150
  },
  outstanding: {
    transport: 100,
    total: 100
  },
  paymentHistory: [
    { date: '2025-08-15', amount: 1250, description: 'Tuition - Semester 1', status: 'completed' },
    { date: '2025-08-15', amount: 300, description: 'Academic Fees', status: 'completed' },
    { date: '2025-08-20', amount: 150, description: 'Books & Materials', status: 'completed' },
    { date: '2025-09-01', amount: 1250, description: 'Tuition - Semester 2', status: 'completed' },
    { date: '2025-09-01', amount: 100, description: 'Activities Fee', status: 'completed' },
    { date: '2025-09-01', amount: 100, description: 'Transport - September', status: 'completed' }
  ],
  upcomingDue: [
    { item: 'Transport Fee', amount: 100, dueDate: '2025-10-01', category: 'transport' }
  ]
};

export const FeeStatusWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useStudentFees } = useWidgetData();
  const { data: feeData, isLoading, error } = useStudentFees();

  if (error) {
    return <div className="text-sm text-red-500">Failed to load fee status</div>;
  }

  const fees = feeData || { total: { total: 0 }, paid: { total: 0 }, balance: 0, paymentPercentage: 0 };
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const { total, paid, outstanding, paymentHistory, upcomingDue } = mockFeeData;

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

  const paymentPercentage = (paid.total / total.total) * 100;
  const isFullyPaid = outstanding.total === 0;

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-4">
      {/* Fee Status Overview */}
      <div className={`text-center p-3 rounded-lg ${
        isFullyPaid 
          ? 'bg-green-50 border border-green-200' 
          : outstanding.total > 0 
          ? 'bg-orange-50 border border-orange-200'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        {isFullyPaid ? (
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
        ) : (
          <AlertCircle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
        )}
        <div className={`text-2xl font-bold ${
          isFullyPaid ? 'text-green-900' : 'text-orange-900'
        }`}>
          {isFullyPaid ? 'Paid in Full' : formatCurrency(outstanding.total)}
        </div>
        <div className={`text-sm ${
          isFullyPaid ? 'text-green-700' : 'text-orange-700'
        }`}>
          {isFullyPaid ? 'All fees current' : 'Outstanding Balance'}
        </div>
        {!isFullyPaid && (
          <div className="text-xs text-gray-600 mt-1">
            Academic Year {mockFeeData.academicYear}
          </div>
        )}
      </div>

      {/* Payment Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Payment Progress</span>
          <Badge className={
            isFullyPaid ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }>
            {paymentPercentage.toFixed(0)}%
          </Badge>
        </div>
        <Progress value={paymentPercentage} className="h-3" />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Paid: {formatCurrency(paid.total)}</span>
          <span>Total: {formatCurrency(total.total)}</span>
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">Fee Breakdown</div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Tuition</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(paid.tuition)}/{formatCurrency(total.tuition)}</span>
              <CheckCircle className="h-3 w-3 text-green-600" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Academic Fees</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(paid.fees)}/{formatCurrency(total.fees)}</span>
              <CheckCircle className="h-3 w-3 text-green-600" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Materials</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(paid.materials)}/{formatCurrency(total.materials)}</span>
              <CheckCircle className="h-3 w-3 text-green-600" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Activities</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(paid.activities)}/{formatCurrency(total.activities)}</span>
              <CheckCircle className="h-3 w-3 text-green-600" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Transport</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(paid.transport)}/{formatCurrency(total.transport)}</span>
              {paid.transport < total.transport ? (
                <AlertCircle className="h-3 w-3 text-orange-600" />
              ) : (
                <CheckCircle className="h-3 w-3 text-green-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Due */}
      {upcomingDue.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Upcoming Payments</div>
          {upcomingDue.map((item, index) => {
            const daysUntil = getDaysUntilDue(item.dueDate);
            const isOverdue = daysUntil < 0;
            const isDueSoon = daysUntil <= 7 && daysUntil >= 0;
            
            return (
              <div
                key={index}
                className={`p-2 rounded border text-xs ${
                  isOverdue 
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : isDueSoon
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">{item.item}</span>
                  </div>
                  <span className="font-bold">{formatCurrency(item.amount)}</span>
                </div>
                <div className="text-xs mt-1">
                  Due: {new Date(item.dueDate).toLocaleDateString()} 
                  {isOverdue 
                    ? ` (${Math.abs(daysUntil)} days overdue)`
                    : daysUntil === 0 
                    ? ' (Today)' 
                    : ` (${daysUntil} days)`
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Payments */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">Recent Payments</div>
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {paymentHistory.slice(0, 3).map((payment, index) => (
            <div key={index} className="flex items-center justify-between text-xs p-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-gray-600">{payment.description}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCurrency(payment.amount)}</div>
                <div className="text-gray-500">{new Date(payment.date).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outstanding Balance Alert */}
      {outstanding.total > 0 && (
        <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Outstanding balance of {formatCurrency(outstanding.total)} requires payment
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/payments?action=make-payment"
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-center"
        >
          Make Payment
        </Link>
        <Link
          to="/payments?tab=payments"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          View Payments
        </Link>
      </div>
    </div>
  );
};