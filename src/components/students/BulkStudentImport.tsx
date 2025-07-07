
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export const BulkStudentImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  const updateProgress = (current: number, total: number, status: string) => {
    const percentage = Math.round((current / total) * 100);
    setProgress(percentage);
    setCurrentStatus(status);
    console.log(`Import Progress: ${percentage}% - ${status}`);
  };

  const normalizeGradeLevel = (gradeInput: string): string => {
    const normalized = gradeInput.toLowerCase().trim();
    
    // Handle various grade formats
    const gradeMap: Record<string, string> = {
      'pre kg': 'pre_k',
      'pre-kg': 'pre_k',
      'pre k': 'pre_k',
      'prekg': 'pre_k',
      'nursery': 'pre_k',
      'kg': 'kindergarten',
      'kindergarten': 'kindergarten',
      'k': 'kindergarten',
      'class 1': 'grade_1',
      'grade 1': 'grade_1',
      '1st': 'grade_1',
      '1': 'grade_1',
      'class 2': 'grade_2',
      'grade 2': 'grade_2',
      '2nd': 'grade_2',
      '2': 'grade_2',
      'class 3': 'grade_3',
      'grade 3': 'grade_3',
      '3rd': 'grade_3',
      '3': 'grade_3',
      'class 4': 'grade_4',
      'grade 4': 'grade_4',
      '4th': 'grade_4',
      '4': 'grade_4',
      'class 5': 'grade_5',
      'grade 5': 'grade_5',
      '5th': 'grade_5',
      '5': 'grade_5',
      'class 6': 'grade_6',
      'grade 6': 'grade_6',
      '6th': 'grade_6',
      '6': 'grade_6',
      'class 7': 'grade_7',
      'grade 7': 'grade_7',
      '7th': 'grade_7',
      '7': 'grade_7',
      'class 8': 'grade_8',
      'grade 8': 'grade_8',
      '8th': 'grade_8',
      '8': 'grade_8',
    };

    // Try exact match first
    if (gradeMap[normalized]) {
      return gradeMap[normalized];
    }

    // Try partial matches
    for (const [key, value] of Object.entries(gradeMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Default fallback
    console.warn(`Could not normalize grade: "${gradeInput}", defaulting to pre_k`);
    return 'pre_k';
  };

  const normalizeGender = (genderInput: string): string => {
    const normalized = genderInput?.toLowerCase().trim();
    if (['m', 'male', 'boy'].includes(normalized)) return 'Male';
    if (['f', 'female', 'girl'].includes(normalized)) return 'Female';
    return 'Male'; // Default
  };

  const parseName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(part => part.length > 0);
    return {
      first_name: parts[0] || '',
      father_name: parts[1] || '',
      grandfather_name: parts[2] || '',
      last_name: parts.slice(1).join(' ') || parts[0] || ''
    };
  };

  const parseDate = (dateInput: any): string => {
    if (!dateInput) return new Date().toISOString().split('T')[0];
    
    // Handle Excel date numbers
    if (typeof dateInput === 'number') {
      const excelDate = new Date((dateInput - 25569) * 86400 * 1000);
      return excelDate.toISOString().split('T')[0];
    }

    // Handle date strings
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Default to current date minus some years for students
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 10);
    return defaultDate.toISOString().split('T')[0];
  };

  const processExcelData = async (jsonData: any[]) => {
    if (!jsonData || jsonData.length === 0) {
      throw new Error('No data found in the Excel file');
    }

    setIsImporting(true);
    setProgress(0);
    setCurrentStatus('Starting import...');
    setImportResult(null);

    const results: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    console.log('Raw Excel data:', jsonData);
    console.log('Sample row:', jsonData[0]);

    // Get column headers (they might have different names)
    const headers = Object.keys(jsonData[0] || {});
    console.log('Available columns:', headers);

    updateProgress(0, jsonData.length, 'Processing student data...');

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      try {
        updateProgress(i + 1, jsonData.length, `Processing student ${i + 1} of ${jsonData.length}`);

        // Skip empty rows
        if (!row || Object.values(row).every(val => !val || val.toString().trim() === '')) {
          console.log(`Skipping empty row ${i + 1}`);
          continue;
        }

        // Try to find the name field (could be various column names)
        let studentName = '';
        const nameFields = ['name', 'student_name', 'full_name', 'Name', 'Student Name', 'Full Name'];
        for (const field of nameFields) {
          if (row[field]) {
            studentName = row[field].toString().trim();
            break;
          }
        }

        if (!studentName) {
          // Try to construct name from first available text field
          const firstTextField = Object.values(row).find(val => 
            val && typeof val === 'string' && val.trim().length > 0
          );
          studentName = firstTextField?.toString().trim() || `Student ${i + 1}`;
        }

        const parsedName = parseName(studentName);

        // Try to find grade/class field
        let gradeLevel = 'pre_k';
        const gradeFields = ['grade', 'class', 'level', 'Grade', 'Class', 'Level', 'grade_level'];
        for (const field of gradeFields) {
          if (row[field]) {
            gradeLevel = normalizeGradeLevel(row[field].toString());
            break;
          }
        }

        // Try to find gender field
        let gender = 'Male';
        const genderFields = ['gender', 'sex', 'Gender', 'Sex'];
        for (const field of genderFields) {
          if (row[field]) {
            gender = normalizeGender(row[field].toString());
            break;
          }
        }

        // Try to find date of birth
        let dateOfBirth = new Date().toISOString().split('T')[0];
        const dobFields = ['date_of_birth', 'dob', 'birth_date', 'Date of Birth', 'DOB', 'Birth Date'];
        for (const field of dobFields) {
          if (row[field]) {
            dateOfBirth = parseDate(row[field]);
            break;
          }
        }

        // Try to find other fields
        const motherName = row['mother_name'] || row['Mother Name'] || row['mother'] || '';
        const address = row['address'] || row['Address'] || '';
        const phone = row['phone'] || row['Phone'] || row['contact'] || '';
        const email = row['email'] || row['Email'] || '';

        const studentData = {
          student_id: '', // Will be auto-generated
          first_name: parsedName.first_name,
          last_name: parsedName.last_name,
          father_name: parsedName.father_name,
          grandfather_name: parsedName.grandfather_name,
          mother_name: motherName.toString().trim() || null,
          date_of_birth: dateOfBirth,
          grade_level: gradeLevel as any,
          gender: gender,
          address: address.toString().trim() || null,
          phone: phone.toString().trim() || null,
          email: email.toString().trim() || null,
          status: 'Active' as const,
          admission_date: new Date().toISOString().split('T')[0]
        };

        console.log(`Inserting student ${i + 1}:`, studentData);

        const { error } = await supabase
          .from('students')
          .insert(studentData);

        if (error) {
          console.error(`Error inserting student ${i + 1}:`, error);
          results.errors.push(`Row ${i + 1} (${studentName}): ${error.message}`);
          results.failed++;
        } else {
          console.log(`Successfully inserted student ${i + 1}: ${studentName}`);
          results.success++;
        }

        // Small delay to prevent overwhelming the database
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`Unexpected error processing row ${i + 1}:`, error);
        results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.failed++;
      }
    }

    setImportResult(results);
    setIsImporting(false);
    setProgress(100);
    setCurrentStatus('Import completed!');

    if (results.success > 0) {
      onImportComplete();
      toast({
        title: "Import Completed",
        description: `Successfully imported ${results.success} students${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
      });
    } else {
      toast({
        title: "Import Failed",
        description: "No students were imported successfully",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Excel file processed:', jsonData.length, 'rows found');
        await processExcelData(jsonData);
      } catch (error) {
        console.error('Error processing file:', error);
        setIsImporting(false);
        toast({
          title: "File Processing Error",
          description: error instanceof Error ? error.message : "Failed to process the Excel file",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/student-import-template.csv';
    link.download = 'student-import-template.csv';
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Student Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={downloadTemplate} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isImporting}
            />
            <Button disabled={isImporting} asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? 'Importing...' : 'Select Excel File'}
              </span>
            </Button>
          </label>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{currentStatus}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {importResult && (
          <div className="space-y-2">
            <Alert className={importResult.success > 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {importResult.success > 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>
                  Import completed: {importResult.success} successful, {importResult.failed} failed
                </AlertDescription>
              </div>
            </Alert>

            {importResult.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded text-sm">
                <p className="font-medium text-red-600 mb-2">Errors:</p>
                {importResult.errors.slice(0, 10).map((error, index) => (
                  <p key={index} className="text-red-700">{error}</p>
                ))}
                {importResult.errors.length > 10 && (
                  <p className="text-gray-600 mt-2">... and {importResult.errors.length - 10} more errors</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
