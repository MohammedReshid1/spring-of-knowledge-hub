import { apiClient } from '@/lib/api';
import type {
  TimeSlot,
  TimeSlotCreate,
  TimetableEntry,
  TimetableEntryCreate,
  BulkTimetableCreate,
  Room,
  RoomCreate,
  Substitution,
  SubstitutionCreate,
  TimetableConflict,
  ClassTimetableView,
  TeacherTimetableView,
  TimetableStats,
  TimetableExportRequest,
  TimetableExportResponse,
  DayOfWeek,
} from '@/types/timetable';

const BASE_PATH = '/api/timetable';

export class TimetableAPI {
  // ===== TIME SLOTS =====
  static async getTimeSlots(params?: {
    skip?: number;
    limit?: number;
    academic_year?: string;
  }): Promise<TimeSlot[]> {
    const { data } = await apiClient.get(`${BASE_PATH}/time-slots`, { params });
    return data;
  }

  static async createTimeSlot(data: TimeSlotCreate): Promise<TimeSlot> {
    const response = await apiClient.post(`${BASE_PATH}/time-slots`, data);
    return response.data;
  }

  static async updateTimeSlot(id: string, data: TimeSlotCreate): Promise<TimeSlot> {
    const response = await apiClient.patch(`${BASE_PATH}/time-slots/${id}`, data);
    return response.data;
  }

  static async deleteTimeSlot(id: string): Promise<{ message: string }> {
    const { data } = await apiClient.delete(`${BASE_PATH}/time-slots/${id}`);
    return data;
  }

  // ===== TIMETABLE ENTRIES =====
  static async getEntries(params?: {
    skip?: number;
    limit?: number;
    class_id?: string;
    teacher_id?: string;
    day_of_week?: DayOfWeek;
    academic_year?: string;
  }): Promise<TimetableEntry[]> {
    const { data } = await apiClient.get(`${BASE_PATH}/entries`, { params });
    return data;
  }

  static async createEntry(data: TimetableEntryCreate): Promise<TimetableEntry> {
    const response = await apiClient.post(`${BASE_PATH}/entries`, data);
    return response.data;
  }

  static async updateEntry(id: string, data: TimetableEntryCreate): Promise<TimetableEntry> {
    const response = await apiClient.patch(`${BASE_PATH}/entries/${id}`, data);
    return response.data;
  }

  static async deleteEntry(id: string): Promise<{ message: string }> {
    const { data} = await apiClient.delete(`${BASE_PATH}/entries/${id}`);
    return data;
  }

  static async createBulkEntries(data: BulkTimetableCreate): Promise<TimetableEntry[]> {
    const response = await apiClient.post(`${BASE_PATH}/entries/bulk`, data);
    return response.data;
  }

  // ===== VIEWS =====
  static async getClassTimetable(classId: string): Promise<ClassTimetableView> {
    const { data } = await apiClient.get(`${BASE_PATH}/class/${classId}`);
    return data;
  }

  static async getTeacherTimetable(teacherId: string): Promise<TeacherTimetableView> {
    const { data } = await apiClient.get(`${BASE_PATH}/teacher/${teacherId}`);
    return data;
  }

  // ===== CONFLICTS =====
  static async getConflicts(params?: {
    severity?: string;
    resolved?: boolean;
  }): Promise<TimetableConflict[]> {
    const { data } = await apiClient.get(`${BASE_PATH}/conflicts`, { params });
    return data;
  }

  static async resolveConflict(id: string, notes: string): Promise<{ message: string }> {
    const { data } = await apiClient.patch(
      `${BASE_PATH}/conflicts/${id}/resolve`,
      null,
      { params: { resolution_notes: notes } }
    );
    return data;
  }

  // ===== ROOMS =====
  static async getRooms(params?: {
    skip?: number;
    limit?: number;
    room_type?: string;
    is_available?: boolean;
  }): Promise<Room[]> {
    const { data } = await apiClient.get(`${BASE_PATH}/rooms`, { params });
    return data;
  }

  static async createRoom(data: RoomCreate): Promise<Room> {
    const response = await apiClient.post(`${BASE_PATH}/rooms`, data);
    return response.data;
  }

  static async updateRoom(id: string, data: Partial<RoomCreate>): Promise<Room> {
    const response = await apiClient.patch(`${BASE_PATH}/rooms/${id}`, data);
    return response.data;
  }

  static async deleteRoom(id: string): Promise<{ message: string }> {
    const { data } = await apiClient.delete(`${BASE_PATH}/rooms/${id}`);
    return data;
  }

  // ===== SUBSTITUTIONS =====
  static async getSubstitutions(params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }): Promise<Substitution[]> {
    const { data } = await apiClient.get(`${BASE_PATH}/substitutions`, { params });
    return data;
  }

  static async createSubstitution(data: SubstitutionCreate): Promise<Substitution> {
    const response = await apiClient.post(`${BASE_PATH}/substitutions`, data);
    return response.data;
  }

  static async approveSubstitution(id: string): Promise<{ message: string }> {
    const { data } = await apiClient.patch(`${BASE_PATH}/substitutions/${id}/approve`);
    return data;
  }

  // ===== STATISTICS =====
  static async getStats(academic_year?: string): Promise<TimetableStats> {
    const params = academic_year ? { academic_year } : {};
    const { data } = await apiClient.get(`${BASE_PATH}/stats`, { params });
    return data;
  }

  // ===== CALENDAR SYNC =====
  static async syncToCalendar(params?: {
    academic_year?: string;
    class_id?: string;
  }): Promise<{ message: string; entries_count: number; academic_year: string }> {
    const { data } = await apiClient.post(`${BASE_PATH}/sync-to-calendar`, null, { params });
    return data;
  }

  // ===== EXPORT =====
  static async exportTimetable(request: TimetableExportRequest): Promise<TimetableExportResponse> {
    const { data } = await apiClient.post(`${BASE_PATH}/export`, request);
    return data;
  }
}
