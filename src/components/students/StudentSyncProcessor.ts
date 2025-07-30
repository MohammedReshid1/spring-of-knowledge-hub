import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import type { SyncOperation, SyncResult, StudentData, ClassData } from './types';

export class StudentSyncProcessor {
  private operations: SyncOperation[] = [];

  async processSyncFiles(
    files: File[],
    dryRun: boolean = true,
    onProgress?: (progress: number, operation?: SyncOperation) => void
  ): Promise<SyncResult> {
    this.operations = [];
    const result: SyncResult = {
      totalFiles: files.length,
      filesProcessed: 0,
      studentsToCreate: 0,
      studentsToReassign: 0,
      studentsCreated: 0,
      studentsReassigned: 0,
      studentsUnchanged: 0,
      classesCreated: 0,
      errors: [],
      operations: []
    };

    try {
      // Parse all files first
      const classDataList: ClassData[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const classData = await this.parseExcelFile(file);
          classDataList.push(classData);
          result.filesProcessed++;
          onProgress?.((i + 1) / files.length * 50); // First 50% for parsing
        } catch (error) {
          result.errors.push(`Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Get existing data from database
      const { data: existingClasses } = await supabase
        .from('classes')
        .select('*');

      const { data: existingStudents } = await supabase
        .from('students')
        .select('id, student_id, first_name, last_name, grade_level, class_id')
        .in('grade_level', [
          'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6',
          'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'
        ]);

      // Process each class
      for (let i = 0; i < classDataList.length; i++) {
        const classData = classDataList[i];
        await this.processClass(classData, existingClasses || [], existingStudents || [], result, dryRun);
        onProgress?.(50 + ((i + 1) / classDataList.length * 50)); // Second 50% for processing
      }

      result.operations = this.operations;
      return result;

    } catch (error) {
      result.errors.push(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private async parseExcelFile(file: File): Promise<ClassData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          // Extract class name from header or filename
          let className = '';
          let gradeLevel = '';

          // Try to find class name in the first few rows
          for (let i = 0; i < Math.min(5, jsonData.length); i++) {
            const row = jsonData[i];
            for (const cell of row) {
              if (typeof cell === 'string' && cell.includes('GRADE')) {
                const match = cell.match(/GRADE\s+(\d+)\s*-\s*([A-Z])/i);
                if (match) {
                  className = `GRADE ${match[1]} - ${match[2].toUpperCase()}`;
                  gradeLevel = `grade_${match[1]}`;
                  break;
                }
              }
            }
            if (className) break;
          }

          // Fallback to filename parsing
          if (!className) {
            const match = file.name.match(/GRADE\s+(\d+)\s*-\s*([A-Z])/i);
            if (match) {
              className = `GRADE ${match[1]} - ${match[2].toUpperCase()}`;
              gradeLevel = `grade_${match[1]}`;
            } else {
              reject(new Error(`Could not extract class name from file: ${file.name}`));
              return;
            }
          }

          // Extract student names (skip header rows)
          const students: StudentData[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row[0] && typeof row[0] === 'string') {
              const fullName = row[0].trim();
              if (fullName && !fullName.toLowerCase().includes('grade') && !fullName.toLowerCase().includes('class')) {
                const nameParts = fullName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                
                students.push({
                  firstName,
                  lastName,
                  fullName,
                  className,
                  gradeLevel
                });
              }
            }
          }

          resolve({
            className,
            gradeLevel,
            students
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private async processClass(
    classData: ClassData,
    existingClasses: any[],
    existingStudents: any[],
    result: SyncResult,
    dryRun: boolean
  ) {
    // Find or create class
    let targetClass = existingClasses.find(c => c.class_name === classData.className);
    
    if (!targetClass && !dryRun) {
      const { data: newClass, error } = await supabase
        .from('classes')
        .insert({
          class_name: classData.className,
          academic_year: new Date().getFullYear().toString(),
          max_capacity: 40
        })
        .select()
        .single();

      if (error) {
        result.errors.push(`Failed to create class ${classData.className}: ${error.message}`);
        return;
      }
      targetClass = newClass;
      result.classesCreated++;
    } else if (!targetClass && dryRun) {
      result.classesCreated++;
      targetClass = { id: 'preview', class_name: classData.className };
    }

    // Process each student in the class
    for (const studentData of classData.students) {
      await this.processStudent(studentData, targetClass, existingStudents, result, dryRun);
    }
  }

  private async processStudent(
    studentData: StudentData,
    targetClass: any,
    existingStudents: any[],
    result: SyncResult,
    dryRun: boolean
  ) {
    // Find existing student by name (case-insensitive)
    const existingStudent = existingStudents.find(s => 
      s.first_name?.toLowerCase().trim() === studentData.firstName.toLowerCase().trim() &&
      s.last_name?.toLowerCase().trim() === studentData.lastName.toLowerCase().trim()
    );

    const operation: SyncOperation = {
      type: 'no_change',
      studentName: studentData.fullName,
      className: studentData.className,
      timestamp: new Date()
    };

    if (!existingStudent) {
      // Create new student
      operation.type = 'create';
      
      if (!dryRun) {
        const { error } = await supabase
          .from('students')
          .insert({
            first_name: studentData.firstName,
            last_name: studentData.lastName,
            grade_level: studentData.gradeLevel as any,
            class_id: targetClass.id,
            date_of_birth: '2010-01-01', // Default DOB, should be updated later
            student_id: '', // Will be auto-generated by trigger
            status: 'Active'
          } as any);

        if (error) {
          result.errors.push(`Failed to create student ${studentData.fullName}: ${error.message}`);
          return;
        }
        result.studentsCreated++;
      } else {
        result.studentsToCreate++;
      }
    } else if (existingStudent.class_id !== targetClass.id) {
      // Reassign student to correct class
      operation.type = 'reassign';
      const currentClass = existingStudents.find(s => s.class_id === existingStudent.class_id);
      operation.fromClass = currentClass?.class_name || 'Unknown';

      if (!dryRun) {
        const { error } = await supabase
          .from('students')
          .update({
            class_id: targetClass.id,
            grade_level: studentData.gradeLevel as any
          })
          .eq('id', existingStudent.id);

        if (error) {
          result.errors.push(`Failed to reassign student ${studentData.fullName}: ${error.message}`);
          return;
        }
        result.studentsReassigned++;
      } else {
        result.studentsToReassign++;
      }
    } else {
      // Student already in correct class
      result.studentsUnchanged++;
    }

    this.operations.push(operation);
  }
}