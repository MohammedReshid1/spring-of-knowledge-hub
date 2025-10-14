import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  FileBarChart,
  Download,
  Calendar,
  Filter,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const REPORT_TYPES = [
  { value: 'daily_collection', label: 'Daily Collection Report' },
  { value: 'outstanding_fees', label: 'Outstanding Fees Report' },
  { value: 'payment_summary', label: 'Payment Summary Report' },
  { value: 'fee_category_analysis', label: 'Fee Category Analysis' },
];

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

export function PaymentReports() {
  const { selectedBranch } = useBranch();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();
  const branchId = selectedBranch || 'all'; // Always provide a branch ID, use 'all' for all branches
  const enableQueries = !!selectedBranch;

  // Permission checks
  const canViewReports = isSuperSuperAdmin || hasPermission('payment.read') || hasPermission('report.view');

  // Report generation state
  const [reportType, setReportType] = useState('daily_collection');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [feeCategoryId, setFeeCategoryId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf');

  // Fetch fee categories for filtering
  const { data: feeCategories = [] } = useQuery({
    queryKey: ['fee-categories', branchId ?? 'all'],
    queryFn: () => apiClient.getFeeCategories({
      branch_id: branchId,
      is_active: true,
    }),
    enabled: enableQueries,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: () => {
      const params: any = {
        format: exportFormat,
        date_from: dateFrom,
        date_to: dateTo,
        branch_id: branchId,
      };

      if (feeCategoryId && feeCategoryId !== 'all') {
        params.fee_category_id = feeCategoryId;
      }
      if (gradeLevel && gradeLevel !== 'all') {
        params.grade_level = gradeLevel;
      }

      return apiClient.getPaymentReports(reportType, params);
    },
    onSuccess: (response) => {
      if (response.data instanceof Blob) {
        // Handle file download
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportType}_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Report Downloaded',
          description: `${reportType.replace('_', ' ')} report has been downloaded successfully.`,
        });
      } else {
        toast({
          title: 'Report Generated',
          description: 'Report data has been generated successfully.',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate report',
        variant: 'destructive',
      });
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate();
  };

  const GRADE_LEVELS = [
    'Pre-K', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
    'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
    'Grade 11', 'Grade 12'
  ];

  return (
    <div className="space-y-8 p-6 animate-in fade-in duration-500">
      {/* Premium Header */}
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        <CardHeader className="pb-6 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <FileBarChart className="h-7 w-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold text-slate-800 mb-1">
                  Payment Reports
                </CardTitle>
                <p className="text-slate-600 text-sm">Generate detailed payment reports with advanced analytics and filtering</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Premium Report Generation Card */}
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">
                Report Configuration
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Configure and generate detailed payment reports with advanced filtering options
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="report-type" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileBarChart className="h-4 w-4 text-slate-500" />
                  Report Type
                </Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger id="report-type" className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Date Range
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="report-date-from" className="text-xs text-slate-600">From</Label>
                    <Input
                      id="report-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="report-date-to" className="text-xs text-slate-600">To</Label>
                    <Input
                      id="report-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-format" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Download className="h-4 w-4 text-slate-500" />
                  Export Format
                </Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger id="export-format" className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fee-category" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  Fee Category <span className="text-xs text-slate-500 font-normal">(Optional)</span>
                </Label>
                <Select value={feeCategoryId} onValueChange={setFeeCategoryId}>
                  <SelectTrigger id="fee-category" className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {feeCategories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade-level" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  Grade Level <span className="text-xs text-slate-500 font-normal">(Optional)</span>
                </Label>
                <Select value={gradeLevel} onValueChange={setGradeLevel}>
                  <SelectTrigger id="grade-level" className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {GRADE_LEVELS.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending || !canViewReports}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 py-6 text-base font-semibold disabled:opacity-50"
                >
                  {generateReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating Report...
                    </>
                  ) : !canViewReports ? (
                    'No Permission'
                  ) : (
                    <>
                      <Download className="h-5 w-5 mr-2" />
                      Generate & Download Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Report Descriptions */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <FileText className="h-4 w-4 text-indigo-700" />
              </div>
              <h4 className="font-semibold text-lg text-slate-800">Available Report Types</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group p-5 rounded-xl border-2 border-slate-200 hover:border-blue-300 bg-gradient-to-br from-blue-50/50 to-transparent hover:shadow-md transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Calendar className="h-5 w-5 text-blue-700" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h5 className="text-sm font-semibold text-slate-800">Daily Collection Report</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Daily breakdown of payment collections with totals and payment methods.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group p-5 rounded-xl border-2 border-slate-200 hover:border-orange-300 bg-gradient-to-br from-orange-50/50 to-transparent hover:shadow-md transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                    <FileBarChart className="h-5 w-5 text-orange-700" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h5 className="text-sm font-semibold text-slate-800">Outstanding Fees Report</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      List of pending and overdue payments by student and fee category.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group p-5 rounded-xl border-2 border-slate-200 hover:border-purple-300 bg-gradient-to-br from-purple-50/50 to-transparent hover:shadow-md transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <FileText className="h-5 w-5 text-purple-700" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h5 className="text-sm font-semibold text-slate-800">Payment Summary Report</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Comprehensive summary with totals, averages, and payment trends.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group p-5 rounded-xl border-2 border-slate-200 hover:border-green-300 bg-gradient-to-br from-green-50/50 to-transparent hover:shadow-md transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <Filter className="h-5 w-5 text-green-700" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h5 className="text-sm font-semibold text-slate-800">Fee Category Analysis</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Analysis of payment performance by fee category and grade level.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
