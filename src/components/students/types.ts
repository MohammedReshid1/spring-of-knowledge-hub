export interface SyncOperation {
  type: 'create' | 'reassign' | 'no_change';
  studentName: string;
  className: string;
  fromClass?: string;
  timestamp: Date;
}

export interface SyncResult {
  totalFiles: number;
  filesProcessed: number;
  studentsToCreate: number;
  studentsToReassign: number;
  studentsCreated: number;
  studentsReassigned: number;
  studentsUnchanged: number;
  classesCreated: number;
  errors: string[];
  operations: SyncOperation[];
  paymentUpdateResult?: PaymentUpdateResult;
}

export interface PaymentUpdateResult {
  studentsProcessed: number;
  updatedPayments: number;
  errors: string[];
}

export interface StudentData {
  firstName: string;
  lastName: string;
  fullName: string;
  className: string;
  gradeLevel: string;
}

export interface ClassData {
  id?: string;
  className: string;
  gradeLevel: string;
  students: StudentData[];
}