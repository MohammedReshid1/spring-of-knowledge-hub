import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Activity, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PaymentImportProcessor, ImportResult } from './PaymentImportProcessor';
import { PaymentImportResults } from './PaymentImportResults';

export const BulkPaymentImport = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processor = new PaymentImportProcessor();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV or Excel (.xlsx) file",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      toast({
        title: "File Selected",
        description: `${file.name} is ready for processing`,
      });
    }
  };

  const processPayments = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV or Excel file first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentOperation('Preparing file...');

    try {
      const result = await processor.processFile(selectedFile, {
        onProgress: (progress, operation) => {
          setProgress(progress);
          setCurrentOperation(operation);
        }
      });

      setImportResult(result);
      
      toast({
        title: "Import Completed",
        description: `Successfully processed ${result.totalRecords} records. ${result.successCount} payments updated.`,
      });

    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentOperation('');
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
    setProgress(0);
    setCurrentOperation('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200">
          <Upload className="h-4 w-4 mr-2" />
          Bulk Import Payments
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Student Payments
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertDescription>
              Upload a CSV or Excel file containing student payment information. 
              Required columns: Student ID/Name, Payment Cycle, Amount Paid. 
              Optional: Grade Level, Academic Year, Payment Date.
            </AlertDescription>
          </Alert>

          {/* File Selection */}
          {!importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Payment Data File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="payment-file-input"
                  />
                  <label
                    htmlFor="payment-file-input"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    <Upload className="h-12 w-12 text-gray-400" />
                    <div>
                      <p className="text-lg font-medium">Choose payment data file</p>
                      <p className="text-sm text-gray-500">CSV or Excel files only (max 10MB)</p>
                    </div>
                  </label>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={resetImport}
                      variant="outline"
                      size="sm"
                    >
                      Change File
                    </Button>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={processPayments}
                    disabled={!selectedFile || isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload and Process Payments
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 animate-spin" />
                  Processing Payments...
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-600">{currentOperation}</p>
                <div className="text-center">
                  <p className="text-lg font-medium">{progress.toFixed(0)}% Complete</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {importResult && (
            <PaymentImportResults 
              result={importResult} 
              onStartNew={resetImport}
            />
          )}

          {/* Sample Format Guide */}
          {!importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Expected File Format</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Your CSV/Excel file should contain the following columns (case-insensitive):
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-green-700 mb-2">Required Columns:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Student ID or Student Name</li>
                        <li>• Payment Cycle (Registration Fee, 1st Quarter, etc.)</li>
                        <li>• Amount Paid</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-blue-700 mb-2">Optional Columns:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Grade Level</li>
                        <li>• Academic Year</li>
                        <li>• Payment Date</li>
                        <li>• Notes</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Sample Format:</h4>
                    <code className="text-xs">
                      Student ID, Student Name, Payment Cycle, Amount Paid, Grade Level<br/>
                      SCH-2024-00001, Ahmed Ali, Registration Fee, 500, Grade 1<br/>
                      SCH-2024-00002, Sara Mohammed, 1st Quarter, 300, Grade 2
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};