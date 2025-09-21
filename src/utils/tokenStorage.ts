// Secure token storage utility
export class TokenStorage {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';

  static setToken(token: string): void {
    try {
      // Store in localStorage as fallback
      localStorage.setItem(this.TOKEN_KEY, token);
      
      // Note: For production, consider using httpOnly cookies via backend endpoint
      // This would require a backend endpoint to set the httpOnly cookie
      
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  static getToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  static removeToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      
      // Clear any httpOnly cookies by calling backend logout endpoint
      // This would be handled by the signOut API call
      
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  }

  static setRefreshToken(refreshToken: string): void {
    try {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Failed to store refresh token:', error);
    }
  }

  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      return null;
    }
  }

  static clear(): void {
    this.removeToken();
  }
}