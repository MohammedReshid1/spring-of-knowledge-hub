import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { TokenStorage } from '@/utils/tokenStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Download,
  FileText,
  Info
} from 'lucide-react';

// Type definitions
interface PasswordResetRecord {
  id: string;
  student_id: string;
  student_name: string;
  reset_by: string;
  reset_by_role: string;
  reset_reason: string;
  old_password_masked?: string;
  new_password_preview: string;
  reset_at: string;
  branch_name: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  notification_sent: boolean;
  notification_recipients?: string[];
}

interface PasswordResetHistoryResponse {
  success: boolean;
  data?: {
    records: PasswordResetRecord[];
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
  message?: string;
}

interface PasswordResetHistoryProps {
  studentId?: string;
  showFilters?: boolean;
  maxHeight?: string;
}

export function PasswordResetHistory({
  studentId,
  showFilters = true,
  maxHeight = '600px'
}: PasswordResetHistoryProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;

  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch password reset history
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['password-reset-history', studentId, branchId, page, pageSize, searchTerm, dateFilter, statusFilter],
    queryFn: async () => {
      if (!branchId && !studentId) return null;

      const url = studentId
        ? `${config.API_BASE_URL}/admin/students/password-reset/history/${studentId}`
        : `${config.API_BASE_URL}/admin/students/password-reset/history`;

      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId);
      if (!studentId) {
        params.append('page', page.toString());
        params.append('page_size', pageSize.toString());
        if (searchTerm) params.append('search', searchTerm);
        if (dateFilter !== 'all') params.append('date_filter', dateFilter);
        if (statusFilter !== 'all') params.append('status_filter', statusFilter);
      }

      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TokenStorage.getToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch password reset history');
      }

      return response.json() as Promise<PasswordResetHistoryResponse>;
    },
    enabled: (!!branchId || !!studentId),
  });

  const records = historyData?.data?.records || [];
  const totalCount = historyData?.data?.total_count || 0;
  const totalPages = historyData?.data?.total_pages || 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Less than an hour ago';
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'There are no records to export',
        variant: 'destructive',
      });
      return;
    }

    const csvHeaders = [
      'Student ID',
      'Student Name',
      'Reset By',
      'Role',
      'Reset Date',
      'Reset Reason',
      'Old Password (Masked)',
      'New Password Preview',
      'Branch',
      'Status',
      'Notifications Sent',
      'IP Address'
    ];

    const csvRows = records.map(record => [
      record.student_id,
      record.student_name,
      record.reset_by,
      record.reset_by_role,
      formatDate(record.reset_at),
      `"${record.reset_reason.replace(/"/g, '""')}"`,
      record.old_password_masked || 'N/A',
      record.new_password_preview,
      record.branch_name,
      record.success ? 'Success' : 'Failed',
      record.notification_sent ? 'Yes' : 'No',
      record.ip_address || 'N/A'
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password-reset-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: 'Export Successful',
      description: 'Password reset history has been exported to CSV',
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDateFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>

      {/* Header */}
      <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl animate-fadeInUp">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 border border-orange-200/50">
              <History className="h-6 w-6 text-orange-600" />
            </div>
            Password Reset History
          </h2>
          <p className="text-slate-600 font-medium">
            {studentId ? 'View password reset history for this student' : 'View all password reset history across the system'}
          </p>
        </div>
      </Card>

      {/* Filters */}
      {showFilters && !studentId && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-semibold bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 border border-orange-200/50">
                <Filter className="h-5 w-5 text-orange-600" />
              </div>
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search student..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Successful</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="flex-1"
                >
                  Reset Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => refetchHistory()}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                {totalCount} records found
              </Badge>
              <Button
                variant="outline"
                onClick={exportToCSV}
                disabled={records.length === 0}
                className="border-orange-300 hover:bg-orange-50 text-orange-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="border-b border-slate-100/50 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 border border-orange-200/50">
                <FileText className="h-5 w-5 text-orange-600" />
              </div>
              Reset Records
            </CardTitle>
            {!studentId && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                Page {page} of {totalPages}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reset History Found</h3>
              <p className="text-gray-600">
                {studentId
                  ? 'This student has not had any password resets recorded.'
                  : 'No password reset records match the current filters.'
                }
              </p>
            </div>
          ) : (
            <ScrollArea className={`${maxHeight ? `max-h-[${maxHeight}]` : 'max-h-[600px]'}`}>
              <Table>
                <TableHeader className="bg-orange-50 sticky top-0">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Reset By</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} className="hover:bg-orange-50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.student_name}</div>
                          <div className="text-sm text-gray-600">{record.student_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.reset_by}</div>
                          <div className="text-sm text-gray-600">{record.reset_by_role}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{formatDate(record.reset_at)}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getRelativeTime(record.reset_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={record.reset_reason}>
                          {record.reset_reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.success ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className={`text-sm font-medium ${record.notification_sent ? 'text-green-600' : 'text-red-600'}`}>
                            {record.notification_sent ? 'Sent' : 'Not Sent'}
                          </div>
                          {record.notification_recipients && record.notification_recipients.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {record.notification_recipients.length} recipient(s)
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.ip_address || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Pagination */}
          {!studentId && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = i + 1;
                    return (
                      <Button
                        key={pageNumber}
                        variant={page === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNumber)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="px-2">...</span>
                      <Button
                        variant={page === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(totalPages)}
                        className="w-8 h-8 p-0"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}