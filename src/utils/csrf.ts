/**
 * CSRF Token Utility
 * Handles CSRF token extraction from cookies for CSRF protection
 */

/**
 * Get CSRF token from cookie
 * The backend sets this cookie on GET requests
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieName = 'csrf_token';
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Check if a request method requires CSRF protection
 */
export function requiresCSRFToken(method: string): boolean {
  const upperMethod = method.toUpperCase();
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(upperMethod);
}
