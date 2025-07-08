import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { Database } from '@/integrations/supabase/types';

type GradeLevel = Database['public']['Enums']['grade_level'];

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ClassInfo {
  name: string;
  gradeLevel: string;
  students: any[];
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

  const normalizeGradeLevel = (gradeInput: string): GradeLevel => {
    const normalized = gradeInput.toLowerCase().trim();
    
    // Handle various grade formats including new KG and PREP
    const gradeMap: Record<string, GradeLevel> = {
      'pre kg': 'pre_k',
      'pre-kg': 'pre_k',
      'pre k': 'pre_k',
      'prekg': 'pre_k',
      'nursery': 'pre_k',
      'kg': 'kg',
      'kindergarten': 'kg',
      'k': 'kg',
      'prep': 'prep',
      'preparatory': 'prep',
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
      'class 9': 'grade_9',
      'grade 9': 'grade_9',
      '9th': 'grade_9',
      '9': 'grade_9',
      'class 10': 'grade_10',
      'grade 10': 'grade_10',
      '10th': 'grade_10',
      '10': 'grade_10',
      'class 11': 'grade_11',
      'grade 11': 'grade_11',
      '11th': 'grade_11',
      '11': 'grade_11',
      'class 12': 'grade_12',
      'grade 12': 'grade_12',
      '12th': 'grade_12',
      '12': 'grade_12',
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

  const detectGenderFromName = (firstName: string): string => {
    const name = firstName.toLowerCase().trim();
    
    // Common female names that appear in the data
    const femaleNames = [
      'aisha', 'ameera', 'arwa', 'asma', 'fatima', 'hanan', 'hiba', 'jana', 'layla', 'maryam',
      'nour', 'rania', 'sara', 'sarah', 'yasmin', 'zahra', 'zara', 'amina', 'dina', 'lina',
      'maya', 'nada', 'reem', 'salma', 'tala', 'yara', 'zeina', 'alia', 'aya', 'dana',
      'farah', 'ghada', 'iman', 'laith', 'nora', 'rama', 'salam', 'wafa', 'yusra', 'zaina',
      'rena', 'rinad', 'rezan', 'rumeysa', 'yemariam', 'anisa'
    ];

    const maleNames = [
      'ahmed', 'mohammed', 'omar', 'ali', 'hassan', 'ibrahim', 'khalid', 'saad', 'tariq', 'yusuf',
      'abdel', 'abdul', 'adnan', 'amjad', 'bashar', 'fadi', 'hadi', 'jamal', 'karim', 'majid',
      'nasser', 'qasim', 'rami', 'sami', 'walid', 'zaid', 'abdurahman', 'abubeker', 'amar',
      'siyam', 'yasir', 'asad', 'aymen', 'benyas'
    ];

    // Check if name starts with or contains female name patterns
    for (const femaleName of femaleNames) {
      if (name.includes(femaleName)) {
        return 'Female';
      }
    }

    // Check if name starts with or contains male name patterns
    for (const maleName of maleNames) {
      if (name.includes(maleName)) {
        return 'Male';
      }
    }

    // Default based on common patterns
    if (name.endsWith('a') || name.endsWith('ah') || name.endsWith('ia')) {
      return 'Female';
    }

    return 'Male'; // Default fallback
  };

  const normalizeGender = (genderInput: string, firstName: string = ''): string => {
    if (!genderInput || genderInput.trim() === '') {
      // Try to detect from name if gender is not provided
      return detectGenderFromName(firstName);
    }

    const normalized = genderInput.toLowerCase().trim();
    if (['m', 'male', 'boy', '1'].includes(normalized)) return 'Male';
    if (['f', 'female', 'girl', '2'].includes(normalized)) return 'Female';
    
    // Try to detect from name if gender input is unclear
    return detectGenderFromName(firstName);
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

  const extractClassFromHeader = (headerText: string): { className: string; gradeLevel: GradeLevel } | null => {
    if (!headerText || typeof headerText !== 'string') return null;
    
    const text = headerText.toString().trim();
    console.log(`Checking header text: "${text}"`);
    
    // Enhanced patterns to handle Excel format like "Grade : _PRE KG - A_______________"
    const classPatterns = [
      // Handle Excel format with underscores and extra text
      /Grade\s*:\s*_*(PRE\s*KG)\s*-\s*([A-E])_*.*$/i,
      /Grade\s*:\s*_*(KG)\s*-\s*([A-E])_*.*$/i,
      /Grade\s*:\s*_*(PREP)\s*-\s*([A-E])_*.*$/i,
      /Grade\s*:\s*_*(GRADE|CLASS)\s*(\d+)\s*-\s*([A-E])_*.*$/i,
      
      // More flexible KG patterns with optional spaces and separators
      /^(KG)\s*[-\s]*([A-E])\s*$/i,
      /^(KG)\s+([A-E])\s*$/i,
      /.*KG\s*[-\s]*([A-E]).*/i, // Very flexible KG pattern
      
      // Original patterns for direct class names
      /^(PRE\s*KG)[\s\-]*([A-E])$/i,
      /^(PREKG)[\s\-]*([A-E])$/i,
      /^(PRE\s*K)[\s\-]*([A-E])$/i,
      /^(KG)[\s\-]*([A-E])$/i,
      /^(KINDERGARTEN)[\s\-]*([A-E])$/i,
      /^(PREP)[\s\-]*([A-E])$/i,
      /^(PREPARATORY)[\s\-]*([A-E])$/i,
      /^(GRADE|CLASS)[\s\-]*(\d{1,2})[\s\-]*([A-E])$/i,
      
      // Additional patterns for common variations
      /.*\b(KG)\s+([A-E])\b.*/i,
      /.*\b(PRE\s*KG)\s+([A-E])\b.*/i,
      /.*\b(PREP)\s+([A-E])\b.*/i,
    ];

    for (const pattern of classPatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log(`Pattern matched:`, match);
        
        let gradeLevel: GradeLevel = 'pre_k';
        let section = '';
        let gradePart = '';
        
        // Handle the flexible KG pattern that only captures the section
        if (pattern.toString().includes('.*KG\\s*[-\\s]*([A-E]).*')) {
          gradePart = 'KG';
          section = match[1];
        } else {
          // Normal pattern handling
          section = match[match.length - 1]; // Last capture group is the section
          gradePart = match[1];
        }
        
        // Handle grade number patterns (for GRADE 1 - A format)
        if (match.length > 3 && match[2] && /^\d{1,2}$/.test(match[2])) {
          const gradeNum = match[2];
          gradeLevel = `grade_${gradeNum}` as GradeLevel;
          section = match[3];
        } else {
          // Handle text-based grades
          const gradeText = gradePart.toLowerCase();
          if (gradeText.includes('pre')) {
            gradeLevel = 'pre_k';
          } else if (gradeText.includes('kg') || gradeText.includes('kindergarten')) {
            gradeLevel = 'kg';
          } else if (gradeText.includes('prep')) {
            gradeLevel = 'prep';
          }
        }
        
        // Create clean class name
        const className = `${gradePart.toUpperCase().replace(/\s+/g, ' ')} - ${section.toUpperCase()}`;
        
        console.log(`Extracted class: ${className}, grade: ${gradeLevel}`);
        
        return {
          className,
          gradeLevel
        };
      }
    }

    return null;
  };

  const createOrFindClass = async (className: string, gradeLevel: GradeLevel): Promise<string | null> => {
    try {
      // First, get the grade level ID
      const { data: gradeLevelData } = await supabase
        .from('grade_levels')
        .select('id')
        .eq('grade', gradeLevel)
        .single();

      if (!gradeLevelData) {
        console.error(`Grade level ${gradeLevel} not found`);
        return null;
      }

      // Try to find existing class
      const { data: existingClass } = await supabase
        .from('classes')
        .select('id')
        .eq('class_name', className)
        .single();

      if (existingClass) {
        return existingClass.id;
      }

      // Create new class
      const { data: newClass, error } = await supabase
        .from('classes')
        .insert({
          class_name: className,
          grade_level_id: gradeLevelData.id,
          max_capacity: 50, // Default capacity, will be adjusted based on actual students
          current_enrollment: 0,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating class:', error);
        return null;
      }

      return newClass.id;
    } catch (error) {
      console.error('Error in createOrFindClass:', error);
      return null;
    }
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

    // First pass: Identify classes from headers and group students
    const classes: Map<string, ClassInfo> = new Map();
    let currentClass: ClassInfo | null = null;

    updateProgress(10, 100, 'Analyzing Excel structure and identifying classes...');

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Check all values in the row for class headers
      const allValues = Object.values(row);
      let classFound = false;
      
      for (const value of allValues) {
        if (value && typeof value === 'string') {
          const classInfo = extractClassFromHeader(value.toString());
          if (classInfo) {
            console.log(`Found class header: ${classInfo.className} (${classInfo.gradeLevel})`);
            currentClass = {
              name: classInfo.className,
              gradeLevel: classInfo.gradeLevel,
              students: []
            };
            classes.set(classInfo.className, currentClass);
            classFound = true;
            break;
          }
        }
      }
      
      if (classFound) continue;

      // Look for student data - check for student name in the row
      const studentName = row['__EMPTY'] || row['Student\'s Name'] || Object.values(row).find(val => 
        val && typeof val === 'string' && 
        val.trim().length > 5 && 
        /^[a-zA-Z\s]+$/.test(val.trim()) && 
        val.split(' ').length >= 2 &&
        !val.toLowerCase().includes('grade') &&
        !val.toLowerCase().includes('character') &&
        !val.toLowerCase().includes('homeroom') &&
        !val.toLowerCase().includes('teacher') &&
        !val.toLowerCase().includes('semester') &&
        !val.toLowerCase().includes('absent') &&
        !val.toLowerCase().includes('present') &&
        !val.toLowerCase().includes('when students')
      );

      if (currentClass && studentName && typeof studentName === 'string') {
        const cleanName = studentName.toString().trim();
        if (cleanName.length > 2) {
          console.log(`Adding student ${cleanName} to class ${currentClass.name}`);
          currentClass.students.push({
            name: cleanName,
            gender: row['__EMPTY_1'] || row['Gen.'] || 'M', // Default gender from Excel or fallback
            ...row
          });
        }
      }
    }

    console.log('Classes found:', Array.from(classes.keys()));
    console.log('Class details:', Array.from(classes.entries()).map(([name, info]) => ({
      name,
      gradeLevel: info.gradeLevel,
      studentCount: info.students.length
    })));

    if (classes.size === 0) {
      throw new Error('No class headers found in the Excel file. Please ensure your Excel file has class headers like "Grade : _PRE KG - A___" or "PRE KG - A"');
    }

    updateProgress(25, 100, 'Creating classes in database...');

    // Create classes in database and get their IDs
    const classIdMap: Map<string, string> = new Map();
    for (const [className, classInfo] of classes) {
      const classId = await createOrFindClass(className, classInfo.gradeLevel as GradeLevel);
      if (classId) {
        classIdMap.set(className, classId);
        
        // Update class capacity based on student count
        await supabase
          .from('classes')
          .update({ 
            max_capacity: Math.max(classInfo.students.length, 25),
            current_enrollment: 0 // Will be updated by triggers
          })
          .eq('id', classId);
      }
    }

    updateProgress(40, 100, 'Processing student data...');

    // Second pass: Insert students
    let totalStudents = 0;
    for (const classInfo of classes.values()) {
      totalStudents += classInfo.students.length;
    }

    let processedStudents = 0;

    for (const [className, classInfo] of classes) {
      const classId = classIdMap.get(className);
      
      for (const studentRow of classInfo.students) {
        try {
          processedStudents++;
          updateProgress(40 + (processedStudents / totalStudents) * 50, 100, 
            `Processing student ${processedStudents} of ${totalStudents} in ${className}`);

          // Extract student name (first non-empty value)
          let studentName = '';
          for (const value of Object.values(studentRow)) {
            if (value && typeof value === 'string' && value.trim().length > 2) {
              studentName = value.toString().trim();
              break;
            }
          }

          if (!studentName) {
            results.errors.push(`Row ${processedStudents}: No valid name found in ${className}`);
            results.failed++;
            continue;
          }

          const parsedName = parseName(studentName);
          const gender = normalizeGender('', parsedName.first_name);

          // Default date of birth based on grade level
          let defaultAge = 6; // Default age
          switch (classInfo.gradeLevel) {
            case 'pre_k': defaultAge = 4; break;
            case 'kg': defaultAge = 5; break;
            case 'prep': defaultAge = 6; break;
            case 'grade_1': defaultAge = 7; break;
            case 'grade_2': defaultAge = 8; break;
            case 'grade_3': defaultAge = 9; break;
            case 'grade_4': defaultAge = 10; break;
            case 'grade_5': defaultAge = 11; break;
            case 'grade_6': defaultAge = 12; break;
            case 'grade_7': defaultAge = 13; break;
            case 'grade_8': defaultAge = 14; break;
            case 'grade_9': defaultAge = 15; break;
            case 'grade_10': defaultAge = 16; break;
            case 'grade_11': defaultAge = 17; break;
            case 'grade_12': defaultAge = 18; break;
            default: defaultAge = 6;
          }

          const defaultDate = new Date();
          defaultDate.setFullYear(defaultDate.getFullYear() - defaultAge);

          const studentData = {
            student_id: '', // Will be auto-generated
            first_name: parsedName.first_name,
            last_name: parsedName.last_name,
            father_name: parsedName.father_name,
            grandfather_name: parsedName.grandfather_name,
            mother_name: null,
            date_of_birth: defaultDate.toISOString().split('T')[0],
            grade_level: classInfo.gradeLevel as GradeLevel,
            gender: gender,
            address: null,
            phone: null,
            email: null,
            status: 'Active' as const,
            admission_date: new Date().toISOString().split('T')[0],
            class_id: classId
          };

          console.log(`Inserting student ${processedStudents}:`, studentData);

          const { error } = await supabase
            .from('students')
            .insert(studentData);

          if (error) {
            console.error(`Error inserting student ${processedStudents}:`, error);
            results.errors.push(`${studentName} in ${className}: ${error.message}`);
            results.failed++;
          } else {
            console.log(`Successfully inserted student ${processedStudents}: ${studentName} in ${className}`);
            results.success++;
          }

          // Small delay to prevent overwhelming the database
          if (processedStudents % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          console.error(`Unexpected error processing student ${processedStudents}:`, error);
          results.errors.push(`Student ${processedStudents} in ${className}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.failed++;
        }
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
        description: `Successfully imported ${results.success} students into ${classes.size} classes${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
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

  const downloadExcelTemplate = () => {
    // Create sample data with class headers including all variations
    const templateData = [
      { 'A': 'PRE KG - A' },
      { 'A': 'Ahmed Mohammed Ali' },
      { 'A': 'Aisha Hassan Ibrahim' },
      { 'A': '' },
      { 'A': 'KG - B' },
      { 'A': 'Omar Yusuf Mohammed' },
      { 'A': 'Fatima Ahmed Said' },
      { 'A': '' },
      { 'A': 'PREP - A' },
      { 'A': 'Sara Ahmed Mohammed' },
      { 'A': 'Hassan Ali Ibrahim' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student-import-template.xlsx');
  };

  const downloadCsvTemplate = () => {
    const csvContent = `PRE KG - A
Ahmed Mohammed Ali
Aisha Hassan Ibrahim

KG - B  
Omar Yusuf Mohammed
Fatima Ahmed Said

PREP - A
Sara Ahmed Mohammed
Hassan Ali Ibrahim`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Student Import with Class Detection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">How it works:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Put class names like "PRE KG - A", "KG - B", "PREP - A" in separate rows</li>
            <li>• List student names in rows below each class header</li>
            <li>• The system will automatically create classes and assign students</li>
            <li>• Supports PRE KG, KG, PREP, and Grade 1-12 with sections A-E</li>
            <li>• Class capacity will be adjusted based on actual student count</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={downloadExcelTemplate} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download Excel Template
          </Button>
          
          <Button onClick={downloadCsvTemplate} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
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
