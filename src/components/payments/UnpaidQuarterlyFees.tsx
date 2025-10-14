import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  Download,
  Mail,
  Phone,
  Search,
  RefreshCw,
  DollarSign,
  Users,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useSystemSettings';
import { formatCurrency } from '@/utils/currency';

interface UnpaidStudent {
  student_id: string;
  student_name: string;
  grade_level: string;
  branch_id: string;
  class_id?: string;
  phone?: string;
  email?: string;
  guardian_phone?: string;
  guardian_email?: string;
  amount_due: string;
  quarter?: string;
  academic_year: string;
  unpaid_count: number;
  categories: Array<{
    id: string;
    name: string;
    frequency: string;
    amount: string;
  }>;
}

interface UnpaidFeesResponse {
  total_unpaid: number;
  total_amount_due: string;
  fee_frequency: string;
  quarter?: string;
  academic_year: string;
  students: UnpaidStudent[];
}

export function UnpaidQuarterlyFees() {
  const { selectedBranch } = useBranch();
  const { isAuthenticated } = useAuth();
  const academicYearQuery = useAcademicYear();
  const defaultAcademicYear = getAcademicYearString(academicYearQuery);
  const currency = useCurrency();

  const [feeFrequency, setFeeFrequency] = useState<string>('all');
  const [quarter, setQuarter] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch && isAuthenticated;

  // Fetch unpaid fees
  const { data, isLoading, refetch, isFetching } = useQuery<UnpaidFeesResponse>({
    queryKey: ['unpaid-fees', branchId, feeFrequency, quarter, academicYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId);
      if (feeFrequency && feeFrequency !== 'all') params.append('fee_frequency', feeFrequency);
      if (quarter) params.append('quarter', quarter);
      if (academicYear) params.append('academic_year', academicYear);

      const response = await apiClient.get(`/payments/unpaid-fees?${params.toString()}`);
      return response.data;
    },
    enabled: enableQueries,
  });

  // Filter students by search term
  const filteredStudents = data?.students?.filter(student =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade_level?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Calculate total amount due from filtered students
  const totalAmountDue = filteredStudents.reduce((sum, student) => {
    return sum + parseFloat(student.amount_due || '0');
  }, 0);

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Get frequency badge color
  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'quarterly':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'monthly':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'annual':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'one-time':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data?.students || data.students.length === 0) return;

    const headers = ['Student ID', 'Student Name', 'Grade Level', 'Guardian Phone', 'Guardian Email', 'Amount Due', 'Unpaid Categories', 'Fee Types', 'Quarter', 'Academic Year'];
    const csvData = filteredStudents.map(student => [
      student.student_id,
      student.student_name,
      student.grade_level,
      student.guardian_phone || '',
      student.guardian_email || '',
      student.amount_due,
      student.categories.map(c => c.name).join('; '),
      student.categories.map(c => c.frequency).join('; '),
      student.quarter || '',
      student.academic_year
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = data.fee_frequency === 'all'
      ? `unpaid-fees-all-${data.academic_year}.csv`
      : `unpaid-fees-${data.fee_frequency}-${data.academic_year}.csv`;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-red-50 via-red-50 to-red-100/70 border-red-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <AlertCircle className="h-4 w-4" />
              </div>
              Unpaid Students
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-red-900 tracking-tight">
              {isLoading ? <Skeleton className="h-10 w-24" /> : (
                <span className="animate-in slide-in-from-bottom-4 duration-700">
                  {data?.total_unpaid || 0}
                </span>
              )}
            </div>
            <p className="text-xs text-red-600 mt-2 font-medium">Students with outstanding fees</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 via-orange-50 to-orange-100/70 border-orange-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                <DollarSign className="h-4 w-4" />
              </div>
              Total Amount Due
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-orange-900 tracking-tight">
              {isLoading ? <Skeleton className="h-10 w-24" /> : (
                <span className="animate-in slide-in-from-bottom-4 duration-700 delay-75">
                  {formatCurrency(totalAmountDue, currency)}
                </span>
              )}
            </div>
            <p className="text-xs text-orange-600 mt-2 font-medium">Total outstanding amount</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100/70 border-blue-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Calendar className="h-4 w-4" />
              </div>
              Fee Type
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-blue-900 capitalize tracking-tight">
              {isLoading ? <Skeleton className="h-9 w-24" /> : (
                <span className="animate-in slide-in-from-bottom-4 duration-700 delay-150">
                  {data?.fee_frequency === 'all' ? 'All Fees' : data?.fee_frequency || 'All'}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              {data?.quarter && feeFrequency === 'quarterly' ? `${data.quarter} - ${data.academic_year}` : data?.academic_year || 'Current year'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 via-purple-50 to-purple-100/70 border-purple-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Users className="h-4 w-4" />
              </div>
              Filtered Results
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-purple-900 tracking-tight">
              {isLoading ? <Skeleton className="h-10 w-24" /> : (
                <span className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
                  {filteredStudents.length}
                </span>
              )}
            </div>
            <p className="text-xs text-purple-600 mt-2 font-medium">After search filter</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <div className="p-2 bg-slate-200 rounded-lg">
              <Filter className="h-5 w-5 text-slate-700" />
            </div>
            Filters & Search
          </CardTitle>
          <CardDescription>Refine results by fee type, quarter, academic year, or search for specific students</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-4">
            <div className="space-y-2 group">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                Fee Type
              </label>
              <Select value={feeFrequency} onValueChange={setFeeFrequency}>
                <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-colors">
                  <SelectValue placeholder="All Fees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fees</SelectItem>
                  <SelectItem value="quarterly">Quarterly Fees</SelectItem>
                  <SelectItem value="monthly">Monthly Fees</SelectItem>
                  <SelectItem value="annual">Annual Fees</SelectItem>
                  <SelectItem value="one-time">One-Time Fees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {feeFrequency === 'quarterly' && (
              <div className="space-y-2 group animate-in slide-in-from-left duration-300">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Quarter
                </label>
                <Select value={quarter || 'current'} onValueChange={(val) => setQuarter(val === 'current' ? '' : val)}>
                  <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-colors">
                    <SelectValue placeholder="Current Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Quarter</SelectItem>
                    <SelectItem value="Q1">Quarter 1 (Sep-Nov)</SelectItem>
                    <SelectItem value="Q2">Quarter 2 (Dec-Feb)</SelectItem>
                    <SelectItem value="Q3">Quarter 3 (Mar-May)</SelectItem>
                    <SelectItem value="Q4">Quarter 4 (Jun-Aug)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 group">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Academic Year
              </label>
              <Input
                type="text"
                placeholder={defaultAcademicYear}
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              />
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-slate-400" />
                Current: {defaultAcademicYear}
              </p>
            </div>

            <div className="space-y-2 group">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-slate-500" />
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input
                  type="text"
                  placeholder="Name, ID, or grade..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-slate-800 flex items-center gap-2">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <Users className="h-5 w-5 text-slate-700" />
                </div>
                Students with Unpaid Fees
              </CardTitle>
              <CardDescription className="mt-2">
                <span className="font-semibold text-slate-700">{data?.total_unpaid || 0}</span> students have unpaid {data?.fee_frequency === 'all' ? 'fees' : `${data?.fee_frequency} fees`}
                {data?.quarter && feeFrequency === 'quarterly' ? ` for ${data.quarter}` : ''} ({data?.academic_year})
              </CardDescription>
            </div>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              disabled={!data?.students || data.students.length === 0}
              className="bg-white hover:bg-green-50 border-green-300 hover:border-green-400 text-green-700 hover:text-green-800 transition-all duration-300 shadow-sm hover:shadow disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-16 animate-in fade-in duration-500">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-green-200 mb-6">
                <AlertCircle className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-xl font-semibold text-slate-800 mb-2">
                {searchTerm ? 'No students found matching your search' : `All students have paid their ${data?.fee_frequency === 'all' ? 'fees' : `${data?.fee_frequency} fees`}!`}
              </p>
              <p className="text-sm text-slate-600">
                {searchTerm ? 'Try adjusting your search criteria' : 'Great job on fee collection!'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 border-b-2 border-slate-200">
                    <TableHead className="font-semibold text-slate-700">Student</TableHead>
                    <TableHead className="font-semibold text-slate-700">Grade</TableHead>
                    <TableHead className="font-semibold text-slate-700">Guardian Contact</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((student, index) => (
                    <TableRow
                      key={student.student_id}
                      className="hover:bg-slate-50/80 transition-colors duration-200 border-b border-slate-100 animate-in fade-in slide-in-from-bottom-2"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold text-sm">
                            {student.student_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{student.student_name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="inline-block w-1 h-1 rounded-full bg-slate-400" />
                              {student.student_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 border-slate-300 text-slate-700 font-medium">
                          {student.grade_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1.5">
                          {student.guardian_phone && student.guardian_phone !== 'N/A' && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <div className="p-1 bg-blue-50 rounded">
                                <Phone className="h-3 w-3 text-blue-600" />
                              </div>
                              <span className="font-medium">{student.guardian_phone}</span>
                            </div>
                          )}
                          {student.guardian_email && student.guardian_email !== 'N/A' && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <div className="p-1 bg-purple-50 rounded">
                                <Mail className="h-3 w-3 text-purple-600" />
                              </div>
                              <span className="truncate max-w-[200px] font-medium">{student.guardian_email}</span>
                            </div>
                          )}
                          {(!student.guardian_phone || student.guardian_phone === 'N/A') &&
                           (!student.guardian_email || student.guardian_email === 'N/A') && (
                            <span className="text-slate-400 text-xs italic">No contact info</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-2">
                          <div className="font-bold text-lg text-red-600">
                            {formatCurrency(parseFloat(student.amount_due), currency)}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {student.unpaid_count} unpaid {student.unpaid_count === 1 ? 'fee' : 'fees'}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2 justify-end">
                            {student.categories.map((cat, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={`text-xs font-medium ${getFrequencyColor(cat.frequency)}`}
                                title={`${cat.name} - ${formatCurrency(parseFloat(cat.amount), currency)}`}
                              >
                                {cat.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredStudents.length > 0 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-200 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-600 font-medium">
                  Showing <span className="text-slate-800 font-bold">{startIndex + 1}</span> to <span className="text-slate-800 font-bold">{Math.min(endIndex, filteredStudents.length)}</span> of <span className="text-slate-800 font-bold">{filteredStudents.length}</span> students
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-600 font-medium">Rows per page:</p>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[75px] border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-1 bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-300">
                    <span className="text-sm text-slate-700 font-medium">
                      Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
