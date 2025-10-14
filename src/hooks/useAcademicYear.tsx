import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface AcademicYear {
  id: string;
  year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  branch_id?: string;
}

/**
 * Custom hook to get the current academic year
 *
 * This hook provides centralized access to the current academic year
 * ensuring consistency across the application.
 *
 * @returns {object} Query result with current academic year data
 * @returns {string} data.year - Academic year in format "YYYY-YYYY" (e.g., "2024-2025")
 * @returns {boolean} isLoading - Whether the query is loading
 * @returns {Error} error - Error object if query failed
 */
export function useAcademicYear() {
  return useQuery<AcademicYear>({
    queryKey: ['academic-year', 'current'],
    queryFn: async () => {
      const response = await apiClient.get('/academic-calendar/academic-years/current');
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - academic year doesn't change frequently
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
    // Fallback to calculated year on error
    placeholderData: {
      id: 'calculated',
      year: calculateAcademicYear(),
      start_date: '',
      end_date: '',
      is_current: true
    }
  });
}

/**
 * Calculate academic year based on current date
 * Academic year runs from September to August
 */
function calculateAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth() is 0-indexed
  const year = now.getFullYear();

  if (month >= 9) {
    // September onwards: current year to next year
    return `${year}-${year + 1}`;
  } else {
    // January to August: previous year to current year
    return `${year - 1}-${year}`;
  }
}

/**
 * Get academic year string from useAcademicYear hook result
 * Useful for quick access to just the year string
 *
 * @param academicYearQuery - Result from useAcademicYear()
 * @returns Academic year string or calculated fallback
 */
export function getAcademicYearString(academicYearQuery: ReturnType<typeof useAcademicYear>): string {
  return academicYearQuery.data?.year || calculateAcademicYear();
}

/**
 * Standalone function to calculate academic year
 * Use this when you need the academic year synchronously without React hooks
 */
export { calculateAcademicYear };
