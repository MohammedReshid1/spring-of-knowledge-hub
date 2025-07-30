import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Users, FileText, AlertTriangle } from 'lucide-react';
import type { SyncResult } from './types';

interface SyncReportProps {
  results: SyncResult;
  isDryRun: boolean;
}

export const SyncReport: React.FC<SyncReportProps> = ({ results, isDryRun }) => {
  const totalChanges = isDryRun 
    ? results.studentsToCreate + results.studentsToReassign
    : results.studentsCreated + results.studentsReassigned;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Sync Summary Report
        </CardTitle>
        <CardDescription>
          {isDryRun ? 'Preview of planned changes' : 'Applied changes summary'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Processing Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{results.totalFiles}</div>
            <div className="text-sm text-muted-foreground">Total Files</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">{results.filesProcessed}</div>
            <div className="text-sm text-muted-foreground">Files Processed</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{results.classesCreated}</div>
            <div className="text-sm text-muted-foreground">Classes {isDryRun ? 'To Create' : 'Created'}</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{totalChanges}</div>
            <div className="text-sm text-muted-foreground">Total {isDryRun ? 'Planned' : 'Applied'} Changes</div>
          </div>
        </div>

        {/* Student Changes */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Changes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">New Students</span>
                <Badge variant="default">
                  {isDryRun ? results.studentsToCreate : results.studentsCreated}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Students {isDryRun ? 'to be created' : 'created'} in the system
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Reassigned Students</span>
                <Badge variant="secondary">
                  {isDryRun ? results.studentsToReassign : results.studentsReassigned}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Students {isDryRun ? 'to be moved' : 'moved'} to correct classes
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Unchanged Students</span>
                <Badge variant="outline">{results.studentsUnchanged}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Students already in correct classes
              </p>
            </div>
          </div>
        </div>

        {/* Payment Updates */}
        {results.paymentUpdateResult && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Payment Updates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Students Processed</span>
                  <Badge variant="default">{results.paymentUpdateResult.studentsProcessed}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pre-KG, KG, and Prep students checked
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Payments Updated</span>
                  <Badge variant="default">{results.paymentUpdateResult.updatedPayments}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Registration and First Semester fees marked as paid
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {results.errors.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Errors ({results.errors.length})
            </h3>
            <div className="space-y-2">
              {results.errors.map((error, index) => (
                <div key={index} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Message */}
        {results.errors.length === 0 && !isDryRun && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Synchronization completed successfully with no errors!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};