import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface ImportResult {
  status: 'success' | 'error';
  totalRecords: number;
  successCount: number;
  errorCount: number;
  notFoundCount: number;
  duplicateCount: number;
  processingTimeMs: number;
  errors: ImportError[];
  operations: ImportOperation[];
  summary: {
    studentsUpdated: number;
    totalAmountProcessed: number;
    cyclesProcessed: string[];
  };
}

export interface ImportError {
  row: number;
  studentId?: string;
  studentName?: string;
  error: string;
  severity: 'error' | 'warning';
}

export interface ImportOperation {
  type: 'update' | 'skip' | 'error';
  studentId: string;
  studentName: string;
  paymentCycle: string;
  amount: number;
  previousStatus?: string;
  newStatus: string;
  message: string;
}

interface PaymentData {
  studentId?: string;
  studentName?: string;
  gradeLevel?: string;
  paymentCycle: string;
  amountPaid: number;
  academicYear?: string;
  paymentDate?: string;
  notes?: string;
}

interface ProcessingOptions {
  onProgress?: (progress: number, operation: string) => void;
}

export class PaymentImportProcessor {
  private readonly BATCH_SIZE = 50;
  private readonly SUPPORTED_CYCLES = [
    'registration_fee',
    '1st_quarter',
    '2nd_quarter', 
    '3rd_quarter',
    '4th_quarter',
    '1st_semester',
    '2nd_semester',
    'annual'
  ];

  async processFile(file: File, options?: ProcessingOptions): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      status: 'success',
      totalRecords: 0,
      successCount: 0,
      errorCount: 0,
      notFoundCount: 0,
      duplicateCount: 0,
      processingTimeMs: 0,
      errors: [],
      operations: [],
      summary: {
        studentsUpdated: 0,
        totalAmountProcessed: 0,
        cyclesProcessed: []
      }
    };

    try {
      // Parse file
      options?.onProgress?.(10, 'Reading file...');
      const data = await this.parseFile(file);
      result.totalRecords = data.length;

      if (data.length === 0) {
        throw new Error('No valid data found in file');
      }

      // Load all students for matching
      options?.onProgress?.(20, 'Loading student database...');
      const students = await this.loadStudents();
      
      // Load existing payments to check for duplicates
      options?.onProgress?.(30, 'Checking existing payments...');
      const existingPayments = await this.loadExistingPayments();

      // Process in batches
      const batches = this.createBatches(data);
      const cyclesProcessed = new Set<string>();

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const progressBase = 40 + (i / batches.length) * 50;
        
        options?.onProgress?.(
          progressBase, 
          `Processing batch ${i + 1} of ${batches.length} (${batch.length} records)...`
        );

        await this.processBatch(batch, students, existingPayments, result, cyclesProcessed);
      }

      result.summary.cyclesProcessed = Array.from(cyclesProcessed);
      result.processingTimeMs = Date.now() - startTime;
      
      options?.onProgress?.(100, 'Import completed!');

    } catch (error) {
      result.status = 'error';
      result.errors.push({
        row: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        severity: 'error'
      });
    }

    return result;
  }

  private async parseFile(file: File): Promise<PaymentData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let workbook: XLSX.WorkBook;

          if (file.type === 'text/csv') {
            workbook = XLSX.read(data, { type: 'string' });
          } else {
            workbook = XLSX.read(data, { type: 'array' });
          }

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const parsedData = this.normalizeData(jsonData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse file: ${error}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type === 'text/csv') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  private normalizeData(rawData: any[]): PaymentData[] {
    return rawData.map((row, index) => {
      // Flexible column mapping (case-insensitive)
      const keys = Object.keys(row).map(k => k.toLowerCase());
      const getValue = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const key = keys.find(k => k.includes(name.toLowerCase()));
          if (key) return row[Object.keys(row)[keys.indexOf(key)]];
        }
        return undefined;
      };

      const studentId = getValue(['student id', 'studentid', 'id']);
      const studentName = getValue(['student name', 'name', 'full name', 'fullname']);
      const gradeLevel = getValue(['grade level', 'grade', 'class', 'level']);
      const amountPaid = this.parseAmount(getValue(['amount paid', 'amount', 'paid', 'payment amount']));
      const paymentCycle = this.normalizePaymentCycle(getValue(['payment cycle', 'cycle', 'type', 'payment type']));
      const academicYear = getValue(['academic year', 'year']) || new Date().getFullYear().toString();
      const paymentDate = getValue(['payment date', 'date']);
      const notes = getValue(['notes', 'note', 'comment', 'remarks']);

      return {
        studentId: studentId?.toString().trim(),
        studentName: studentName?.toString().trim(),
        gradeLevel: gradeLevel?.toString().trim(),
        paymentCycle,
        amountPaid,
        academicYear: academicYear?.toString().trim(),
        paymentDate: paymentDate?.toString().trim(),
        notes: notes?.toString().trim()
      };
    }).filter(item => item.paymentCycle && item.amountPaid > 0);
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private normalizePaymentCycle(cycle: string): string {
    if (!cycle) return '';
    
    const normalized = cycle.toLowerCase().trim();
    
    // Map various formats to standard cycles
    const cycleMap: Record<string, string> = {
      'registration': 'registration_fee',
      'registration fee': 'registration_fee',
      'reg fee': 'registration_fee',
      '1st quarter': '1st_quarter',
      'first quarter': '1st_quarter',
      'q1': '1st_quarter',
      '2nd quarter': '2nd_quarter',
      'second quarter': '2nd_quarter',
      'q2': '2nd_quarter',
      '3rd quarter': '3rd_quarter',
      'third quarter': '3rd_quarter',
      'q3': '3rd_quarter',
      '4th quarter': '4th_quarter',
      'fourth quarter': '4th_quarter',
      'q4': '4th_quarter',
      '1st semester': '1st_semester',
      'first semester': '1st_semester',
      's1': '1st_semester',
      '2nd semester': '2nd_semester',
      'second semester': '2nd_semester',
      's2': '2nd_semester',
      'annual': 'annual',
      'yearly': 'annual'
    };

    return cycleMap[normalized] || normalized;
  }

  private async loadStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name, grade_level')
      .eq('status', 'Active');

    if (error) throw new Error(`Failed to load students: ${error.message}`);
    return data || [];
  }

  private async loadExistingPayments() {
    const { data, error } = await supabase
      .from('registration_payments')
      .select('student_id, payment_cycle, academic_year, payment_status, amount_paid');

    if (error) throw new Error(`Failed to load payments: ${error.message}`);
    return data || [];
  }

  private createBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      batches.push(items.slice(i, i + this.BATCH_SIZE));
    }
    return batches;
  }

  private async processBatch(
    batch: PaymentData[],
    students: any[],
    existingPayments: any[],
    result: ImportResult,
    cyclesProcessed: Set<string>
  ) {
    const updates: any[] = [];

    for (const paymentData of batch) {
      try {
        // Find student
        const student = this.findStudent(paymentData, students);
        
        if (!student) {
          result.notFoundCount++;
          result.errors.push({
            row: result.totalRecords - batch.length + batch.indexOf(paymentData) + 1,
            studentId: paymentData.studentId,
            studentName: paymentData.studentName,
            error: 'Student not found in database',
            severity: 'error'
          });
          continue;
        }

        // Check for existing payment
        const existingPayment = existingPayments.find(p => 
          p.student_id === student.id && 
          p.payment_cycle === paymentData.paymentCycle &&
          p.academic_year === paymentData.academicYear
        );

        if (existingPayment && existingPayment.payment_status === 'Paid') {
          result.duplicateCount++;
          result.operations.push({
            type: 'skip',
            studentId: student.student_id,
            studentName: `${student.first_name} ${student.last_name}`,
            paymentCycle: paymentData.paymentCycle,
            amount: paymentData.amountPaid,
            previousStatus: existingPayment.payment_status,
            newStatus: 'Paid',
            message: 'Payment already marked as paid'
          });
          continue;
        }

        // Prepare update data
        const updateData = {
          student_id: student.id,
          payment_cycle: paymentData.paymentCycle,
          amount_paid: paymentData.amountPaid,
          payment_status: 'Paid',
          payment_date: paymentData.paymentDate ? new Date(paymentData.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          academic_year: paymentData.academicYear || new Date().getFullYear().toString(),
          notes: paymentData.notes || 'Updated via bulk import',
          updated_at: new Date().toISOString()
        };

        if (existingPayment) {
          // Update existing payment
          updates.push({
            type: 'update',
            id: existingPayment.id,
            data: updateData,
            student,
            paymentData,
            previousStatus: existingPayment.payment_status
          });
        } else {
          // Create new payment record
          updates.push({
            type: 'insert',
            data: updateData,
            student,
            paymentData,
            previousStatus: 'New'
          });
        }

        cyclesProcessed.add(paymentData.paymentCycle);

      } catch (error) {
        result.errorCount++;
        result.errors.push({
          row: result.totalRecords - batch.length + batch.indexOf(paymentData) + 1,
          studentId: paymentData.studentId,
          studentName: paymentData.studentName,
          error: error instanceof Error ? error.message : 'Processing error',
          severity: 'error'
        });
      }
    }

    // Execute batch updates
    if (updates.length > 0) {
      await this.executeBatchUpdates(updates, result);
    }
  }

  private findStudent(paymentData: PaymentData, students: any[]) {
    // Primary: Match by student ID
    if (paymentData.studentId) {
      const byId = students.find(s => s.student_id === paymentData.studentId);
      if (byId) return byId;
    }

    // Secondary: Match by full name
    if (paymentData.studentName) {
      const nameParts = paymentData.studentName.toLowerCase().split(' ');
      if (nameParts.length >= 2) {
        const byName = students.find(s => {
          const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
          return fullName.includes(nameParts[0]) && fullName.includes(nameParts[nameParts.length - 1]);
        });
        if (byName) return byName;
      }
    }

    // Tertiary: Match by name and grade level
    if (paymentData.studentName && paymentData.gradeLevel) {
      const gradeNormalized = paymentData.gradeLevel.toLowerCase();
      const byNameAndGrade = students.find(s => {
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
        const studentGrade = s.grade_level.toLowerCase();
        return fullName.includes(paymentData.studentName!.toLowerCase()) && 
               (studentGrade.includes(gradeNormalized) || gradeNormalized.includes(studentGrade));
      });
      if (byNameAndGrade) return byNameAndGrade;
    }

    return null;
  }

  private async executeBatchUpdates(updates: any[], result: ImportResult) {
    const insertData = updates.filter(u => u.type === 'insert').map(u => u.data);
    const updateData = updates.filter(u => u.type === 'update');

    try {
      // Bulk insert new payments
      if (insertData.length > 0) {
        const { error: insertError } = await supabase
          .from('registration_payments')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      // Bulk update existing payments
      for (const update of updateData) {
        const { error: updateError } = await supabase
          .from('registration_payments')
          .update(update.data)
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      // Record successful operations
      for (const update of updates) {
        result.successCount++;
        result.summary.studentsUpdated++;
        result.summary.totalAmountProcessed += update.paymentData.amountPaid;

        result.operations.push({
          type: 'update',
          studentId: update.student.student_id,
          studentName: `${update.student.first_name} ${update.student.last_name}`,
          paymentCycle: update.paymentData.paymentCycle,
          amount: update.paymentData.amountPaid,
          previousStatus: update.previousStatus,
          newStatus: 'Paid',
          message: `Payment ${update.type === 'insert' ? 'created' : 'updated'} successfully`
        });
      }

    } catch (error) {
      // Handle batch errors
      for (const update of updates) {
        result.errorCount++;
        result.errors.push({
          row: 0,
          studentId: update.student.student_id,
          studentName: `${update.student.first_name} ${update.student.last_name}`,
          error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        });
      }
    }
  }
}