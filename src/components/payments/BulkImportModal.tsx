import React, { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, AlertCircle, CheckCircle2, X, Download, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { cn } from '@/lib/utils';
import type { BulkPaymentImport } from '@/types/api';

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function BulkImportModal({ open, onOpenChange, onSuccess }: BulkImportModalProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validateOnly, setValidateOnly] = useState(true);
  const [academicYear, setAcademicYear] = useState('');
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'processing' | 'results'>('upload');

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: (options: { file: File; validateOnly: boolean; academicYear?: string }) => {
      return apiClient.uploadBulkPaymentFile(options.file, {
        validate_only: options.validateOnly,
        branch_id: branchId,
        academic_year: options.academicYear,
      });
    },
    onSuccess: (response) => {
      if (response.data) {
        setCurrentImportId(response.data.id);
        setStep('processing');
        if (validateOnly) {
          toast({
            title: 'Validation Started',
            description: 'File uploaded successfully. Validation in progress...',
          });
        } else {
          toast({
            title: 'Import Started',
            description: 'File uploaded successfully. Import in progress...',
          });
        }
      }
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });

  // Poll import status
  const { data: importStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['bulk-import-status', currentImportId],
    queryFn: () => apiClient.getBulkImportStatus(currentImportId!),
    enabled: !!currentImportId && step === 'processing',
    refetchInterval: (data) => {
      // Stop polling if completed or failed
      if (data?.data?.status === 'completed' || data?.data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    select: (resp) => (resp as any).data?.data ?? (resp as any).data,
  });

  // Academic years for selection
  const currentYear = new Date().getFullYear();
  const academicYears = [
    `${currentYear - 1}-${currentYear}`,
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
  ];

  // Move to results when processing is done
  React.useEffect(() => {
    if (importStatus && (importStatus.status === 'completed' || importStatus.status === 'failed')) {
      setStep('results');
    }
  }, [importStatus]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    const fileType = file.type;
    const validTypes = Object.keys(ACCEPTED_FILE_TYPES);
    if (!validTypes.includes(fileType) && !file.name.match(/\.(csv|xls|xlsx)$/i)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a CSV or Excel file (.csv, .xls, .xlsx)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'File size must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    uploadMutation.mutate({
      file: selectedFile,
      validateOnly,
      academicYear: academicYear || undefined,
    });
  };

  const resetModal = () => {
    setSelectedFile(null);
    setCurrentImportId(null);
    setStep('upload');
    setValidateOnly(true);
    setAcademicYear('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const handleProcessData = () => {
    if (!selectedFile) return;

    setValidateOnly(false);
    setCurrentImportId(null);
    setStep('upload');

    // Upload again for actual processing
    uploadMutation.mutate({
      file: selectedFile,
      validateOnly: false,
      academicYear: academicYear || undefined,
    });
  };

  const downloadTemplate = () => {
    // Create a sample CSV template
    const headers = [
      'student_id',
      'fee_category_name',
      'amount',
      'payment_method',
      'payment_date',
      'due_date',
      'reference_number',
      'notes',
      'discount_amount'
    ];

    const sampleData = [
      'STU001,Tuition Fee,1000,cash,2024-01-15,2024-01-31,REF001,Monthly tuition,0',
      'STU002,Lab Fee,50,card,2024-01-16,2024-01-31,REF002,Chemistry lab,5',
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payment_import_template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const getProgressValue = () => {
    if (!importStatus) return 0;
    if (importStatus.total_records === 0) return 0;
    return Math.round((importStatus.processed_records / importStatus.total_records) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-xl">
        {/* Premium Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

        <DialogHeader className="relative pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
              Bulk Payment Import
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600 leading-relaxed">
            Import multiple payments from CSV or Excel file with advanced validation and processing
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            {/* Premium Template Download */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-2xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-2xl pointer-events-none"></div>

              <div className="relative flex items-center justify-between p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Need a template?</p>
                    <p className="text-sm text-slate-600">
                      Download our sample template to get started with the correct format
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  size="sm"
                  className="group relative overflow-hidden bg-white/80 border-blue-200/50 hover:bg-blue-50 hover:border-blue-300 text-blue-700 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  Download Template
                </Button>
              </div>
            </div>

            {/* Premium File Upload Area */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
                <CardContent className="pt-6">
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 transform",
                      dragActive ? "border-blue-400 bg-blue-50/80 scale-105 shadow-lg" : "border-slate-300",
                      selectedFile ? "border-emerald-400 bg-emerald-50/80 shadow-lg" : "hover:border-blue-300 hover:bg-blue-50/40"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {selectedFile ? (
                      <div className="space-y-5">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                          <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg text-slate-900">{selectedFile.name}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to process
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                          className="group relative overflow-hidden bg-white/80 border-slate-200 hover:bg-red-50 hover:border-red-300 text-slate-700 hover:text-red-700 shadow-sm hover:shadow-md transition-all duration-300"
                        >
                          <X className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                          Remove File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                          <Upload className="h-16 w-16 text-blue-600 mx-auto" />
                        </div>
                        <div>
                          <p className="text-xl font-semibold text-slate-900">
                            Drop your file here, or{' '}
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors duration-200"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              browse
                            </button>
                          </p>
                          <p className="text-sm text-slate-600 mt-2">
                            Supports CSV, XLS, XLSX files up to 10MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileSelect}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Premium Options */}
            {selectedFile && (
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Import Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="academic-year">Academic Year</Label>
                      <Select value={academicYear} onValueChange={setAcademicYear}>
                        <SelectTrigger id="academic-year">
                          <SelectValue placeholder="Select academic year (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {academicYears.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                      <div className="flex items-center space-x-3 p-4 rounded-2xl bg-blue-50/50 border border-blue-200/30">
                        <Checkbox
                          id="validate-only"
                          checked={validateOnly}
                          onCheckedChange={(checked) => setValidateOnly(checked as boolean)}
                          className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <Label htmlFor="validate-only" className="text-sm font-medium text-slate-700">
                          Validate only (don't import data yet)
                        </Label>
                      </div>

                      {!validateOnly && (
                        <Alert className="border-amber-200 bg-amber-50/50 text-amber-800">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="font-medium">
                            This will immediately import all valid payments from the file.
                            Make sure you have reviewed the data first.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && importStatus && (
          <div className="space-y-6 relative">
            <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                  <span>
                    {validateOnly ? 'Validating Data...' : 'Importing Payments...'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Progress value={getProgressValue()} className="w-full h-3 bg-slate-200" />
                  <div className="text-center text-sm font-medium text-slate-700">
                    {importStatus.processed_records} of {importStatus.total_records} records processed
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 text-center">
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/50">
                    <div className="text-3xl font-bold text-blue-600">
                      {importStatus.total_records}
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-1">Total Records</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/50">
                    <div className="text-3xl font-bold text-emerald-600">
                      {importStatus.successful_imports}
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-1">
                      {validateOnly ? 'Valid' : 'Successful'}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200/50">
                    <div className="text-3xl font-bold text-red-600">
                      {importStatus.failed_imports}
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-1">
                      {validateOnly ? 'Invalid' : 'Failed'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'results' && importStatus && (
          <div className="space-y-6 relative">
            <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  <div className={cn(
                    "p-2 rounded-xl border",
                    importStatus.status === 'completed'
                      ? "bg-gradient-to-br from-emerald-100 to-green-100 border-emerald-200/50"
                      : "bg-gradient-to-br from-red-100 to-red-100 border-red-200/50"
                  )}>
                    {importStatus.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <span>
                    {validateOnly ? 'Validation Complete' : 'Import Complete'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/50">
                    <div className="text-3xl font-bold text-blue-600">
                      {importStatus.total_records}
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-1">Total Records</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/50">
                    <div className="text-3xl font-bold text-emerald-600">
                      {importStatus.successful_imports}
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-1">
                      {validateOnly ? 'Valid Records' : 'Imported Successfully'}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200/50">
                    <div className="text-3xl font-bold text-red-600">
                      {importStatus.failed_imports}
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-1">
                      {validateOnly ? 'Invalid Records' : 'Import Failures'}
                    </div>
                  </div>
                </div>

                {importStatus.error_summary && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900">Error Summary:</h4>
                    <pre className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm overflow-auto max-h-40 text-slate-700">
                      {importStatus.error_summary}
                    </pre>
                  </div>
                )}

                {validateOnly && importStatus.successful_imports > 0 && (
                  <Alert className="border-emerald-200 bg-emerald-50/50 text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="font-medium">
                      Validation successful! {importStatus.successful_imports} records are ready to import.
                      You can now proceed with the actual import.
                    </AlertDescription>
                  </Alert>
                )}

                {!validateOnly && importStatus.status === 'completed' && (
                  <Alert className="border-emerald-200 bg-emerald-50/50 text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="font-medium">
                      Import completed successfully! {importStatus.successful_imports} payments have been imported.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="relative pt-6 border-t border-slate-200/50">
          {step === 'upload' && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm hover:shadow-md transition-all duration-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {uploadMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
                    {validateOnly ? 'Validate File' : 'Import Payments'}
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'processing' && (
            <Button
              variant="outline"
              onClick={handleClose}
              className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm hover:shadow-md transition-all duration-300"
            >
              Cancel
            </Button>
          )}

          {step === 'results' && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm hover:shadow-md transition-all duration-300"
              >
                Close
              </Button>
              {validateOnly && importStatus?.successful_imports! > 0 && (
                <Button
                  onClick={handleProcessData}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Upload className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  Proceed with Import
                </Button>
              )}
              {!validateOnly && (
                <Button
                  onClick={() => {
                    onSuccess?.();
                    handleClose();
                  }}
                  className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <CheckCircle2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  View Payments
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
