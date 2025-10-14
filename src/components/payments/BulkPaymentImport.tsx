import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  Loader2,
  X,
  Play,
  Eye,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useCurrency } from '@/hooks/useSystemSettings';
import { formatCurrency } from '@/utils/currency';
import type { FeeCategory } from '@/types/api';

interface ParsedPaymentRow {
  SN: number;
  branch: string;
  Name: string;
  Grade: string;
  Reg: string;
  'Quarter fee': number;
  student_id?: string;
  fee_items?: Array<{
    fee_category_id: string;
    fee_category_name: string;
    amount: number;
  }>;
  total_amount?: number;
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  validRows: ParsedPaymentRow[];
  invalidRows: ParsedPaymentRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    totalAmount: number;
  };
}

export function BulkPaymentImport() {
  const { selectedBranch, branches } = useBranch();
  const queryClient = useQueryClient();
  const currency = useCurrency();

  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'import'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPaymentRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing your file...');
  const [validationProgress, setValidationProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);

  // Pagination states
  const [invalidRowsPage, setInvalidRowsPage] = useState(1);
  const [invalidRowsPerPage, setInvalidRowsPerPage] = useState(10);
  const [validRowsPage, setValidRowsPage] = useState(1);
  const [validRowsPerPage, setValidRowsPerPage] = useState(10);

  // Fetch fee categories for the selected branch
  const { data: feeCategories = [] } = useQuery({
    queryKey: ['fee-categories', selectedBranch],
    queryFn: async () => {
      const result = await apiClient.getFeeCategories({
        branch_id: selectedBranch === 'all' ? undefined : selectedBranch?.trim(),
      });
      return result;
    },
    enabled: !!selectedBranch && selectedBranch !== 'all',
    select: (resp) => {
      const data = (resp as any).data || (resp as any).items || [];
      return data;
    },
  });

  // Drag and drop functionality
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      parseExcelFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const parseExcelFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingMessage('Reading Excel file...');
    setValidationProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      setProcessingMessage('Parsing spreadsheet data...');
      setValidationProgress(20);

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ParsedPaymentRow[];

      setProcessingMessage(`Validating ${jsonData.length} payment records...`);
      setValidationProgress(40);
      setParsedData(jsonData);

      // Validate the data (keep loading during validation)
      await validateData(jsonData);

      setValidationProgress(100);
      setProcessingMessage('Validation complete!');

      // Small delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Only switch to preview after validation is complete
      setCurrentStep('preview');
      setIsProcessing(false);

      toast({
        title: 'File parsed successfully',
        description: `Found ${jsonData.length} payment records`,
      });

    } catch (error) {
      console.error('❌ [BULK IMPORT] Parse error:', error);
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  // Grade normalization function to handle different grade formats
  const normalizeGrade = (grade: string | number): string[] => {
    const gradeStr = String(grade).trim();
    const gradeNum = parseInt(gradeStr);

    // Return array of possible grade formats
    const formats: string[] = [gradeStr]; // Original format

    // Add numeric format if it's a number
    if (!isNaN(gradeNum)) {
      formats.push(gradeNum.toString());
      formats.push(`grade_${gradeNum}`);
      formats.push(`Grade ${gradeNum}`);
    }

    // Special cases for pre-K, KG, PREP
    const lower = gradeStr.toLowerCase();
    if (lower.includes('pre') || lower.includes('kg') || lower === 'k') {
      formats.push('pre_k', 'Pre KG', 'PRE KG', 'kg', 'KG');
    }
    if (lower === 'prep' || lower === 'preparatory') {
      formats.push('prep', 'PREP');
    }

    return formats;
  };

  const validateData = async (data: ParsedPaymentRow[]) => {
    try {
      const validRows: ParsedPaymentRow[] = [];
      const invalidRows: ParsedPaymentRow[] = [];

      // Get branch name for filtering
      const branchName = branches.find(b => b.id === selectedBranch)?.name || '';

      // Fetch students for the selected branch
      setProcessingMessage('Fetching student records...');
      setValidationProgress(50);
      const studentsResp = await apiClient.getStudents({
        branch_id: selectedBranch === 'all' ? undefined : selectedBranch,
        limit: 5000,
      });

      const students = studentsResp.data?.items || studentsResp.data || [];
      // Fee category information logged for debugging

      // Find the amount column (might have different names or spaces)
      const firstRow = data[0] || {};
      const amountColumnName = Object.keys(firstRow).find(key =>
        key.toLowerCase().includes('quarter') ||
        key.toLowerCase().includes('fee') ||
        key.toLowerCase().includes('amount')
      ) || 'Quarter fee';

      setProcessingMessage('Validating payment records...');
      setValidationProgress(60);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const errors: string[] = [];

        // Update progress every 10 rows
        if (i % 10 === 0) {
          const progress = 60 + Math.floor((i / data.length) * 30);
          setValidationProgress(progress);
          setProcessingMessage(`Validating record ${i + 1} of ${data.length}...`);
        }

        // Find registration column (could be "Reg", "Reg ", " Reg", etc.)
        const regColumnName = Object.keys(firstRow).find(key =>
          key.trim().toLowerCase() === 'reg' ||
          key.toLowerCase().includes('registration')
        ) || 'Reg';

        // Parse registration fee
        let regAmount = (row as any)[regColumnName];

        if (typeof regAmount === 'string') {
          regAmount = parseFloat(regAmount.replace(/[$,\s]/g, '').trim());
          if (isNaN(regAmount)) regAmount = undefined;
        } else if (typeof regAmount === 'number') {
          // Already a number, use as-is
        } else {
          regAmount = undefined;
        }

        // Parse quarterly fee
        let quarterAmount = (row as any)[amountColumnName];
        if (typeof quarterAmount === 'string') {
          quarterAmount = parseFloat(quarterAmount.replace(/[$,\s]/g, '').trim());
          if (isNaN(quarterAmount)) quarterAmount = undefined;
        }

        // Parsed amounts logged for debugging

        // Filter by branch - only process students from the selected branch (allow partial match)
        const rowBranch = row.branch?.trim().toLowerCase() || '';
        const expectedBranch = branchName.toLowerCase();
        if (!rowBranch.includes(expectedBranch) && !expectedBranch.includes(rowBranch)) {
          errors.push(`Branch mismatch: ${row.branch} (expected ${branchName})`);
        }

        // Find student by name
        const studentName = row.Name?.trim();
        if (!studentName) {
          errors.push('Student name is required');
        } else {
          const matchingStudent = students.find((s: any) => {
            // Normalize both names by removing extra spaces and converting to lowercase
            const normalize = (str: string) => str?.toLowerCase().replace(/\s+/g, ' ').trim() || '';

            // Try multiple name combinations
            const fullName = normalize(`${s.first_name} ${s.father_name || ''} ${s.grandfather_name || ''}`);
            const firstFather = normalize(`${s.first_name} ${s.father_name || ''}`);
            const firstGrandfather = normalize(`${s.first_name} ${s.grandfather_name || ''}`);
            const firstMiddleLast = normalize(`${s.first_name} ${s.middle_name || ''} ${s.last_name || ''}`);
            const firstLast = normalize(`${s.first_name} ${s.last_name || ''}`);

            const searchName = normalize(studentName);

            // Only try exact matches - NO fuzzy matching
            return fullName === searchName ||
                   firstFather === searchName ||
                   firstGrandfather === searchName ||
                   firstMiddleLast === searchName ||
                   firstLast === searchName;
          });

          if (matchingStudent) {
            row.student_id = matchingStudent.id;
            // Student matched successfully
          } else {
            // Student sample data logged for debugging
            errors.push(`Student not found: ${studentName}`);
          }
        }

        // Find fee categories by grade level
        const grade = row.Grade ? String(row.Grade).trim() : '';
        if (!grade) {
          errors.push('Grade is required');
        } else {

          // Get all possible grade formats for matching
          const gradeFormats = normalizeGrade(grade);

          // Fee categories logged for debugging

          // Initialize fee items array
          row.fee_items = [];

          // Helper function to find matching category and get amount
          const findFeeCategory = (feeType: 'registration' | 'quarterly', expectedAmount?: number) => {
            // Search for category by name pattern and/or frequency
            const namePatterns = feeType === 'registration'
              ? ['registration', 'reg', 'enrollment', 'admission', 'entry']
              : ['quarter', 'quarterly', 'tuition', 'term'];

            const frequencyMatch = feeType === 'registration' ? 'annual' : 'quarterly';

            const matchingCategory = (feeCategories as FeeCategory[]).find((cat: FeeCategory) => {
              // Check if category name matches the fee type
              const nameLower = cat.name.toLowerCase();
              const matchesName = namePatterns.some(pattern => nameLower.includes(pattern));

              // Also check frequency field
              const matchesFrequency = (cat as any).frequency === frequencyMatch;

              if (!matchesName && !matchesFrequency) return false;

              // Check if category applies to this grade level
              if (cat.grade_level_tiers && cat.grade_level_tiers.length > 0) {
                const tierMatch = cat.grade_level_tiers.some((tier: any, idx: number) => {
                  const hasGrade = gradeFormats.some(format => tier.grade_levels?.includes(format));
                  return hasGrade;
                });
                return tierMatch;
              }
              if (cat.grade_levels && cat.grade_levels.length > 0) {
                const gradeMatch = gradeFormats.some(format => cat.grade_levels.includes(format));
                return gradeMatch;
              }
              return cat.is_active;
            });

            if (matchingCategory) {
              let amountForGrade = expectedAmount;

              // If no expected amount, get from tier or default
              if (!amountForGrade) {
                if (matchingCategory.grade_level_tiers && matchingCategory.grade_level_tiers.length > 0) {
                  const matchingTier = matchingCategory.grade_level_tiers.find(
                    tier => gradeFormats.some(format => tier.grade_levels.includes(format))
                  );
                  if (matchingTier) {
                    amountForGrade = typeof matchingTier.amount === 'string'
                      ? parseFloat(matchingTier.amount)
                      : matchingTier.amount;
                  }
                }
                if (!amountForGrade) {
                  amountForGrade = matchingCategory.amount || matchingCategory.base_amount;
                }
              }

              return {
                fee_category_id: (matchingCategory as any)._id || (matchingCategory as any).id,
                fee_category_name: matchingCategory.name,
                amount: amountForGrade || 0
              };
            }

            return null;
          };

          // Find registration fee if amount exists
          if (regAmount && regAmount > 0) {
            const regFee = findFeeCategory('registration', regAmount);
            if (regFee) {
              row.fee_items.push(regFee);
            } else {
              errors.push(`No registration fee category found for grade: ${grade}`);
            }
          }

          // Find quarterly fee if amount exists
          if (quarterAmount && quarterAmount > 0) {
            const quarterFee = findFeeCategory('quarterly', quarterAmount);
            if (quarterFee) {
              row.fee_items.push(quarterFee);
            } else {
              errors.push(`No quarterly fee category found for grade: ${grade}`);
            }
          }

          // Calculate total amount
          if (row.fee_items.length > 0) {
            row.total_amount = row.fee_items.reduce((sum, item) => sum + item.amount, 0);
          } else {
            errors.push(`No fee categories found for grade: ${grade}`);
          }
        }

        // Validate that we have at least one fee item
        if (!row.fee_items || row.fee_items.length === 0) {
          errors.push('No valid fee categories found');
        }

        if (errors.length > 0) {
          row.error = errors.join('; ');
          invalidRows.push(row);
        } else {
          validRows.push(row);
        }
      }

      const totalAmount = validRows.reduce((sum, row) => sum + (row.total_amount || 0), 0);

      setValidationResult({
        valid: invalidRows.length === 0,
        validRows,
        invalidRows,
        summary: {
          total: data.length,
          valid: validRows.length,
          invalid: invalidRows.length,
          totalAmount,
        },
      });

      if (validRows.length > 0) {
        toast({
          title: 'Validation complete',
          description: `${validRows.length} valid records, ${invalidRows.length} invalid records`,
        });
      } else {
        toast({
          title: 'Validation failed',
          description: 'No valid records found',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('❌ [VALIDATION] Error:', error);
      toast({
        title: 'Validation error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const importPaymentsMutation = useMutation({
    mutationFn: async (payments: ParsedPaymentRow[]) => {
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < payments.length; i++) {
        const payment = payments[i];
        const progress = Math.round(((i + 1) / payments.length) * 100);
        setImportProgress(progress);

        // Create separate payments for each fee item
        if (payment.fee_items && payment.fee_items.length > 0) {

          let studentSuccess = true;

          // Create one payment per fee item
          for (const feeItem of payment.fee_items) {
            const paymentData = {
              student_id: payment.student_id!,
              branch_id: selectedBranch === 'all' ? '' : selectedBranch,
              payment_method: 'cash' as const,
              payment_date: new Date().toISOString().split('T')[0], // yyyy-mm-dd format
              notes: `Bulk import - ${payment.Name} (${payment.Grade}) - ${feeItem.fee_category_name}`,
              items: [{
                fee_category_id: feeItem.fee_category_id,
                quantity: 1,
                unit_amount: feeItem.amount,
                notes: feeItem.fee_category_name,
              }],
            };

            try {
              const response = await apiClient.createPayment(paymentData);
            } catch (error) {
              console.error(`❌ [IMPORT] Payment failed for ${feeItem.fee_category_name}:`, error);
              results.failed++;
              results.errors.push(`Row ${payment.SN} (${feeItem.fee_category_name}): ${error instanceof Error ? error.message : 'Failed'}`);
              studentSuccess = false;
              break; // Stop processing other fee items for this student if one fails
            }
          }

          if (studentSuccess) {
            results.successful++;
          }
        } else {
          results.failed++;
          results.errors.push(`Row ${payment.SN}: No fee items found`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setImportResults(results);
      setCurrentStep('import');
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast({
        title: 'Import complete',
        description: `Successfully imported ${results.successful} payments, ${results.failed} failed`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleImport = () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      toast({
        title: 'No valid data',
        description: 'Please fix validation errors before importing',
        variant: 'destructive',
      });
      return;
    }

    importPaymentsMutation.mutate(validationResult.validRows);
  };

  const resetImport = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setParsedData([]);
    setValidationResult(null);
    setImportResults(null);
    setImportProgress(0);
  };

  const downloadTemplate = () => {
    const template = [
      {
        SN: 1,
        branch: 'Example Branch',
        Name: 'Student Name',
        Grade: '1',
        Reg: '1,720',
        'Quarter fee': 17203,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Template');
    XLSX.writeFile(workbook, 'payment_import_template.xlsx');

    toast({
      title: 'Template downloaded',
      description: 'Use this template to prepare your payment data',
    });
  };

  if (!selectedBranch || selectedBranch === 'all') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Please select a specific branch to import payments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500 relative">
      {/* Full-screen loading overlay during file processing */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-12 shadow-2xl max-w-lg w-full mx-4 animate-in zoom-in-95 duration-500">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-6 animate-pulse">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Processing Your File</h3>
              <p className="text-slate-600 mb-6">
                {processingMessage}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${validationProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mb-6 font-medium">
                {validationProgress}% Complete
              </p>

              <div className="flex items-center justify-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <>
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Upload className="h-5 w-5 text-blue-700" />
                </div>
                Bulk Payment Import
              </CardTitle>
              <CardDescription className="mt-2">
                Import multiple payments from Excel file with automatic fee category detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-slate-600">Selected Branch:</Label>
                  <Badge variant="outline" className="bg-blue-50 border-blue-300 text-blue-700 font-semibold px-3 py-1">
                    {branches.find(b => b.id === selectedBranch)?.name}
                  </Badge>
                </div>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  size="sm"
                  className="bg-white hover:bg-green-50 border-green-300 hover:border-green-400 text-green-700 hover:text-green-800 transition-all duration-300 shadow-sm hover:shadow"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 hover:shadow-md'
                }`}
              >
                <input {...getInputProps()} />
                <div className={`mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 ${isDragActive ? 'scale-110 rotate-6' : 'hover:scale-105'}`}>
                  <Upload className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                  {isDragActive ? 'Drop your file here' : 'Upload Payment File'}
                </h3>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  Drag and drop your Excel file, or click to browse your computer
                </p>
                <Badge variant="outline" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border-slate-300">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Excel Files (.xlsx, .xls)</span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
            <div className="p-2 bg-blue-100 rounded-lg inline-flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-blue-700" />
            </div>
            <AlertDescription className="ml-2">
              <strong className="text-blue-900">Important:</strong> The system will automatically:
              <ul className="list-disc list-inside mt-3 space-y-2 text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                  <span>Filter students by the selected branch</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                  <span>Match fee categories based on grade levels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                  <span>Validate student names against existing records</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                  <span>Use the base amount from fee categories or the amount in the file</span>
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        </>
      )}

      {/* Preview Step */}
      {currentStep === 'preview' && validationResult && (
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 animate-in fade-in duration-500">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <div className="p-2 bg-slate-200 rounded-lg">
                <Eye className="h-5 w-5 text-slate-700" />
              </div>
              Preview and Validation
            </CardTitle>
            <CardDescription className="mt-2">
              Review the parsed data and validation results before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100/70 border-blue-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardContent className="p-6 relative z-10">
                  <p className="text-sm text-blue-600 font-semibold mb-2">Total Records</p>
                  <p className="text-4xl font-bold text-blue-900 tracking-tight">{validationResult.summary.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 via-green-50 to-green-100/70 border-green-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardContent className="p-6 relative z-10">
                  <p className="text-sm text-green-600 font-semibold mb-2">Valid Records</p>
                  <p className="text-4xl font-bold text-green-900 tracking-tight">{validationResult.summary.valid}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 via-red-50 to-red-100/70 border-red-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardContent className="p-6 relative z-10">
                  <p className="text-sm text-red-600 font-semibold mb-2">Invalid Records</p>
                  <p className="text-4xl font-bold text-red-900 tracking-tight">{validationResult.summary.invalid}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 via-purple-50 to-purple-100/70 border-purple-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardContent className="p-6 relative z-10">
                  <p className="text-sm text-purple-600 font-semibold mb-2">Total Amount</p>
                  <p className="text-4xl font-bold text-purple-900 tracking-tight">
                    {formatCurrency(validationResult.summary.totalAmount, currency)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Invalid Rows */}
            {validationResult.invalidRows.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Invalid Records ({validationResult.invalidRows.length})
                </h3>
                <div className="rounded-lg border border-red-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50">
                        <TableHead>SN</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.invalidRows
                        .slice((invalidRowsPage - 1) * invalidRowsPerPage, invalidRowsPage * invalidRowsPerPage)
                        .map((row, idx) => (
                          <TableRow key={idx} className="bg-red-50/50 hover:bg-red-50 transition-colors">
                            <TableCell>{row.SN}</TableCell>
                            <TableCell className="font-medium">{row.Name}</TableCell>
                            <TableCell>{row.Grade}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(row.total_amount || 0, currency)}</TableCell>
                            <TableCell className="text-red-600 text-sm">{row.error}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Invalid Rows Pagination */}
                {validationResult.invalidRows.length > invalidRowsPerPage && (
                  <div className="flex items-center justify-between pt-3 border-t border-red-200">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-600 font-medium">
                        Showing <span className="text-slate-800 font-bold">{((invalidRowsPage - 1) * invalidRowsPerPage) + 1}</span> to{' '}
                        <span className="text-slate-800 font-bold">{Math.min(invalidRowsPage * invalidRowsPerPage, validationResult.invalidRows.length)}</span> of{' '}
                        <span className="text-slate-800 font-bold">{validationResult.invalidRows.length}</span> invalid records
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-600 font-medium">Rows per page:</p>
                        <Select
                          value={invalidRowsPerPage.toString()}
                          onValueChange={(value) => {
                            setInvalidRowsPerPage(Number(value));
                            setInvalidRowsPage(1);
                          }}
                        >
                          <SelectTrigger className="w-[70px]">
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
                          onClick={() => setInvalidRowsPage(invalidRowsPage - 1)}
                          disabled={invalidRowsPage === 1}
                          className="hover:bg-red-50 hover:border-red-300 transition-all"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">
                          <span className="text-sm text-slate-700 font-medium">
                            Page <span className="font-bold">{invalidRowsPage}</span> of <span className="font-bold">{Math.ceil(validationResult.invalidRows.length / invalidRowsPerPage)}</span>
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInvalidRowsPage(invalidRowsPage + 1)}
                          disabled={invalidRowsPage === Math.ceil(validationResult.invalidRows.length / invalidRowsPerPage)}
                          className="hover:bg-red-50 hover:border-red-300 transition-all"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Valid Rows Preview */}
            {validationResult.validRows.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Valid Records ({validationResult.validRows.length})
                </h3>
                <div className="rounded-lg border border-green-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50">
                        <TableHead>SN</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.validRows
                        .slice((validRowsPage - 1) * validRowsPerPage, validRowsPage * validRowsPerPage)
                        .map((row, idx) => (
                          <TableRow key={idx} className="bg-green-50/50 hover:bg-green-50 transition-colors">
                            <TableCell>{row.SN}</TableCell>
                            <TableCell className="font-medium">{row.Name}</TableCell>
                            <TableCell>{row.Grade}</TableCell>
                            <TableCell>
                              {row.fee_items && row.fee_items.length > 0 ? (
                                <div className="space-y-1">
                                  {row.fee_items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="text-xs">
                                      {item.fee_category_name}: {formatCurrency(item.amount, currency)}
                                    </div>
                                  ))}
                                  <div className="font-semibold text-sm border-t pt-1">
                                    Total: {formatCurrency(row.total_amount || 0, currency)}
                                  </div>
                                </div>
                              ) : (
                                formatCurrency(row.total_amount || 0, currency)
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-600 text-white">
                                Ready
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Valid Rows Pagination */}
                {validationResult.validRows.length > validRowsPerPage && (
                  <div className="flex items-center justify-between pt-3 border-t border-green-200">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-600 font-medium">
                        Showing <span className="text-slate-800 font-bold">{((validRowsPage - 1) * validRowsPerPage) + 1}</span> to{' '}
                        <span className="text-slate-800 font-bold">{Math.min(validRowsPage * validRowsPerPage, validationResult.validRows.length)}</span> of{' '}
                        <span className="text-slate-800 font-bold">{validationResult.validRows.length}</span> valid records
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-600 font-medium">Rows per page:</p>
                        <Select
                          value={validRowsPerPage.toString()}
                          onValueChange={(value) => {
                            setValidRowsPerPage(Number(value));
                            setValidRowsPage(1);
                          }}
                        >
                          <SelectTrigger className="w-[70px]">
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
                          onClick={() => setValidRowsPage(validRowsPage - 1)}
                          disabled={validRowsPage === 1}
                          className="hover:bg-green-50 hover:border-green-300 transition-all"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">
                          <span className="text-sm text-slate-700 font-medium">
                            Page <span className="font-bold">{validRowsPage}</span> of <span className="font-bold">{Math.ceil(validationResult.validRows.length / validRowsPerPage)}</span>
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setValidRowsPage(validRowsPage + 1)}
                          disabled={validRowsPage === Math.ceil(validationResult.validRows.length / validRowsPerPage)}
                          className="hover:bg-green-50 hover:border-green-300 transition-all"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={resetImport}
                className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-300"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={validationResult.validRows.length === 0 || importPaymentsMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {importPaymentsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing... {importProgress}%
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Import {validationResult.validRows.length} Payments
                  </>
                )}
              </Button>
            </div>

            {importPaymentsMutation.isPending && (
              <div className="space-y-3 animate-in fade-in duration-300">
                <Progress value={importProgress} className="w-full h-3" />
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <p className="text-sm text-center text-slate-700 font-medium">
                    Importing payments... <span className="font-bold text-blue-700">{importProgress}%</span>
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Results Step */}
      {currentStep === 'import' && importResults && (
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              {importResults.successful > 0 ? (
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-700" />
                </div>
              ) : (
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-700" />
                </div>
              )}
              Import Complete
            </CardTitle>
            <CardDescription className="mt-2">
              Import operation finished - review the results below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-green-50 via-green-50 to-green-100/70 border-green-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardContent className="p-8 relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-green-600 font-semibold">Successful Imports</p>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-700" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-green-900 tracking-tight">{importResults.successful}</p>
                  <p className="text-xs text-green-600 mt-2">Payments successfully created</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 via-red-50 to-red-100/70 border-red-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardContent className="p-8 relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-red-600 font-semibold">Failed Imports</p>
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-700" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-red-900 tracking-tight">{importResults.failed}</p>
                  <p className="text-xs text-red-600 mt-2">Payments that could not be created</p>
                </CardContent>
              </Card>
            </div>

            {importResults.errors.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-500">
                <h3 className="font-bold text-red-800 flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5" />
                  Error Details
                </h3>
                <div className="max-h-64 overflow-y-auto rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6 shadow-inner">
                  <ul className="space-y-2 text-sm text-red-800">
                    {importResults.errors.map((error: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 p-2 bg-white/60 rounded-lg">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0"></span>
                        <span className="font-medium">{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <Button
              onClick={resetImport}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-300 text-lg py-6"
            >
              <Upload className="h-5 w-5 mr-2" />
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
