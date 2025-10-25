/**
 * End-to-End Tests for Student Bulk Import Workflows
 * Tests complete user workflows from file upload to import completion
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { BulkStudentImport } from '@/components/students/BulkStudentImport';
import * as testUtils from '@/__tests__/utils/studentBulkImportTestUtils';

// Mock API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    getStudents: vi.fn(),
    getGradeLevelsByBranch: vi.fn(),
    getClasses: vi.fn(),
    createClass: vi.fn(),
    updateClass: vi.fn(),
    createStudent: vi.fn(),
    bulkImportStudents: vi.fn(),
    getImportStatus: vi.fn(),
    getImportHistory: vi.fn(),
  }
}));

// Mock contexts
vi.mock('@/contexts/BranchContext', () => ({
  useBranch: () => ({
    selectedBranch: 'branch-123',
    setSelectedBranch: vi.fn()
  })
}));

// Mock XLSX
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
    json_to_sheet: vi.fn(),
    book_new: vi.fn(),
    book_append_sheet: vi.fn(),
    writeFile: vi.fn()
  }
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Student Bulk Import E2E Workflows', () => {
  const mockOnImportComplete = vi.fn();
  const apiClient = vi.mocked(await import('@/lib/api')).apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    toast.mockReturnValue({
      dismiss: vi.fn(),
      update: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Successful Import Workflow', () => {
    it('should handle complete workflow from template download to successful import', async () => {
      // Setup mocks
      const mockStudents = testUtils.sampleStudents.slice(0, 3);
      const mockData = testUtils.generateValidExcelData(mockStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock API responses
      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([
          { id: 'grade-5', grade: 'grade_5' },
          { id: 'grade-4', grade: 'grade_4' }
        ])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      apiClient.updateClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      apiClient.createStudent.mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Step 1: Download Excel template
      const excelButton = screen.getByText(/Download Excel Template/);
      await userEvent.click(excelButton);
      expect(XLSX.utils.writeFile).toHaveBeenCalledWith(
        expect.any(Object),
        'student-import-template.xlsx'
      );

      // Step 2: Upload file
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Step 3: Verify processing starts
      await waitFor(() => {
        expect(screen.getByText(/Processing Import/)).toBeInTheDocument();
      });

      // Step 4: Verify progress updates
      await waitFor(() => {
        expect(screen.getByText(/\d+%$/)).toBeInTheDocument();
      });

      // Step 5: Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Import Completed/)).toBeInTheDocument();
        expect(screen.getByText(/Successfully imported \d+ students/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Step 6: Verify callbacks and cache invalidation
      expect(mockOnImportComplete).toHaveBeenCalled();
      expect(apiClient.getStudents).toHaveBeenCalled();
      expect(apiClient.createStudent).toHaveBeenCalledTimes(3);
    });
  });

  describe('Duplicate Detection and Prevention Workflow', () => {
    it('should detect duplicates and prevent duplicate imports', async () => {
      const duplicateStudents = testUtils.duplicateStudents;
      const mockData = testUtils.generateValidExcelData(duplicateStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock existing students
      apiClient.getStudents.mockResolvedValue(
        testUtils.mockAPIResponse({
          items: [
            {
              first_name: 'Ahmed',
              father_name: 'Mohammed',
              grandfather_name: 'Ali',
              student_id: 'STU-001'
            }
          ]
        })
      );
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Upload file with duplicates
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Wait for processing to complete
      await waitFor(() => {
        expect(screen.getByText(/Import completed:/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify duplicate detection results
      expect(screen.getByText(/0 successful/)).toBeInTheDocument();
      expect(screen.getByText(/\d+ failed/)).toBeInTheDocument();
      expect(screen.getByText(/Import Errors/)).toBeInTheDocument();
      expect(screen.getByText(/Student already exists \(duplicate\)/)).toBeInTheDocument();

      // Verify no students were created
      expect(apiClient.createStudent).not.toHaveBeenCalled();
    });

    it('should show detailed duplicate information with student identities', async () => {
      const duplicateStudents = testUtils.duplicateStudents;
      const mockData = testUtils.generateValidExcelData(duplicateStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock existing students
      apiClient.getStudents.mockResolvedValue(
        testUtils.mockAPIResponse({
          items: [
            {
              first_name: 'Ahmed',
              father_name: 'Mohammed',
              grandfather_name: 'Ali',
              student_id: 'STU-001'
            }
          ]
        })
      );
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Upload file with duplicates
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Wait for error details to appear
      await waitFor(() => {
        expect(screen.getByText(/Import Errors/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify detailed error messages
      const errorMessages = screen.getAllByText(/Student already exists \(duplicate\)/);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery Workflow', () => {
    it('should handle validation errors gracefully and continue processing', async () => {
      const mixedData = [
        testUtils.sampleStudents[0], // Valid
        { first_name: '', father_name: 'Invalid', grandfather_name: 'Student' }, // Invalid
        testUtils.sampleStudents[1]  // Valid
      ];
      const mockData = testUtils.generateValidExcelData(mixedData);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      apiClient.createStudent.mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Upload mixed data
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Wait for processing to complete
      await waitFor(() => {
        expect(screen.getByText(/Import completed:/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify mixed results
      expect(screen.getByText(/2 successful/)).toBeInTheDocument();
      expect(screen.getByText(/1 failed/)).toBeInTheDocument();
      expect(screen.getByText(/Import Errors/)).toBeInTheDocument();

      // Verify some students were created
      expect(apiClient.createStudent).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors and provide user feedback', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock API error
      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockRejectedValue(new Error('Database connection failed'));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Upload file
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByText(/Import Failed/)).toBeInTheDocument();
        expect(screen.getByText(/No students were imported successfully/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Large Dataset Import Workflow', () => {
    it('should handle large datasets with progress updates', async () => {
      const largeDataset = testUtils.generateLargeDataset(100);
      const mockData = testUtils.generateValidExcelData(largeDataset);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      apiClient.createStudent.mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Upload large dataset
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      const startTime = Date.now();

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Verify progress updates are shown
      await waitFor(() => {
        expect(screen.getByText(/Processing Import/)).toBeInTheDocument();
      });

      // Wait for completion (should take longer for large dataset)
      await waitFor(() => {
        expect(screen.getByText(/Import Completed/)).toBeInTheDocument();
        expect(screen.getByText(/Successfully imported 100 students/)).toBeInTheDocument();
      }, { timeout: 10000 });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify performance (should complete within reasonable time)
      expect(processingTime).toBeLessThan(5000); // 5 seconds max for test
      expect(apiClient.createStudent).toHaveBeenCalledTimes(100);
      expect(mockOnImportComplete).toHaveBeenCalled();
    });
  });

  describe('Concurrent Import Prevention', () => {
    it('should prevent multiple simultaneous imports', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));

      // Mock slow student creation
      apiClient.createStudent.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(testUtils.mockAPIResponse({ id: 'student-123' })), 1000))
      );

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      // Start first import
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Verify button is disabled during processing
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /Importing Students\.\.\./ });
        expect(uploadButton).toBeDisabled();
      });

      // Try to upload second file (should not be possible)
      const secondFile = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [secondFile] } });
      });

      // Verify no new import started
      expect(apiClient.createStudent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Browser Compatibility and Error Recovery', () => {
    it('should handle file upload errors gracefully', async () => {
      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Create invalid file
      const invalidFile = new File(['invalid content'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      });

      // Verify error handling
      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "File Processing Error",
          description: expect.any(String),
          variant: "destructive",
        });
      });
    });

    it('should handle network interruptions during import', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));

      // Mock network error for student creation
      apiClient.createStudent.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/Import completed:/)).toBeInTheDocument();
        expect(screen.getByText(/0 successful/)).toBeInTheDocument();
        expect(screen.getByText(/1 failed/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('User Experience and Feedback', () => {
    it('should provide clear feedback throughout the import process', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      apiClient.getStudents.mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      apiClient.getGradeLevelsByBranch.mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      apiClient.getClasses.mockResolvedValue(testUtils.mockAPIResponse([]));
      apiClient.createClass.mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      apiClient.createStudent.mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(
        <TestWrapper>
          <BulkStudentImport onImportComplete={mockOnImportComplete} />
        </TestWrapper>
      );

      // Initial state
      expect(screen.getByText(/Bulk Student Import with Class Detection/)).toBeInTheDocument();
      expect(screen.getByText(/How it works:/)).toBeInTheDocument();

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Processing state
      await waitFor(() => {
        expect(screen.getByText(/Processing Import/)).toBeInTheDocument();
        expect(screen.getByText(/\d+%$/)).toBeInTheDocument();
      });

      // Completion state
      await waitFor(() => {
        expect(screen.getByText(/Import Completed/)).toBeInTheDocument();
        expect(screen.getByText(/Successfully imported 1 students/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});