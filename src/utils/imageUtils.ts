/**
 * Utility functions for handling image URLs
 */

/**
 * Convert a relative image path to a full URL
 * @param path - The image path (can be relative or absolute URL)
 * @returns Full URL to the image, or null if path is invalid
 */
export const getImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;

  // If it's already a full URL, return it
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Otherwise, prepend the API base URL
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${baseUrl}${path}`;
};

/**
 * Get profile picture URL or return a default avatar
 * @param path - The profile picture path
 * @returns Full URL to the profile picture or null for default avatar
 */
export const getProfilePictureUrl = (path: string | null | undefined): string | null => {
  return getImageUrl(path);
};
