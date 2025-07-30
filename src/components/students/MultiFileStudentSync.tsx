import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Play, Eye, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StudentSyncProcessor } from './StudentSyncProcessor';
import { PaymentUpdater } from './PaymentUpdater';
import { SyncReport } from './SyncReport';
import type { SyncOperation, SyncResult } from './types';

export const MultiFileStudentSync = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDryRun, setIsDryRun] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [results, setResults] = useState<SyncResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const excelFiles = selectedFiles.filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (excelFiles.length !== selectedFiles.length) {
      toast({
        title: "Invalid files detected",
        description: "Only Excel files (.xlsx, .xls) are supported",
        variant: "destructive"
      });
    }
    
    setFiles(excelFiles);
    setOperations([]);
    setResults(null);
  }, [toast]);

  const handleSync = useCallback(async (dryRun: boolean = true) => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select Excel files to process",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setIsDryRun(dryRun);

    try {
      const processor = new StudentSyncProcessor();
      
      const result = await processor.processSyncFiles(
        files,
        dryRun,
        (progress, operation) => {
          setProgress(progress);
          if (operation) {
            setOperations(prev => [...prev, operation]);
          }
        }
      );

      setResults(result);
      
      if (dryRun) {
        toast({
          title: "Dry run completed",
          description: `Preview generated: ${result.studentsToCreate + result.studentsToReassign} changes planned`,
        });
      } else {
        toast({
          title: "Sync completed successfully",
          description: `${result.studentsCreated + result.studentsReassigned} students updated`,
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [files, toast]);

  const handlePaymentUpdate = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      const updater = new PaymentUpdater();
      const result = await updater.updatePreKgPayments();
      
      toast({
        title: "Payment update completed",
        description: `${result.updatedPayments} payment records updated`,
      });
      
      setResults(prev => prev ? { ...prev, paymentUpdateResult: result } : null);
    } catch (error) {
      console.error('Payment update error:', error);
      toast({
        title: "Payment update failed",
        description: error instanceof Error ? error.message : "Failed to update payments",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Multi-File Student Synchronization
          </CardTitle>
          <CardDescription>
            Upload Excel files for Grade 1-12 classes to sync student assignments and update Pre-KG/KG/Prep payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="mb-2"
              disabled={isProcessing}
            />
            {files.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {files.length} Excel files selected
              </div>
            )}
          </div>

          {files.length > 0 && !isProcessing && (
            <div className="flex gap-2">
              <Button 
                onClick={() => handleSync(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview Changes (Dry Run)
              </Button>
              <Button 
                onClick={() => handleSync(false)}
                disabled={!results || isDryRun}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Apply Changes
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {isDryRun ? 'Generating preview...' : 'Applying changes...'}
                </span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {results && !isDryRun && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Student sync completed successfully. You can now update Pre-KG/KG/Prep payments.
              </AlertDescription>
            </Alert>
          )}

          {results && !isDryRun && (
            <Button 
              onClick={handlePaymentUpdate}
              disabled={isProcessing}
              variant="secondary"
              className="w-full"
            >
              Update Pre-KG/KG/Prep Payments
            </Button>
          )}
        </CardContent>
      </Card>

      {(operations.length > 0 || results) && (
        <Tabs defaultValue="operations" className="w-full">
          <TabsList>
            <TabsTrigger value="operations">Operations Log</TabsTrigger>
            <TabsTrigger value="summary">Summary Report</TabsTrigger>
          </TabsList>
          
          <TabsContent value="operations">
            <Card>
              <CardHeader>
                <CardTitle>Operations Log</CardTitle>
                <CardDescription>
                  Detailed log of all operations {isDryRun ? '(Preview Mode)' : '(Applied)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {operations.map((op, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                      <Badge variant={op.type === 'create' ? 'default' : 'secondary'}>
                        {op.type}
                      </Badge>
                      <span>{op.studentName}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{op.className}</span>
                      {op.fromClass && (
                        <>
                          <span className="text-muted-foreground">(from {op.fromClass})</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="summary">
            {results && <SyncReport results={results} isDryRun={isDryRun} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};