/**
 * SECURITY: Token Storage using httpOnly Cookies
 *
 * This module has been updated to work with httpOnly cookies for enhanced security.
 * Tokens are no longer stored in localStorage (vulnerable to XSS attacks).
 *
 * Authentication tokens are now stored in httpOnly cookies by the backend server,
 * which prevents JavaScript access and protects against XSS token theft.
 *
 * IMPORTANT: All authentication is now cookie-based. Do NOT attempt to:
 * - Store tokens in localStorage
 * - Read tokens from localStorage
 * - Send tokens in Authorization headers
 *
 * Instead, use `credentials: 'include'` in all fetch requests to send cookies.
 */

export class TokenStorage {
  /**
   * DEPRECATED: Tokens are now in httpOnly cookies, not accessible to JavaScript
   * This method is kept for backward compatibility but does nothing.
   */
  static setToken(token: string): void {
    console.warn(
      'TokenStorage.setToken() is deprecated. ' +
      'Tokens are now stored in httpOnly cookies by the backend. ' +
      'No client-side token storage is needed.'
    );
    // Do nothing - tokens are in httpOnly cookies
  }

  /**
   * DEPRECATED: Tokens are in httpOnly cookies and cannot be accessed by JavaScript
   * This method always returns null as tokens are not accessible client-side.
   *
   * @returns null (tokens are in httpOnly cookies, not accessible)
   */
  static getToken(): string | null {
    // Tokens are in httpOnly cookies - not accessible to JavaScript
    // This is intentional for security (prevents XSS attacks)
    return null;
  }

  /**
   * Clear authentication by calling the backend logout endpoint.
   * The backend will clear the httpOnly cookie.
   *
   * This method should be called indirectly via apiClient.logout()
   */
  static async removeToken(): Promise<void> {
    // Tokens are cleared by calling /auth/logout endpoint
    // The backend will clear the httpOnly cookie
    console.info('Call apiClient.logout() to clear authentication cookies');
  }

  /**
   * DEPRECATED: Refresh tokens are also in httpOnly cookies
   */
  static setRefreshToken(refreshToken: string): void {
    console.warn(
      'TokenStorage.setRefreshToken() is deprecated. ' +
      'Refresh tokens are handled automatically via httpOnly cookies.'
    );
    // Do nothing
  }

  /**
   * DEPRECATED: Refresh tokens are in httpOnly cookies
   * @returns null
   */
  static getRefreshToken(): string | null {
    return null;
  }

  /**
   * Clear authentication state
   * Actual cookie clearing happens on the backend via /auth/logout
   */
  static clear(): void {
    console.info('Authentication cleared. Backend cookies will be removed via /auth/logout');
  }

  /**
   * Check if user is authenticated by making a request to /auth/me
   * This is the recommended way to check authentication status with httpOnly cookies
   *
   * @returns Promise<boolean> - true if authenticated, false otherwise
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/me`, {
        method: 'GET',
        credentials: 'include', // Send httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  }
}

/**
 * Helper function to get CSRF token from cookies
 * CSRF tokens are stored in regular cookies (not httpOnly) so JavaScript can read them
 */
export function getCSRFTokenFromCookie(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}