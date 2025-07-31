import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Users, 
  DollarSign, 
  Activity,
  Download,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { ImportResult } from './PaymentImportProcessor';
import * as XLSX from 'xlsx';

interface PaymentImportResultsProps {
  result: ImportResult;
  onStartNew: () => void;
}

export const PaymentImportResults = ({ result, onStartNew }: PaymentImportResultsProps) => {
  const [activeTab, setActiveTab] = useState('summary');

  const getStatusColor = (status: 'success' | 'error') => {
    return status === 'success' ? 'text-green-600' : 'text-red-600';
  };

  const getOperationIcon = (type: 'update' | 'skip' | 'error') => {
    switch (type) {
      case 'update':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'skip':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getErrorSeverityColor = (severity: 'error' | 'warning') => {
    return severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ETB`;
  };

  const formatCycle = (cycle: string) => {
    const cycleLabels: Record<string, string> = {
      'registration_fee': 'Registration Fee',
      '1st_quarter': '1st Quarter',
      '2nd_quarter': '2nd Quarter',
      '3rd_quarter': '3rd Quarter',
      '4th_quarter': '4th Quarter',
      '1st_semester': '1st Semester',
      '2nd_semester': '2nd Semester',
      'annual': 'Annual'
    };
    return cycleLabels[cycle] || cycle;
  };

  const exportResults = (format: 'excel' | 'csv') => {
    const exportData = {
      Summary: [{
        'Total Records': result.totalRecords,
        'Successful Updates': result.successCount,
        'Errors': result.errorCount,
        'Students Not Found': result.notFoundCount,
        'Duplicate/Skipped': result.duplicateCount,
        'Processing Time (ms)': result.processingTimeMs,
        'Total Amount Processed': formatCurrency(result.summary.totalAmountProcessed),
        'Students Updated': result.summary.studentsUpdated,
        'Payment Cycles': result.summary.cyclesProcessed.join(', ')
      }],
      Operations: result.operations.map(op => ({
        'Type': op.type,
        'Student ID': op.studentId,
        'Student Name': op.studentName,
        'Payment Cycle': formatCycle(op.paymentCycle),
        'Amount': formatCurrency(op.amount),
        'Previous Status': op.previousStatus || '',
        'New Status': op.newStatus,
        'Message': op.message
      })),
      Errors: result.errors.map(err => ({
        'Row': err.row,
        'Student ID': err.studentId || '',
        'Student Name': err.studentName || '',
        'Error': err.error,
        'Severity': err.severity
      }))
    };

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      
      Object.entries(exportData).forEach(([sheetName, data]) => {
        if (data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      });
      
      const fileName = `payment_import_results_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } else {
      // Export as separate CSV files
      Object.entries(exportData).forEach(([sheetName, data]) => {
        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          const csvContent = [
            headers.join(','),
            ...data.map(row => 
              headers.map(header => {
                const value = row[header as keyof typeof row];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
              }).join(',')
            )
          ].join('\n');
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const fileName = `payment_import_${sheetName.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
          
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          link.click();
        }
      });
    }
  };

  const successRate = result.totalRecords > 0 ? (result.successCount / result.totalRecords) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Alert className={`border-l-4 ${result.status === 'success' ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
        <Activity className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span className={getStatusColor(result.status)}>
            Import {result.status === 'success' ? 'completed successfully' : 'completed with errors'}
          </span>
          <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
            {successRate.toFixed(1)}% Success Rate
          </Badge>
        </AlertDescription>
      </Alert>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-green-600">{result.successCount}</p>
            <p className="text-sm text-gray-600">Successful Updates</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
            <p className="text-2xl font-bold text-red-600">{result.errorCount}</p>
            <p className="text-sm text-gray-600">Errors</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-600">{formatCurrency(result.summary.totalAmountProcessed)}</p>
            <p className="text-sm text-gray-600">Total Processed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-blue-600">{result.summary.studentsUpdated}</p>
            <p className="text-sm text-gray-600">Students Updated</p>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Processing Summary</span>
            <Badge variant="outline">{(result.processingTimeMs / 1000).toFixed(2)}s</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Success Rate</span>
                <span>{successRate.toFixed(1)}%</span>
              </div>
              <Progress value={successRate} className="h-2" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium">Total Records: {result.totalRecords}</p>
                <p className="text-green-600">✓ Successful: {result.successCount}</p>
              </div>
              <div>
                <p className="text-red-600">✗ Errors: {result.errorCount}</p>
                <p className="text-yellow-600">⚠ Not Found: {result.notFoundCount}</p>
              </div>
              <div>
                <p className="text-blue-600">⊡ Skipped: {result.duplicateCount}</p>
                <p className="text-gray-600">Cycles: {result.summary.cyclesProcessed.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Activity Center
            <div className="flex gap-2">
              <Button onClick={() => exportResults('excel')} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button onClick={() => exportResults('csv')} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="operations">Operations ({result.operations.length})</TabsTrigger>
              <TabsTrigger value="errors">Errors ({result.errors.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Payment Cycles Processed</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.summary.cyclesProcessed.map(cycle => (
                      <Badge key={cycle} variant="outline">
                        {formatCycle(cycle)}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Processing Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Records Processed:</span>
                        <span className="font-medium">{result.totalRecords}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Successful Updates:</span>
                        <span className="font-medium text-green-600">{result.successCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Students Not Found:</span>
                        <span className="font-medium text-yellow-600">{result.notFoundCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duplicates/Skipped:</span>
                        <span className="font-medium text-blue-600">{result.duplicateCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing Errors:</span>
                        <span className="font-medium text-red-600">{result.errorCount}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Financial Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Amount Processed:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(result.summary.totalAmountProcessed)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Students Updated:</span>
                        <span className="font-medium">{result.summary.studentsUpdated}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Payment:</span>
                        <span className="font-medium">
                          {result.summary.studentsUpdated > 0 
                            ? formatCurrency(result.summary.totalAmountProcessed / result.summary.studentsUpdated)
                            : formatCurrency(0)
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="mt-4">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Payment Cycle</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.operations.map((operation, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getOperationIcon(operation.type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{operation.studentName}</p>
                            <p className="text-sm text-gray-500">{operation.studentId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatCycle(operation.paymentCycle)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(operation.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {operation.previousStatus}
                            </Badge>
                            <span>→</span>
                            <Badge variant="outline" className="text-xs">
                              {operation.newStatus}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {operation.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="errors" className="mt-4">
              {result.errors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p>No errors encountered during import!</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">
                            {error.row || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getErrorSeverityColor(error.severity)}>
                              {error.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              {error.studentName && (
                                <p className="font-medium">{error.studentName}</p>
                              )}
                              {error.studentId && (
                                <p className="text-sm text-gray-500">{error.studentId}</p>
                              )}
                              {!error.studentName && !error.studentId && (
                                <span className="text-gray-400">Unknown</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {error.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button onClick={onStartNew} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Import More Payments
        </Button>
      </div>
    </div>
  );
};