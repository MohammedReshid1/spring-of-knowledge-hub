from datetime import datetime, timedelta
from typing import Dict, Optional
from fastapi import HTTPException, Request, status
import asyncio
from collections import defaultdict

class RateLimiter:
    """Simple in-memory rate limiter for API endpoints."""
    
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.blocked_ips: Dict[str, datetime] = {}
        self.lock = asyncio.Lock()
    
    async def check_rate_limit(
        self,
        client_ip: str,
        max_requests: int = 60,
        window_seconds: int = 60,
        block_duration_minutes: int = 15
    ) -> bool:
        """
        Check if a client has exceeded the rate limit.
        
        Args:
            client_ip: Client IP address
            max_requests: Maximum number of requests allowed
            window_seconds: Time window in seconds
            block_duration_minutes: How long to block an IP after exceeding limits
        
        Returns:
            True if request is allowed, raises HTTPException if blocked
        """
        async with self.lock:
            now = datetime.utcnow()
            
            # Check if IP is blocked
            if client_ip in self.blocked_ips:
                block_expiry = self.blocked_ips[client_ip]
                if now < block_expiry:
                    remaining_seconds = (block_expiry - now).seconds
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Rate limit exceeded. Please try again in {remaining_seconds} seconds.",
                        headers={"Retry-After": str(remaining_seconds)}
                    )
                else:
                    # Unblock IP
                    del self.blocked_ips[client_ip]
            
            # Clean old requests
            window_start = now - timedelta(seconds=window_seconds)
            self.requests[client_ip] = [
                req_time for req_time in self.requests[client_ip]
                if req_time > window_start
            ]
            
            # Check rate limit
            if len(self.requests[client_ip]) >= max_requests:
                # Block the IP
                self.blocked_ips[client_ip] = now + timedelta(minutes=block_duration_minutes)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. You have been temporarily blocked for {block_duration_minutes} minutes.",
                    headers={"Retry-After": str(block_duration_minutes * 60)}
                )
            
            # Record the request
            self.requests[client_ip].append(now)
            return True
    
    async def cleanup_old_entries(self, older_than_hours: int = 24):
        """Clean up old entries to prevent memory bloat."""
        async with self.lock:
            cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)
            
            # Clean old requests
            for ip in list(self.requests.keys()):
                self.requests[ip] = [
                    req_time for req_time in self.requests[ip]
                    if req_time > cutoff_time
                ]
                if not self.requests[ip]:
                    del self.requests[ip]
            
            # Clean expired blocks
            now = datetime.utcnow()
            for ip in list(self.blocked_ips.keys()):
                if self.blocked_ips[ip] < now:
                    del self.blocked_ips[ip]

# Global rate limiter instance
rate_limiter = RateLimiter()

async def get_client_ip(request: Request) -> str:
    """Extract client IP from request, considering proxy headers."""
    # Check for proxy headers
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct connection IP
    if request.client:
        return request.client.host
    
    return "unknown"

class RateLimitMiddleware:
    """Middleware for applying rate limits to all endpoints."""
    
    def __init__(
        self,
        max_requests: int = 100,
        window_seconds: int = 60,
        exclude_paths: Optional[list] = None
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.exclude_paths = exclude_paths or ["/docs", "/openapi.json", "/health"]
    
    async def __call__(self, request: Request, call_next):
        # Skip rate limiting for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)
        
        # Get client IP
        client_ip = await get_client_ip(request)
        
        # Apply different limits based on endpoint
        if request.url.path.startswith("/users/login"):
            # Stricter limits for login endpoint
            max_requests = 5
            window_seconds = 60
        elif request.url.path.startswith("/registration-payments/bulk-import"):
            # Lower limits for bulk operations
            max_requests = 10
            window_seconds = 300  # 5 minutes
        else:
            max_requests = self.max_requests
            window_seconds = self.window_seconds
        
        # Check rate limit
        try:
            await rate_limiter.check_rate_limit(
                client_ip,
                max_requests=max_requests,
                window_seconds=window_seconds
            )
        except HTTPException as e:
            # Return rate limit error response
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
                headers=e.headers
            )
        
        # Continue with the request
        response = await call_next(request)
        return response

# Periodic cleanup task
async def periodic_cleanup():
    """Run periodic cleanup of old rate limit entries."""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        await rate_limiter.cleanup_old_entries()