import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Users, 
  Download,
  FileText,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  tuition_fees: number;
  registration_fees: number;
  exam_fees: number;
  transport_fees: number;
  total_outstanding: number;
  collection_rate: number;
  students_paid_full: number;
  students_partial_payment: number;
  students_no_payment: number;
  monthly_revenue: Record<string, number>;
  total_payments: number;
  total_students: number;
}

export const FinancialReports: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const { data: financialSummary, isLoading } = useQuery<FinancialSummary>({
    queryKey: ['financial-summary', dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('start_date', dateRange.from.toISOString().split('T')[0]);
      if (dateRange?.to) params.append('end_date', dateRange.to.toISOString().split('T')[0]);
      if (selectedBranch && selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      
      const response = await apiClient.get(`/reports/financial-reports/summary?${params}`);
      return response.data;
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading financial reports...</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getCollectionRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 80) return 'text-blue-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Financial Reports</h2>
          <p className="text-muted-foreground">Comprehensive financial analysis and revenue tracking</p>
        </div>
        
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <DatePickerWithRange
          date={dateRange}
          onDateChange={setDateRange}
          placeholder="Select date range"
        />

        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((branch: any) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financialSummary?.total_revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Income from all sources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(financialSummary?.net_income || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCollectionRateColor(financialSummary?.collection_rate || 0)}`}>
              {financialSummary?.collection_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Payment collection efficiency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(financialSummary?.total_outstanding || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Revenue Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Tuition Fees</span>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    {formatCurrency(financialSummary?.tuition_fees || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((financialSummary?.tuition_fees || 0) / (financialSummary?.total_revenue || 1) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Registration Fees</span>
                <div className="text-right">
                  <div className="font-bold text-blue-600">
                    {formatCurrency(financialSummary?.registration_fees || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((financialSummary?.registration_fees || 0) / (financialSummary?.total_revenue || 1) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Exam Fees</span>
                <div className="text-right">
                  <div className="font-bold text-purple-600">
                    {formatCurrency(financialSummary?.exam_fees || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((financialSummary?.exam_fees || 0) / (financialSummary?.total_revenue || 1) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Transport Fees</span>
                <div className="text-right">
                  <div className="font-bold text-orange-600">
                    {formatCurrency(financialSummary?.transport_fees || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((financialSummary?.transport_fees || 0) / (financialSummary?.total_revenue || 1) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <span className="font-medium text-green-800">Paid in Full</span>
                  <p className="text-sm text-green-600">Students who completed payment</p>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {financialSummary?.students_paid_full || 0}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div>
                  <span className="font-medium text-yellow-800">Partial Payment</span>
                  <p className="text-sm text-yellow-600">Students with pending balance</p>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {financialSummary?.students_partial_payment || 0}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <span className="font-medium text-red-800">No Payment</span>
                  <p className="text-sm text-red-600">Students requiring follow-up</p>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {financialSummary?.students_no_payment || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Monthly Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {financialSummary?.monthly_revenue ? (
            <div className="space-y-3">
              {Object.entries(financialSummary.monthly_revenue).map(([month, revenue]) => (
                <div key={month} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{month}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(revenue / Math.max(...Object.values(financialSummary.monthly_revenue))) * 100}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-blue-600 min-w-24 text-right">
                      {formatCurrency(revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No monthly revenue data available</p>
          )}
        </CardContent>
      </Card>

      {/* Financial Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Health Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Revenue Growth</span>
              </div>
              <p className="text-sm text-green-700">
                Consistent monthly revenue with {((financialSummary?.collection_rate || 0) > 85 ? 'excellent' : 'good')} collection rate
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-blue-800">Cash Flow</span>
              </div>
              <p className="text-sm text-blue-700">
                Net income of {formatCurrency(financialSummary?.net_income || 0)} indicates {(financialSummary?.net_income || 0) > 0 ? 'positive' : 'negative'} cash flow
              </p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="font-medium text-orange-800">Outstanding Management</span>
              </div>
              <p className="text-sm text-orange-700">
                {formatCurrency(financialSummary?.total_outstanding || 0)} in pending payments requires attention
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Report Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <FileText className="h-6 w-6 mb-2" />
              Detailed P&L Report
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Users className="h-6 w-6 mb-2" />
              Student Payment Report
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Calendar className="h-6 w-6 mb-2" />
              Monthly Summary
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <TrendingUp className="h-6 w-6 mb-2" />
              Trend Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};