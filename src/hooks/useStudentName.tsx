import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Cache for student names to avoid repeated API calls
const studentNameCache = new Map<string, string>();

export const useStudentName = (studentId: string | undefined) => {
  const { data: studentName = studentId || 'Unknown' } = useQuery({
    queryKey: ['student-name', studentId],
    queryFn: async () => {
      if (!studentId) return 'Unknown';
      
      // Check cache first
      if (studentNameCache.has(studentId)) {
        return studentNameCache.get(studentId)!;
      }
      
      try {
        // Fetch all students (this will be cached by react-query)
        const response = await apiClient.getAllStudents();
        if (response.error || !response.data) {
          return studentId;
        }
        
        // Cache all student names from the response
        response.data.forEach((student: any) => {
          const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.student_id;
          studentNameCache.set(student.student_id, fullName);
        });
        
        // Return the requested student's name
        const student = response.data.find((s: any) => s.student_id === studentId);
        if (student) {
          const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || studentId;
          return fullName;
        }
        
        return studentId;
      } catch (error) {
        console.error('Error fetching student name:', error);
        return studentId;
      }
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
  
  return studentName;
};

// Hook to fetch multiple student names at once
export const useStudentNames = () => {
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => {
      try {
        const response = await apiClient.getAllStudents();
        if (response.error || !response.data) {
          return [];
        }
        
        // Cache all student names
        response.data.forEach((student: any) => {
          const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.student_id;
          studentNameCache.set(student.student_id, fullName);
        });
        
        return response.data;
      } catch (error) {
        console.error('Error fetching students:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  const getStudentName = (studentId: string) => {
    if (studentNameCache.has(studentId)) {
      return studentNameCache.get(studentId)!;
    }
    
    const student = students.find((s: any) => s.student_id === studentId);
    if (student) {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || studentId;
      return fullName;
    }
    
    return studentId;
  };
  
  return { students, getStudentName, isLoading };
};