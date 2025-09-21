export interface JwtPayload {
  exp: number;
  iat: number;
  sub: string;
  role?: string;
  branch_id?: string;
}

export const parseJwt = (token: string): JwtPayload | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  
  const currentTime = Date.now() / 1000;
  return payload.exp < currentTime;
};

export const getTokenExpirationTime = (token: string): number | null => {
  const payload = parseJwt(token);
  return payload?.exp ? payload.exp * 1000 : null;
};

export const shouldRefreshToken = (token: string): boolean => {
  const payload = parseJwt(token);
  if (!payload?.exp) return false;
  
  const currentTime = Date.now() / 1000;
  const timeUntilExpiry = payload.exp - currentTime;
  
  // Refresh if token expires within 5 minutes
  return timeUntilExpiry < 300;
};