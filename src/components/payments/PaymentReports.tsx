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
  Download
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
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
  const branchId = selectedBranch || 'all'; // Always provide a branch ID, use 'all' for all branches
  const enableQueries = !!selectedBranch;

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
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative">
        {/* Background card with glass morphism */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <FileBarChart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                    Payment Reports
                  </CardTitle>
                  <p className="text-slate-600 leading-relaxed">Generate detailed payment reports with advanced analytics</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Premium Report Generation Card */}
      <div className="relative">
        {/* Premium glass card background */}
        <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
              Report Generation
            </CardTitle>
            <p className="text-slate-600 leading-relaxed">
              Configure and generate detailed payment reports with advanced filtering options
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="report-type">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger id="report-type">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="report-date-from">From Date</Label>
                  <Input
                    id="report-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="report-date-to">To Date</Label>
                  <Input
                    id="report-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="export-format">Export Format</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger id="export-format">
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

            <div className="space-y-4">
              <div>
                <Label htmlFor="fee-category">Fee Category (Optional)</Label>
                <Select value={feeCategoryId} onValueChange={setFeeCategoryId}>
                  <SelectTrigger id="fee-category">
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

              <div>
                <Label htmlFor="grade-level">Grade Level (Optional)</Label>
                <Select value={gradeLevel} onValueChange={setGradeLevel}>
                  <SelectTrigger id="grade-level">
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

              <Button
                onClick={handleGenerateReport}
                disabled={generateReportMutation.isPending}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {generateReportMutation.isPending ? (
                  'Generating...'
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                    Generate & Download Report
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Report Descriptions */}
          <div className="space-y-3">
            <h4 className="font-medium">Report Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Daily Collection Report</h5>
                <p className="text-xs text-muted-foreground">
                  Daily breakdown of payment collections with totals and payment methods.
                </p>
              </div>
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Outstanding Fees Report</h5>
                <p className="text-xs text-muted-foreground">
                  List of pending and overdue payments by student and fee category.
                </p>
              </div>
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Payment Summary Report</h5>
                <p className="text-xs text-muted-foreground">
                  Comprehensive summary with totals, averages, and payment trends.
                </p>
              </div>
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Fee Category Analysis</h5>
                <p className="text-xs text-muted-foreground">
                  Analysis of payment performance by fee category and grade level.
                </p>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
