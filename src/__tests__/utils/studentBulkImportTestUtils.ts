/**
 * Test utilities for student bulk import functionality
 * Provides mock data, helpers, and common test patterns
 */

import { BulkStudentImportRequest } from '@/lib/api';

export interface MockStudent {
  first_name: string;
  father_name: string;
  grandfather_name: string;
  last_name: string;
  gender: string;
  grade_level: string;
  date_of_birth?: string;
  student_id?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface MockBranch {
  id: string;
  name: string;
  code: string;
}

export interface MockImportResult {
  id: string;
  total_items: number;
  successful_imports: number;
  failed_imports: number;
  validation_errors: Array<{
    row: number;
    error: string;
    field?: string;
    is_duplicate?: boolean;
  }>;
  import_summary: {
    grade_breakdown: Record<string, number>;
    duplicates_found: number;
  };
  status: string;
  created_at: string;
  processed_at?: string;
  branch_id: string;
}

// Mock data generators
export const createMockStudent = (overrides: Partial<MockStudent> = {}): MockStudent => ({
  first_name: 'Ahmed',
  father_name: 'Mohammed',
  grandfather_name: 'Abdullah',
  last_name: 'Al-Rashid',
  gender: 'Male',
  grade_level: '5',
  date_of_birth: '2010-05-15',
  phone: '+966501234567',
  email: 'parent@example.com',
  address: '123 Main Street, Riyadh',
  ...overrides
});

export const createMockBranch = (overrides: Partial<MockBranch> = {}): MockBranch => ({
  id: 'branch-123',
  name: 'Riyadh Main Campus',
  code: 'RYD',
  ...overrides
});

export const createMockImportRequest = (overrides: Partial<BulkStudentImportRequest> = {}): BulkStudentImportRequest => ({
  branch_id: 'branch-123',
  academic_year: '2023-2024',
  validate_only: false,
  notes: 'Test import',
  ...overrides
});

export const createMockImportResult = (overrides: Partial<MockImportResult> = {}): MockImportResult => ({
  id: 'import-123',
  total_items: 10,
  successful_imports: 8,
  failed_imports: 2,
  validation_errors: [
    {
      row: 3,
      error: 'Duplicate student found: Ahmed Mohammed Abdullah',
      is_duplicate: true
    },
    {
      row: 7,
      error: 'Missing required field: first_name',
      field: 'first_name'
    }
  ],
  import_summary: {
    grade_breakdown: {
      '5': 5,
      '6': 3
    },
    duplicates_found: 1
  },
  status: 'completed_with_errors',
  created_at: '2023-10-15T10:30:00Z',
  processed_at: '2023-10-15T10:35:00Z',
  branch_id: 'branch-123',
  ...overrides
});

// Sample student data for testing
export const sampleStudents = [
  createMockStudent({ first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali' }),
  createMockStudent({ first_name: 'Fatima', father_name: 'Abdullah', grandfather_name: 'Hassan', gender: 'Female' }),
  createMockStudent({ first_name: 'Omar', father_name: 'Khalid', grandfather_name: 'Saad' }),
  createMockStudent({ first_name: 'Aisha', father_name: 'Yusuf', grandfather_name: 'Ibrahim', gender: 'Female' }),
  createMockStudent({ first_name: 'Mohammed', father_name: 'Hassan', grandfather_name: 'Ali' })
];

// Duplicate student data for testing duplicate prevention
export const duplicateStudents = [
  createMockStudent({ first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali' }),
  createMockStudent({ first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali' }), // Duplicate
  createMockStudent({ first_name: 'Fatima', father_name: 'Abdullah', grandfather_name: 'Hassan', gender: 'Female' }),
  createMockStudent({ first_name: 'ahmed', father_name: 'mohammed', grandfather_name: 'ali' }), // Case-insensitive duplicate
];

// Invalid student data for testing validation
export const invalidStudents = [
  { first_name: '', father_name: 'Mohammed', grandfather_name: 'Ali' }, // Missing first name
  { first_name: 'Ahmed', father_name: '', grandfather_name: 'Ali' }, // Missing father name
  { first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: '' }, // Missing grandfather name
  { first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali', gender: 'Invalid' }, // Invalid gender
  { first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali', date_of_birth: 'invalid-date' }, // Invalid date
];

// CSV data generators
export const generateValidCSV = (students: MockStudent[]): string => {
  const headers = ['First Name', 'Father Name', 'Grandfather Name', 'Last Name', 'Gender', 'Grade Level', 'Date of Birth', 'Student ID', 'Phone', 'Email', 'Address'];
  const rows = students.map(student => [
    student.first_name,
    student.father_name,
    student.grandfather_name,
    student.last_name,
    student.gender,
    student.grade_level,
    student.date_of_birth || '',
    student.student_id || '',
    student.phone || '',
    student.email || '',
    student.address || ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

export const generateCSVWithDuplicates = (): string => {
  return generateValidCSV(duplicateStudents);
};

export const generateCSVWithInvalidData = (): string => {
  const headers = ['First Name', 'Father Name', 'Grandfather Name', 'Gender', 'Grade Level'];
  const rows = invalidStudents.map(student => [
    student.first_name || '',
    student.father_name || '',
    student.grandfather_name || '',
    student.gender || '',
    student.grade_level || '5'
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

// Excel data generators (array of objects for xlsx library)
export const generateValidExcelData = (students: MockStudent[]) => {
  return students.map(student => ({
    'First Name': student.first_name,
    'Father Name': student.father_name,
    'Grandfather Name': student.grandfather_name,
    'Last Name': student.last_name,
    'Gender': student.gender,
    'Grade Level': student.grade_level,
    'Date of Birth': student.date_of_birth || '',
    'Student ID': student.student_id || '',
    'Phone': student.phone || '',
    'Email': student.email || '',
    'Address': student.address || ''
  }));
};

// File creation helpers for testing
export const createMockCSVFile = (content: string, filename = 'test-students.csv'): File => {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], filename, { type: 'text/csv' });
};

export const createMockExcelFile = (data: any[], filename = 'test-students.xlsx'): File => {
  // In a real test environment, you'd use xlsx library to create the file
  // For testing, we'll mock this as a blob
  const content = JSON.stringify(data);
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// API response mocks
export const mockAPIResponse = <T>(data: T, error = null) => ({
  data,
  error,
  status: 200,
  message: null
});

export const mockAPIError = (message: string, status = 400) => ({
  data: null,
  error: message,
  status,
  message
});

// Test scenario generators
export const createBulkImportTestScenario = (scenario: 'success' | 'duplicates' | 'validation-errors' | 'mixed') => {
  switch (scenario) {
    case 'success':
      return {
        students: sampleStudents.slice(0, 3),
        expectedResult: createMockImportResult({
          total_items: 3,
          successful_imports: 3,
          failed_imports: 0,
          validation_errors: [],
          status: 'completed'
        })
      };

    case 'duplicates':
      return {
        students: duplicateStudents,
        expectedResult: createMockImportResult({
          total_items: 4,
          successful_imports: 2,
          failed_imports: 2,
          validation_errors: [
            {
              row: 2,
              error: 'Duplicate student found: Ahmed Mohammed Abdullah',
              is_duplicate: true
            },
            {
              row: 4,
              error: 'Duplicate student found: ahmed mohammed ali',
              is_duplicate: true
            }
          ],
          import_summary: {
            grade_breakdown: { '5': 4 },
            duplicates_found: 2
          }
        })
      };

    case 'validation-errors':
      return {
        students: invalidStudents,
        expectedResult: createMockImportResult({
          total_items: 5,
          successful_imports: 0,
          failed_imports: 5,
          validation_errors: [
            { row: 1, error: 'Missing required field: first_name', field: 'first_name' },
            { row: 2, error: 'Missing required field: father_name', field: 'father_name' },
            { row: 3, error: 'Missing required field: grandfather_name', field: 'grandfather_name' },
            { row: 4, error: 'Invalid gender: Invalid', field: 'gender' },
            { row: 5, error: 'Invalid date of birth: invalid-date', field: 'date_of_birth' }
          ],
          status: 'completed_with_errors'
        })
      };

    case 'mixed':
      return {
        students: [...sampleStudents.slice(0, 2), ...duplicateStudents.slice(0, 1), ...invalidStudents.slice(0, 1)],
        expectedResult: createMockImportResult({
          total_items: 4,
          successful_imports: 2,
          failed_imports: 2,
          validation_errors: [
            {
              row: 3,
              error: 'Duplicate student found: Ahmed Mohammed Abdullah',
              is_duplicate: true
            },
            {
              row: 4,
              error: 'Missing required field: first_name',
              field: 'first_name'
            }
          ],
          import_summary: {
            grade_breakdown: { '5': 3 },
            duplicates_found: 1
          }
        })
      };

    default:
      throw new Error(`Unknown test scenario: ${scenario}`);
  }
};

// Performance test data generators
export const generateLargeDataset = (size: number): MockStudent[] => {
  const firstNames = ['Ahmed', 'Mohammed', 'Omar', 'Ali', 'Hassan', 'Ibrahim', 'Abdullah', 'Khalid', 'Saad', 'Yusuf'];
  const fatherNames = ['Mohammed', 'Abdullah', 'Ali', 'Hassan', 'Ibrahim', 'Omar', 'Khalid', 'Saad', 'Yusuf', 'Ahmed'];
  const grandfatherNames = ['Ali', 'Hassan', 'Ibrahim', 'Abdullah', 'Mohammed', 'Omar', 'Khalid', 'Saad', 'Yusuf', 'Ahmed'];

  const students: MockStudent[] = [];

  for (let i = 0; i < size; i++) {
    students.push(createMockStudent({
      first_name: firstNames[i % firstNames.length],
      father_name: fatherNames[i % fatherNames.length],
      grandfather_name: grandfatherNames[i % grandfatherNames.length],
      student_id: `STU-${(i + 1).toString().padStart(6, '0')}`,
      grade_level: String(Math.floor(Math.random() * 12) + 1)
    }));
  }

  return students;
};

// Helper functions for testing
export const waitForAsync = (ms = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createMockEvent = (target: any): Event => {
  return {
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as any;
};

export const createMockFileEvent = (file: File): Event => {
  return createMockEvent({
    files: [file],
    value: file.name
  });
};