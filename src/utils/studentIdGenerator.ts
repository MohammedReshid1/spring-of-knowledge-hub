
import { supabase } from '@/integrations/supabase/client';

export class StudentIdGenerator {
  private static readonly ID_POOL_SIZE = 10000; // Maximum number of IDs (0001-9999)
  private static readonly CURRENT_YEAR = new Date().getFullYear();

  /**
   * Generate a new student ID by either reusing a deleted ID or creating a new random one
   */
  static async generateStudentId(): Promise<string> {
    try {
      // First, try to get a recycled ID from deleted students
      const recycledId = await this.getRecycledId();
      if (recycledId) {
        console.log('Reusing recycled student ID:', recycledId);
        return recycledId;
      }

      // If no recycled ID available, generate a new random one
      const newId = await this.generateNewRandomId();
      console.log('Generated new random student ID:', newId);
      return newId;
    } catch (error) {
      console.error('Error generating student ID:', error);
      // Fallback to simple random generation
      return this.generateFallbackId();
    }
  }

  /**
   * Get a recycled ID from deleted students
   */
  private static async getRecycledId(): Promise<string | null> {
    // Get student IDs from deleted/inactive students that can be reused
    const { data: deletedStudents, error } = await supabase
      .from('students')
      .select('student_id')
      .in('status', ['Transferred Out', 'Dropped Out'])
      .limit(1);

    if (error || !deletedStudents || deletedStudents.length === 0) {
      return null;
    }

    // Return the first available recycled ID
    return deletedStudents[0].student_id;
  }

  /**
   * Generate a new random ID that doesn't exist in the database
   */
  private static async generateNewRandomId(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    while (attempts < maxAttempts) {
      const randomNumber = this.generateRandomNumber();
      const candidateId = `SCH-${this.CURRENT_YEAR}-${randomNumber}`;

      // Check if this ID already exists
      const { data: existingStudent, error } = await supabase
        .from('students')
        .select('student_id')
        .eq('student_id', candidateId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No existing student with this ID, we can use it
        return candidateId;
      }

      if (!existingStudent) {
        return candidateId;
      }

      attempts++;
    }

    // If we couldn't find a unique random ID after max attempts, use fallback
    throw new Error('Could not generate unique random student ID after maximum attempts');
  }

  /**
   * Generate a random 4-digit number with leading zeros
   */
  private static generateRandomNumber(): string {
    const randomNum = Math.floor(Math.random() * this.ID_POOL_SIZE) + 1;
    return randomNum.toString().padStart(4, '0');
  }

  /**
   * Fallback ID generation using timestamp
   */
  private static generateFallbackId(): string {
    const timestamp = Date.now().toString().slice(-4);
    return `SCH-${this.CURRENT_YEAR}-${timestamp}`;
  }

  /**
   * Mark a student ID as available for reuse when a student is deleted
   */
  static async markIdForReuse(studentId: string): Promise<void> {
    try {
      console.log('Student ID marked for potential reuse:', studentId);
      // The ID will be available for reuse when we query for deleted/inactive students
    } catch (error) {
      console.error('Error marking student ID for reuse:', error);
    }
  }

  /**
   * Get statistics about ID usage
   */
  static async getIdStatistics(): Promise<{
    totalActive: number;
    totalInactive: number;
    availablePool: number;
  }> {
    try {
      const [activeResult, inactiveResult] = await Promise.all([
        supabase
          .from('students')
          .select('student_id', { count: 'exact', head: true })
          .eq('status', 'Active'),
        supabase
          .from('students')
          .select('student_id', { count: 'exact', head: true })
          .in('status', ['Transferred Out', 'Dropped Out'])
      ]);

      const totalActive = activeResult.count || 0;
      const totalInactive = inactiveResult.count || 0;
      const availablePool = this.ID_POOL_SIZE - totalActive;

      return {
        totalActive,
        totalInactive,
        availablePool
      };
    } catch (error) {
      console.error('Error getting ID statistics:', error);
      return {
        totalActive: 0,
        totalInactive: 0,
        availablePool: this.ID_POOL_SIZE
      };
    }
  }
}
