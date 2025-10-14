import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';
import type {
  BulkPaymentImportRequest,
  BulkPaymentImportResult,
  BulkImportValidationInfo,
  GradeLevelFeeRate
} from '@/types/api';

interface GradeLevelBulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  onSuccess: () => void;
}

export function GradeLevelBulkImportModal({
  open,
  onOpenChange,
  branchId,
  onSuccess
}: GradeLevelBulkImportModalProps) {
  const academicYearQuery = useAcademicYear();
  const currentAcademicYear = getAcademicYearString(academicYearQuery);

  const [step, setStep] = useState<'upload' | 'processing' | 'results'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [importRequest, setImportRequest] = useState<BulkPaymentImportRequest>({
    branch_id: branchId,
    academic_year: currentAcademicYear,
    payment_period: `Q${Math.floor((new Date().getMonth() + 3) / 3)} ${new Date().getFullYear()}`,
    fee_type: 'quarterly',
    due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    validate_only: false,
    notes: ''
  });
  const [importResult, setImportResult] = useState<BulkPaymentImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationInfo, setValidationInfo] = useState<BulkImportValidationInfo | null>(null);
  const [gradeRates, setGradeRates] = useState<GradeLevelFeeRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load validation info and grade rates when modal opens
  useEffect(() => {
    if (open) {
      loadValidationInfo();
      loadGradeRates();
    }
  }, [open, branchId]);

  const loadValidationInfo = async () => {
    try {
      const response = await apiClient.getGradeLevelBulkImportValidation();
      if (response.data) {
        setValidationInfo(response.data);
      }
    } catch (error) {
      console.error('Failed to load validation info:', error);
    }
  };

  const loadGradeRates = async () => {
    setIsLoadingRates(true);
    try {
      const response = await apiClient.getGradeLevelFeeRates({
        branch_id: branchId,
        academic_year: importRequest.academic_year,
        is_active: true
      });
      if (response.data) {
        setGradeRates(response.data);
      } else if (response.error) {
        toast.error('Failed to load grade-level rates: ' + response.error);
      }
    } catch (error) {
      console.error('Failed to load grade rates:', error);
      toast.error('Failed to load grade-level rates');
    } finally {
      setIsLoadingRates(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedExtensions = ['.csv', '.xlsx'];
      const hasValidExtension = allowedExtensions.some(ext =>
        selectedFile.name.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        toast.error('Please select a CSV or Excel (.xlsx) file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleValidateOnly = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    const validationRequest = { ...importRequest, validate_only: true };
    await processImport(validationRequest);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    const importRequestFinal = { ...importRequest, validate_only: false };
    await processImport(importRequestFinal);
  };

  const processImport = async (request: BulkPaymentImportRequest) => {
    if (!file) return;

    setIsProcessing(true);
    setStep('processing');

    try {
      const response = await apiClient.bulkImportGradeLevelPayments(file, request);

      if (response.data) {
        setImportResult(response.data);
        setStep('results');

        if (response.data.status === 'completed' && !request.validate_only) {
          toast.success(`Successfully imported ${response.data.successful_imports} payments`);
          onSuccess();
        } else if (response.data.failed_imports > 0) {
          toast.warning(`Import completed with ${response.data.failed_imports} errors`);
        } else if (request.validate_only) {
          toast.success('Validation completed successfully');
        }
      } else if (response.error) {
        toast.error('Import failed: ' + response.error);
        setStep('upload');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    if (!validationInfo) return;

    const csvContent = [
      validationInfo.required_columns.concat(validationInfo.optional_columns).join(','),
      Object.values(validationInfo.example_row).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grade_level_bulk_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setStep('upload');
    setFile(null);
    setImportResult(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const getCurrentRateInfo = () => {
    if (isLoadingRates) {
      return <div className="text-sm text-muted-foreground">Loading current rates...</div>;
    }

    if (gradeRates.length === 0) {
      return (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No grade-level fee rates configured for {importRequest.academic_year}.
            Please configure rates before importing payments.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Current Grade-Level Rates ({importRequest.academic_year})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {gradeRates.map((rate) => (
              <div key={rate.id} className="flex justify-between items-center py-1 px-2 bg-muted rounded">
                <span className="font-medium">{rate.grade_range}</span>
                <div className="text-right">
                  <div>Reg: ${rate.registration_fee}</div>
                  <div>Quarterly: ${rate.quarterly_fee}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Grade-Level Bulk Payment Import
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            {getCurrentRateInfo()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="academic_year">Academic Year</Label>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-700 font-medium">
                    {currentAcademicYear}
                  </div>
                  <p className="text-xs text-gray-500">Automatically set from system configuration</p>
                </div>

                <div>
                  <Label htmlFor="payment_period">Payment Period</Label>
                  <Input
                    id="payment_period"
                    value={importRequest.payment_period}
                    onChange={(e) => setImportRequest(prev => ({ ...prev, payment_period: e.target.value }))}
                    placeholder="Q1 2024, Registration 2024, etc."
                  />
                </div>

                <div>
                  <Label htmlFor="fee_type">Fee Type</Label>
                  <Select
                    value={importRequest.fee_type}
                    onValueChange={(value: 'registration' | 'quarterly') =>
                      setImportRequest(prev => ({ ...prev, fee_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registration">Registration Fee</SelectItem>
                      <SelectItem value="quarterly">Quarterly Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={importRequest.due_date}
                    onChange={(e) => setImportRequest(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={importRequest.notes || ''}
                    onChange={(e) => setImportRequest(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes for this import"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">File Upload</h3>
                {validationInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                )}
              </div>

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="mb-2"
                    >
                      Select File
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      or drag and drop your CSV or Excel file here
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {file && (
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 text-sm">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {validationInfo && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      File Format Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Supported File Types:</h4>
                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge variant="outline" className="text-xs">CSV (.csv)</Badge>
                        <Badge variant="outline" className="text-xs">Excel (.xlsx)</Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Required Columns:</h4>
                      <div className="flex flex-wrap gap-1">
                        {validationInfo.required_columns.map((col) => (
                          <Badge key={col} variant="default" className="text-xs">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Optional Columns:</h4>
                      <div className="flex flex-wrap gap-1">
                        {validationInfo.optional_columns.map((col) => (
                          <Badge key={col} variant="secondary" className="text-xs">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Supported Grade Levels:</h4>
                      <div className="text-xs space-y-1">
                        {Object.entries(validationInfo.supported_grade_levels).map(([range, levels]) => (
                          <div key={range} className="flex gap-2">
                            <span className="font-medium min-w-[60px]">{range}:</span>
                            <span className="text-muted-foreground">{levels.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleValidateOnly}
                disabled={!file || gradeRates.length === 0}
              >
                Validate Only
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || gradeRates.length === 0}
              >
                Import Payments
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <h3 className="mt-4 text-lg font-medium">
                {importRequest.validate_only ? 'Validating' : 'Processing'} Import...
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Please wait while we process your CSV file
              </p>
            </div>
            <Progress value={50} className="w-full" />
          </div>
        )}

        {step === 'results' && importResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Total Items</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold">{importResult.total_items}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-green-600">Successful</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.successful_imports}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-red-600">Failed</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold text-red-600">
                    {importResult.failed_imports}
                  </div>
                </CardContent>
              </Card>
            </div>

            {importResult.import_summary?.grade_breakdown && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Grade-Level Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(importResult.import_summary.grade_breakdown).map(([grade, data]) => (
                      <div key={grade} className="flex justify-between items-center py-2 px-3 bg-muted rounded">
                        <span className="font-medium">Grade {grade}</span>
                        <div className="text-right text-sm">
                          <div>{data.count} students</div>
                          <div className="text-muted-foreground">${data.total_amount}</div>
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between items-center py-2 px-3 font-medium">
                      <span>Total</span>
                      <span>${importResult.import_summary.total_amount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {importResult.validation_errors && importResult.validation_errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Validation Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {importResult.validation_errors.map((error, index) => (
                      <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        <span className="font-medium">Row {error.row}:</span> {error.error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={resetModal}>
                Import More
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}