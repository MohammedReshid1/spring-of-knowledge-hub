import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import * as XLSX from 'xlsx';
import { useBranch } from '@/contexts/BranchContext';
// Removed GradeLevel imported interface; using simple string alias for grade levels
type GradeLevel = string;


interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ClassInfo {
  name: string;
  gradeLevel: GradeLevel;
  students: any[];
}

export const BulkStudentImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

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

    const normalized = genderInput.toString().toLowerCase().trim();
    
    // Handle common gender formats including M/F
    if (['m', 'male', 'boy', '1', 'm.'].includes(normalized)) return 'Male';
    if (['f', 'female', 'girl', '2', 'f.'].includes(normalized)) return 'Female';
    
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

  const extractClassFromFilename = (filename: string): { className: string; gradeLevel: GradeLevel } | null => {
    if (!filename) return null;
    
    // Remove file extension and normalize
    const name = filename.replace(/\.(xlsx|xls|csv)$/i, '').trim();
    console.log(`Extracting class from filename: "${name}"`);
    
    // Handle patterns like "5AA", "5BB", etc. for Grade 5
    const gradePatterns = [
      /^(\d{1,2})([A-Z]{2})$/i,  // 5AA, 5BB, etc.
      /^(\d{1,2})([A-Z])$/i,     // 5A, 5B, etc.
      /^Grade\s*(\d{1,2})\s*([A-Z])$/i, // Grade 5 A
      /^(\d{1,2})([A-Z])\s*$/i,  // 5A with space
    ];
    
    for (const pattern of gradePatterns) {
      const match = name.match(pattern);
      if (match) {
        const gradeNum = match[1];
        let section = match[2];
        
        // Handle double letter sections (AA = A, BB = B, etc.)
        if (section.length === 2 && section[0] === section[1]) {
          section = section[0];
        }
        
        const gradeLevel = `grade_${gradeNum}` as GradeLevel;
        const className = `GRADE ${gradeNum} - ${section.toUpperCase()}`;
        
        console.log(`Filename pattern matched: Grade ${gradeNum}, Section ${section} -> ${className}`);
        return { className, gradeLevel };
      }
    }
    
    return null;
  };

  const extractClassFromHeader = (headerText: string): { className: string; gradeLevel: GradeLevel } | null => {
    if (!headerText || typeof headerText !== 'string') return null;
    
    const text = headerText.toString().trim();
    console.log(`Checking header text: "${text}"`);
    
      // Enhanced patterns to handle Excel format like "Grade : _PRE KG - A_______________"
      const classPatterns = [
        // Handle Excel format with underscores and extra text (A-Z support)
        /Grade\s*:\s*_*(PRE\s*KG)\s*-\s*([A-Z])_*.*$/i,
        /Grade\s*:\s*_*(KG)\s*-\s*([A-Z])_*.*$/i,
        /Grade\s*:\s*_*(PREP)\s*-\s*([A-Z])_*.*$/i,
        /Grade\s*:\s*_*(GRADE|CLASS)\s*(\d+)\s*-\s*([A-Z])_*.*$/i,
        
        // More flexible KG patterns with optional spaces and separators (A-Z support)
        /^(KG)\s*[-\s]*([A-Z])\s*$/i,
        /^(KG)\s+([A-Z])\s*$/i,
        /.*KG\s*[-\s]*([A-Z]).*/i, // Very flexible KG pattern
        
        // Original patterns for direct class names (A-Z support)
        /^(PRE\s*KG)[\s\-]*([A-Z])$/i,
        /^(PREKG)[\s\-]*([A-Z])$/i,
        /^(PRE\s*K)[\s\-]*([A-Z])$/i,
        /^(KG)[\s\-]*([A-Z])$/i,
        /^(KINDERGARTEN)[\s\-]*([A-Z])$/i,
        /^(PREP)[\s\-]*([A-Z])$/i,
        /^(PREPARATORY)[\s\-]*([A-Z])$/i,
        /^(GRADE|CLASS)[\s\-]*(\d{1,2})[\s\-]*([A-Z])$/i,
        
        // Additional patterns for common variations (A-Z support)
        /.*\b(KG)\s+([A-Z])\b.*/i,
        /.*\b(PRE\s*KG)\s+([A-Z])\b.*/i,
        /.*\b(PREP)\s+([A-Z])\b.*/i,
      ];

    for (const pattern of classPatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log(`Pattern matched:`, match);
        
        let gradeLevel: GradeLevel = 'pre_k';
        let section = '';
        let gradePart = '';
        
        // Handle the flexible KG pattern that only captures the section
        if (pattern.toString().includes('.*KG\\s*[-\\s]*([A-Z]).*')) {
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
          // Create proper class name with grade number
          const className = `GRADE ${gradeNum} - ${section.toUpperCase()}`;
          return { className, gradeLevel };
        } else {
          // Handle text-based grades
          const gradeText = gradePart.toLowerCase();
          if (gradeText.includes('pre')) {
            gradeLevel = 'pre_k';
            // Create proper class name for pre-k
            const className = `PRE-KG - ${section.toUpperCase()}`;
            return { className, gradeLevel };
          } else if (gradeText.includes('kg') || gradeText.includes('kindergarten')) {
            gradeLevel = 'kg';
            // Create proper class name for kg
            const className = `KG - ${section.toUpperCase()}`;
            return { className, gradeLevel };
          } else if (gradeText.includes('prep')) {
            gradeLevel = 'prep';
            // Create proper class name for prep
            const className = `PREP - ${section.toUpperCase()}`;
            return { className, gradeLevel };
          }
        }
        
        // Fallback for other text-based grades
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
    console.log('createOrFindClass called for', className, gradeLevel);
    try {
      // First, get the grade level object via API
      console.log('Fetching grade levels...');
      const gradeLevelsResp = await apiClient.getGradeLevels();
      console.log('gradeLevelsResp', gradeLevelsResp);
      if (gradeLevelsResp.error) {
        console.error('Error fetching grade levels:', gradeLevelsResp.error);
        return null;
      }
      // Find the grade level object via API (allow fuzzy fallback)
      let gradeLevelObj = gradeLevelsResp.data?.find(gl => gl.grade === gradeLevel);
      console.log('Found grade level object:', gradeLevelObj);
      // Fallback: search by numeric grade if exact match not found
      if (!gradeLevelObj && gradeLevel.startsWith('grade_')) {
        const num = gradeLevel.split('_')[1];
        const fuzzyMatch = gradeLevelsResp.data?.find(gl => gl.grade.includes(num));
        if (fuzzyMatch) {
          console.warn(`Using fuzzy match for grade level: ${fuzzyMatch.grade}`);
          gradeLevelObj = fuzzyMatch;
        }
      }
      if (!gradeLevelObj) {
        console.error(`Grade level ${gradeLevel} not found`);
        return null;
      }

      // Try to find existing class via API
      console.log('Fetching existing classes...');
      const classesResp = await apiClient.getClasses();
      console.log('classesResp', classesResp);
      if (classesResp.error) {
        console.error('Error fetching classes:', classesResp.error);
        return null;
      }
      const existingClass = classesResp.data?.find(c => c.class_name === className);
      if (existingClass) {
        console.log('Existing class found:', existingClass);
        return existingClass.id;
      }

      // Create new class via API
      const classData = {
        class_name: className,
        grade_level_id: gradeLevelObj.id,
        max_capacity: 50,
        current_enrollment: 0,
        academic_year: new Date().getFullYear().toString(),
        branch_id: selectedBranch || undefined,
      };
      console.log('Creating class with data:', classData);
      const newClassResp = await apiClient.createClass(classData);
      console.log('newClassResp', newClassResp);
      if (newClassResp.error) {
        console.error('Error creating class:', newClassResp.error);
        return null;
      }
      console.log('Class created with ID:', newClassResp.data.id);
      return newClassResp.data.id;
    } catch (error) {
      console.error('Error in createOrFindClass:', error);
      return null;
    }
  };

  
  // Generate unique student ID: SCH-YYYY-XXXXX
  const generateStudentId = async (): Promise<string> => {
    const resp = await apiClient.getStudents();
    // Handle new pagination structure: { items: [...], total: number, ... }
    const students: any[] = resp.data?.items || [];
    const year = new Date().getFullYear().toString();
    const regex = new RegExp(`^SCH-${year}-(\\d{5})$`);
    let max = 0;
    
    // Find the highest existing number for this year
    students.forEach(s => {
      const m = s.student_id.match(regex);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (num > max) max = num;
      }
    });
    
    // Generate the next sequential number
    const next = (max + 1).toString().padStart(5, '0');
    return `SCH-${year}-${next}`;
  };
  
  const processExcelData = async (jsonData: any[], filename: string = '') => {
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
    console.log('Processing file:', filename);

    // First pass: Identify classes from headers and group students
    const classes: Map<string, ClassInfo> = new Map();
    let currentClass: ClassInfo | null = null;

    updateProgress(10, 100, 'Analyzing Excel structure and identifying classes...');

    // Try to extract class info from filename first
    const filenameClassInfo = extractClassFromFilename(filename);
    if (filenameClassInfo) {
      console.log(`Found class from filename: ${filenameClassInfo.className} (${filenameClassInfo.gradeLevel})`);
      currentClass = {
        name: filenameClassInfo.className,
        gradeLevel: filenameClassInfo.gradeLevel,
        students: []
      };
      classes.set(filenameClassInfo.className, currentClass);
    }

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Always check for class headers to handle multiple classes in one file.
      const allValues = Object.values(row);
      let classFound = false;
      for (const value of allValues) {
        if (value && typeof value === 'string') {
          const classInfo = extractClassFromHeader(value.toString());
          if (classInfo) {
            console.log(`Found class header: ${classInfo.className} (${classInfo.gradeLevel})`);
            // Check if this is a new class, different from the current one
            if (!classes.has(classInfo.className)) {
              currentClass = {
                name: classInfo.className,
                gradeLevel: classInfo.gradeLevel,
                students: []
              };
              classes.set(classInfo.className, currentClass);
            } else {
              currentClass = classes.get(classInfo.className)!;
            }
            classFound = true;
            break;
          }
        }
      }
      
      if (classFound) continue; // Skip to the next row after finding a class header

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
        !val.toLowerCase().includes('when students') &&
        !val.toLowerCase().includes('student') &&
        !val.toLowerCase().includes('name') &&
        !val.toLowerCase().includes('sex') &&
        !val.toLowerCase().includes('gender')
      );

      if (currentClass && studentName && typeof studentName === 'string') {
        const cleanName = studentName.toString().trim();
        
        // Skip header-like rows
        const isHeaderRow = cleanName.toLowerCase().includes('student') || 
                           cleanName.toLowerCase().includes('name') ||
                           cleanName.toLowerCase().includes('sex') ||
                           cleanName.toLowerCase().includes('gender') ||
                           cleanName.toLowerCase().includes('class') ||
                           cleanName.toLowerCase().includes('grade') ||
                           cleanName.toLowerCase().includes('section');
        
        if (cleanName.length > 2 && !isHeaderRow && cleanName.trim() !== '') {
          console.log(`Adding student ${cleanName} to class ${currentClass.name}`);
          // Extract gender from various possible column names
          const genderValue = row['__EMPTY_1'] || row['Gen.'] || row['SEX'] || row['Sex'] || row['Gender'] || row['GENDER'] || 'M';
          
          currentClass.students.push({
            name: cleanName,
            gender: genderValue,
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
      throw new Error(`No class headers found in the Excel file "${filename}". 
      
      For filename-based detection, use patterns like:
      • 5AA.xlsx for "GRADE 5 - A"
      • 5BB.xlsx for "GRADE 5 - B"
      
      Or ensure your Excel file has class headers like:
      • "Grade : _PRE KG - A___" 
      • "PRE KG - A"
      • "GRADE 5 - A"`);
    }

    updateProgress(25, 100, 'Creating classes in database...');

    // Create classes in database and get their IDs
    const classIdMap: Map<string, string> = new Map();
    for (const [className, classInfo] of classes) {
      const classId = await createOrFindClass(className, classInfo.gradeLevel as GradeLevel);
      if (classId) {
        classIdMap.set(className, classId);
        // Update class capacity based on student count via API
        try {
          // Fetch grade levels to get id
          const gradesResp = await apiClient.getGradeLevels();
          const gradeLevelObj = gradesResp.data?.find(gl => gl.grade === classInfo.gradeLevel) || gradesResp.data?.find(gl => gl.grade.includes(classInfo.gradeLevel.split('_')[1]));
          const updateData = {
            class_name: className,
            grade_level_id: gradeLevelObj?.id,
            academic_year: new Date().getFullYear().toString(),
            branch_id: selectedBranch || undefined,
            max_capacity: Math.max(classInfo.students.length, 25),
            current_enrollment: 0
          };
          await apiClient.updateClass(classId, updateData);
         } catch (err) {
           console.error('Error updating class capacity for', className, err);
         }
      }
    }

    // Update grade level capacities by summing all classes per grade
    updateProgress(30, 100, 'Updating grade level capacities...');
    try {
      // Fetch all classes and grade levels
      const allClassesResp = await apiClient.getClasses();
      const allClasses = allClassesResp.data || [];
      const gradeLevelsResp2 = await apiClient.getGradeLevels();
      const existingGradeLevels = gradeLevelsResp2.data || [];
      // For each grade level, sum class capacities and enrollments
      for (const gl of existingGradeLevels) {
        const classesForGrade = allClasses.filter(c => c.grade_level_id === gl.id);
        const totalCapacity = classesForGrade.reduce((sum, c) => sum + (c.max_capacity || 0), 0);
        const totalEnrollment = classesForGrade.reduce((sum, c) => sum + (c.current_enrollment || 0), 0);
        const updateData = {
          grade: gl.grade,
          academic_year: new Date().getFullYear().toString(),
          max_capacity: totalCapacity,
          current_enrollment: totalEnrollment
        };
        await apiClient.updateGradeLevel(gl.id, updateData);
      }
    } catch (err) {
      console.error('Error updating grade level capacities', err);
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
          // Use the gender from Excel data, fallback to name detection
          const gender = normalizeGender(studentRow.gender || '', parsedName.first_name);

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
            student_id: await generateStudentId(),
            first_name: parsedName.first_name,
            last_name: parsedName.last_name,
            father_name: parsedName.father_name,
            grandfather_name: parsedName.grandfather_name,
            mother_name: null,
            date_of_birth: defaultDate.toISOString().split('T')[0],
            grade_level: classInfo.gradeLevel,
            gender: gender,
            address: null,
            phone: null,
            email: null,
            status: 'Active' as const,
            admission_date: new Date().toISOString().split('T')[0],
            class_id: classId,
            branch_id: selectedBranch || undefined,
          };

          console.log(`Inserting student ${processedStudents}:`, studentData);

          const studentResp = await apiClient.createStudent(studentData);
          if (studentResp.error) {
            console.error(`Error inserting student ${processedStudents}:`, studentResp.error);
            results.errors.push(`${studentName} in ${className}: ${studentResp.error}`);
            results.failed++;
          } else {
            console.log(`Successfully inserted student ${processedStudents}: ${studentName} in ${className}`);
            // Create initial registration fee payment (mark as paid)
            try {
              await apiClient.createRegistrationPayment({
                student_id: studentData.student_id,
                branch_id: selectedBranch || undefined,
                academic_year: new Date().getFullYear().toString(),
                payment_status: 'Paid',
                amount_paid: 0,
                payment_date: new Date().toISOString().split('T')[0],
              });
            } catch (err) {
              console.error(`Error creating registration payment for ${studentData.student_id}:`, err);
            }
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
      // Refresh data for students and dashboard
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Refresh grade levels to reflect updated capacities
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
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
        await processExcelData(jsonData, file.name);
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
    <Card className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100/50">
        <CardTitle className="flex items-center gap-3 text-xl font-bold">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileSpreadsheet className="h-6 w-6 text-purple-600" />
          </div>
          <span className="bg-gradient-to-r from-purple-800 to-purple-600 bg-clip-text text-transparent">
            Bulk Student Import with Class Detection
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            </div>
            <h4 className="font-bold text-blue-900 text-lg">How it works:</h4>
          </div>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span><strong>Filename Method:</strong> Name your files like "5AA.xlsx" for "GRADE 5 - A", "5BB.xlsx" for "GRADE 5 - B"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span><strong>Header Method:</strong> Put class names like "PRE KG - A", "KG - B", "PREP - A" in separate rows</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>List student names in rows below each class header (or entire file for filename method)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>The system will automatically create classes and assign students</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Supports PRE KG, KG, PREP, and Grade 1-12 with sections A-Z</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Class capacity will be adjusted based on actual student count</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={downloadExcelTemplate}
            variant="outline"
            className="bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-emerald-200 text-emerald-700 hover:text-emerald-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Excel Template
          </Button>

          <Button
            onClick={downloadCsvTemplate}
            variant="outline"
            className="bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border-amber-200 text-amber-700 hover:text-amber-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <label className="cursor-pointer flex-1">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isImporting}
            />
            <Button
              disabled={isImporting}
              asChild
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
            >
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? 'Importing Students...' : 'Select Excel File to Import'}
              </span>
            </Button>
          </label>
        </div>

        {isImporting && (
          <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Processing Import</h4>
                <p className="text-sm text-gray-600">{currentStatus}</p>
              </div>
              <span className="text-2xl font-bold text-purple-600">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full h-3 bg-purple-100" />
          </div>
        )}

        {importResult && (
          <div className="space-y-4">
            <Alert className={`border-0 shadow-xl rounded-xl overflow-hidden ${
              importResult.success > 0
                ? "bg-gradient-to-r from-emerald-50 to-emerald-100"
                : "bg-gradient-to-r from-red-50 to-red-100"
            }`}>
              <div className="flex items-center gap-4 p-2">
                <div className={`p-2 rounded-full ${
                  importResult.success > 0 ? "bg-emerald-500" : "bg-red-500"
                }`}>
                  {importResult.success > 0 ? (
                    <CheckCircle className="h-6 w-6 text-white" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-white" />
                  )}
                </div>
                <AlertDescription className="text-lg font-semibold">
                  <span className={importResult.success > 0 ? "text-emerald-800" : "text-red-800"}>
                    Import completed:
                  </span>
                  <span className="text-emerald-700 ml-2">{importResult.success} successful</span>
                  {importResult.failed > 0 && (
                    <span className="text-red-700 ml-2">, {importResult.failed} failed</span>
                  )}
                </AlertDescription>
              </div>
            </Alert>

            {importResult.errors.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm border border-red-200/50 shadow-xl rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 border-b border-red-100">
                  <h4 className="font-bold text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Import Errors ({importResult.errors.length})
                  </h4>
                </div>
                <div className="max-h-48 overflow-y-auto p-4 space-y-2">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                      <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {index + 1}
                      </span>
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 font-medium">... and {importResult.errors.length - 10} more errors</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
