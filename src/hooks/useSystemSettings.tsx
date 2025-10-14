import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface SystemSettings {
  id: string;
  school_name: string;
  currency: string;
  language: string;
}

/**
 * Hook to fetch system settings including currency and language
 */
export function useSystemSettings() {
  return useQuery<SystemSettings>({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/system-settings/');
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
    placeholderData: {
      id: '',
      school_name: 'Spring of Knowledge Academy',
      currency: 'ETB',
      language: 'en'
    }
  });
}

/**
 * Get currency string from system settings query
 */
export function getCurrency(systemSettingsQuery: ReturnType<typeof useSystemSettings>): string {
  return systemSettingsQuery.data?.currency || 'ETB';
}

/**
 * Get language string from system settings query
 */
export function getLanguage(systemSettingsQuery: ReturnType<typeof useSystemSettings>): string {
  return systemSettingsQuery.data?.language || 'en';
}

/**
 * Get school name from system settings query
 */
export function getSchoolName(systemSettingsQuery: ReturnType<typeof useSystemSettings>): string {
  return systemSettingsQuery.data?.school_name || 'Spring of Knowledge Academy';
}

/**
 * Hook to get just the currency
 */
export function useCurrency() {
  const settingsQuery = useSystemSettings();
  return getCurrency(settingsQuery);
}

/**
 * Hook to get just the language
 */
export function useLanguage() {
  const settingsQuery = useSystemSettings();
  return getLanguage(settingsQuery);
}
