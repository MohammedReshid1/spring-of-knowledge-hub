/**
 * Frontend Integration Tests for BulkStudentImport Component
 * Tests the UI integration, duplicate detection feedback, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toast } from '@/hooks/use-toast';
import { BulkStudentImport } from '@/components/students/BulkStudentImport';
import { apiClient } from '@/lib/api';
import * as testUtils from '@/__tests__/utils/studentBulkImportTestUtils';

// Mock dependencies
vi.mock('@/lib/api');
vi.mock('@/hooks/use-toast');
vi.mock('@/contexts/BranchContext', () => ({
  useBranch: () => ({
    selectedBranch: 'branch-123'
  })
}));

// Mock XLSX library
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

// Mock queryClient
const mockQueryClient = {
  invalidateQueries: vi.fn()
};

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient
}));

describe('BulkStudentImport Component', () => {
  const mockOnImportComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset toast mock
    toast.mockReturnValue({
      dismiss: vi.fn(),
      update: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the bulk import interface correctly', () => {
      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      expect(screen.getByText(/Bulk Student Import with Class Detection/)).toBeInTheDocument();
      expect(screen.getByText(/Download Excel Template/)).toBeInTheDocument();
      expect(screen.getByText(/Download CSV Template/)).toBeInTheDocument();
      expect(screen.getByText(/Select Excel File to Import/)).toBeInTheDocument();
      expect(screen.getByText(/How it works:/)).toBeInTheDocument();
    });

    it('should display usage instructions', () => {
      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      expect(screen.getByText(/Filename Method:/)).toBeInTheDocument();
      expect(screen.getByText(/Header Method:/)).toBeInTheDocument();
      expect(screen.getByText(/Supports PRE KG, KG, PREP, and Grade 1-12/)).toBeInTheDocument();
    });
  });

  describe('Template Download', () => {
    it('should download Excel template when button is clicked', async () => {
      const XLSX = await import('xlsx');
      const mockWriteFile = XLSX.writeFile;

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const excelButton = screen.getByText(/Download Excel Template/);
      await userEvent.click(excelButton);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(Object),
        'student-import-template.xlsx'
      );
    });

    it('should download CSV template when button is clicked', async () => {
      // Mock URL.createObjectURL and link.click
      global.URL.createObjectURL = vi.fn(() => 'mock-url');
      global.URL.revokeObjectURL = vi.fn();
      const mockLink = { click: vi.fn(), href: '', download: '' };
      global.document.createElement = vi.fn(() => mockLink);

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const csvButton = screen.getByText(/Download CSV Template/);
      await userEvent.click(csvButton);

      expect(mockLink.download).toBe('student-import-template.csv');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('File Upload and Processing', () => {
    it('should handle valid file upload and start import process', async () => {
      const mockStudents = testUtils.sampleStudents.slice(0, 3);
      const mockData = testUtils.generateValidExcelData(mockStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock API calls
      vi.mocked(apiClient.getStudents).mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      vi.mocked(apiClient.getGradeLevelsByBranch).mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      vi.mocked(apiClient.getClasses).mockResolvedValue(testUtils.mockAPIResponse([]));
      vi.mocked(apiClient.createClass).mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      vi.mocked(apiClient.createStudent).mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Processing Import/)).toBeInTheDocument();
      });
    });

    it('should display progress updates during import', async () => {
      const mockStudents = testUtils.sampleStudents.slice(0, 2);
      const mockData = testUtils.generateValidExcelData(mockStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock API calls
      vi.mocked(apiClient.getStudents).mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      vi.mocked(apiClient.getGradeLevelsByBranch).mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      vi.mocked(apiClient.getClasses).mockResolvedValue(testUtils.mockAPIResponse([]));
      vi.mocked(apiClient.createClass).mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      vi.mocked(apiClient.createStudent).mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Processing Import/)).toBeInTheDocument();
        expect(screen.getByText(/\d+%$/)).toBeInTheDocument();
      });
    });

    it('should handle file processing errors gracefully', async () => {
      // Mock XLSX to throw error
      const XLSX = await import('xlsx');
      XLSX.read.mockImplementation(() => {
        throw new Error('Invalid file format');
      });

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile([{ test: 'data' }]);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "File Processing Error",
          description: "Invalid file format",
          variant: "destructive",
        });
      });
    });

    it('should show branch selection error when no branch is selected', async () => {
      // Mock branch context to return null
      vi.doMock('@/contexts/BranchContext', () => ({
        useBranch: () => ({
          selectedBranch: null
        })
      }));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "Branch Required",
          description: "Please select a branch from the branch selector at the top before importing students",
          variant: "destructive",
        });
      });
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect and report duplicate students during import', async () => {
      const mockData = testUtils.generateValidExcelData(testUtils.duplicateStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock existing students
      vi.mocked(apiClient.getStudents).mockResolvedValue(
        testUtils.mockAPIResponse({
          items: [
            { first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali' }
          ]
        })
      );
      vi.mocked(apiClient.getGradeLevelsByBranch).mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      vi.mocked(apiClient.getClasses).mockResolvedValue(testUtils.mockAPIResponse([]));
      vi.mocked(apiClient.createClass).mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Import completed:/)).toBeInTheDocument();
        expect(screen.getByText(/0 successful/)).toBeInTheDocument();
        expect(screen.getByText(/duplicates found/)).toBeInTheDocument();
      });
    });

    it('should show detailed error messages for duplicate students', async () => {
      const mockData = testUtils.generateValidExcelData(testUtils.duplicateStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock existing students
      vi.mocked(apiClient.getStudents).mockResolvedValue(
        testUtils.mockAPIResponse({
          items: [
            { first_name: 'Ahmed', father_name: 'Mohammed', grandfather_name: 'Ali' }
          ]
        })
      );
      vi.mocked(apiClient.getGradeLevelsByBranch).mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      vi.mocked(apiClient.getClasses).mockResolvedValue(testUtils.mockAPIResponse([]));
      vi.mocked(apiClient.createClass).mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Import Errors/)).toBeInTheDocument();
        expect(screen.getByText(/Student already exists \(duplicate\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Import Results Display', () => {
    it('should display successful import results', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock API calls
      vi.mocked(apiClient.getStudents).mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      vi.mocked(apiClient.getGradeLevelsByBranch).mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      vi.mocked(apiClient.getClasses).mockResolvedValue(testUtils.mockAPIResponse([]));
      vi.mocked(apiClient.createClass).mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      vi.mocked(apiClient.createStudent).mockResolvedValue(testUtils.mockAPIResponse({ id: 'student-123' }));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Import Completed/)).toBeInTheDocument();
        expect(screen.getByText(/Successfully imported 1 students/)).toBeInTheDocument();
      });

      expect(mockOnImportComplete).toHaveBeenCalled();
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['students'] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['student-stats'] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
    });

    it('should display import results with errors', async () => {
      const mockData = testUtils.generateValidExcelData(testUtils.invalidStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Import completed:/)).toBeInTheDocument();
        expect(screen.getByText(/0 successful/)).toBeInTheDocument();
        expect(screen.getByText(/\d+ failed/)).toBeInTheDocument();
      });
    });

    it('should limit error display and show count for additional errors', async () => {
      const manyInvalidStudents = Array(15).fill(null).map((_, i) => ({
        first_name: '',
        father_name: 'Test',
        grandfather_name: 'User'
      }));

      const mockData = testUtils.generateValidExcelData(manyInvalidStudents);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Import Errors \(\d+\)/)).toBeInTheDocument();
        expect(screen.getByText(/\.\.\. and \d+ more errors/)).toBeInTheDocument();
      });
    });
  });

  describe('Data Validation and Processing', () => {
    it('should handle empty files gracefully', async () => {
      const mockData = [];

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "File Processing Error",
          description: "No data found in the Excel file",
          variant: "destructive",
        });
      });
    });

    it('should handle API errors during student creation', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      // Mock API calls with error
      vi.mocked(apiClient.getStudents).mockResolvedValue(testUtils.mockAPIResponse({ items: [] }));
      vi.mocked(apiClient.getGradeLevelsByBranch).mockResolvedValue(
        testUtils.mockAPIResponse([{ id: 'grade-5', grade: 'grade_5' }])
      );
      vi.mocked(apiClient.getClasses).mockResolvedValue(testUtils.mockAPIResponse([]));
      vi.mocked(apiClient.createClass).mockResolvedValue(testUtils.mockAPIResponse({ id: 'class-123' }));
      vi.mocked(apiClient.createStudent).mockResolvedValue(testUtils.mockAPIError('Database error', 500));

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Import completed:/)).toBeInTheDocument();
        expect(screen.getByText(/0 successful/)).toBeInTheDocument();
        expect(screen.getByText(/1 failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Component State Management', () => {
    it('should reset file input after processing', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Check if file input is reset
      expect(fileInput.value).toBe('');
    });

    it('should disable import button during processing', async () => {
      const mockData = testUtils.generateValidExcelData([testUtils.sampleStudents[0]]);

      // Mock XLSX parsing
      const XLSX = await import('xlsx');
      XLSX.read.mockReturnValue({
        SheetNames: ['Students'],
        Sheets: { Students: {} }
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockData);

      render(<BulkStudentImport onImportComplete={mockOnImportComplete} />);

      const fileInput = screen.getByRole('button', { name: /Select Excel File to Import/ }).querySelector('input[type="file"]');
      const file = testUtils.createMockExcelFile(mockData);

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Importing Students\.\.\./)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Importing Students\.\.\./ })).toBeDisabled();
      });
    });
  });
});