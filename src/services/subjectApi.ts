import { apiClient } from '@/lib/api';
import type { Subject } from '@/types/api';

export interface SubjectCreate {
  subject_name: string;
  subject_code: string;
  description?: string;
  grade_levels: string[];
}

export interface SubjectUpdate {
  subject_name?: string;
  subject_code?: string;
  description?: string;
  grade_levels?: string[];
}

export const SubjectAPI = {
  /**
   * Get all subjects
   */
  async getAll(): Promise<Subject[]> {
    const { data, error } = await apiClient.request('/subjects');
    if (error) throw new Error(error);
    return data || [];
  },

  /**
   * Get subject by ID
   */
  async getById(id: string): Promise<Subject> {
    const { data, error } = await apiClient.request(`/subjects/${id}`);
    if (error) throw new Error(error);
    if (!data) throw new Error('Subject not found');
    return data;
  },

  /**
   * Create new subject
   */
  async create(subject: SubjectCreate): Promise<Subject> {
    const { data, error } = await apiClient.request('/subjects', {
      method: 'POST',
      body: JSON.stringify(subject)
    });
    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to create subject');
    return data;
  },

  /**
   * Update subject
   */
  async update(id: string, subject: SubjectUpdate): Promise<Subject> {
    const { data, error } = await apiClient.request(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(subject)
    });
    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to update subject');
    return data;
  },

  /**
   * Delete subject
   */
  async delete(id: string): Promise<void> {
    const { error } = await apiClient.request(`/subjects/${id}`, {
      method: 'DELETE'
    });
    if (error) throw new Error(error);
  }
};
