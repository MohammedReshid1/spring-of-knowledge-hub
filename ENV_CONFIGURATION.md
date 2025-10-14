# Environment Configuration Guide

## Environment Variables

### Production (.env)
```bash
# Backend API - Production Server
VITE_API_BASE_URL=https://school.dablietech.club

# WebSocket - Production Server (Secure WebSocket)
VITE_WS_URL=wss://school.dablietech.club/ws

# Application Info
VITE_APP_NAME="School Management System"
```

### Development (.env.example)
```bash
# Backend API - Local Development
VITE_API_BASE_URL=http://127.0.0.1:8000

# WebSocket - Local Development
VITE_WS_URL=ws://localhost:8000/ws

# Application Info
VITE_APP_NAME="School Management System"
```

## WebSocket Configuration

### Protocol Selection
- **Production:** Use `wss://` (WebSocket Secure) for HTTPS domains
- **Development:** Use `ws://` for HTTP/localhost

### WebSocket Endpoint
The WebSocket endpoint is `/ws` on your FastAPI backend.

### How It Works
1. **Connection:** Frontend connects to `VITE_WS_URL` when user is authenticated
2. **Authentication:** Sends JWT token for authentication
3. **Real-time Updates:** Receives updates for:
   - Students collection changes
   - Classes updates
   - Teachers updates
   - Attendance records
   - Payments
   - Notifications
   - Timetable changes
   - And more...

### WebSocket Features
- **Auto-reconnect:** Automatically reconnects on disconnect (up to 5 attempts)
- **Ping/Pong:** Keeps connection alive with 30-second pings
- **Subscription Management:** Subscribe to specific collections
- **Batch Updates:** Receives multiple updates efficiently
- **Event Handlers:** Custom event listeners for different message types

## Usage in Code

The WebSocket is automatically managed by `WebSocketContext` and used throughout the app:

```typescript
// WebSocketContext.tsx (line 57)
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
```

### Components Using WebSocket
- **StudentsPage** - Real-time student updates
- **ClassesPage** - Live class data
- **TeachersPage** - Teacher information sync
- **TimetablePage** - Schedule updates
- **PaymentsPage** - Payment notifications
- **AttendancePage** - Attendance tracking
- And many more...

## Testing WebSocket Connection

### Check Connection Status
Open browser console and look for:
```
Connecting to WebSocket: wss://school.dablietech.club/ws
WebSocket connected
WebSocket authenticated
```

### Verify in DevTools
1. Open Chrome DevTools
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. You should see the WebSocket connection

## Troubleshooting

### Connection Issues
1. **Check URL:** Ensure `VITE_WS_URL` matches your backend
2. **Protocol:** Use `wss://` for HTTPS, `ws://` for HTTP
3. **Firewall:** Ensure WebSocket port is not blocked
4. **Backend:** Verify FastAPI WebSocket endpoint is running

### Authentication Issues
- Ensure JWT token is valid
- Check token is stored in localStorage
- Verify backend accepts WebSocket authentication

## Security Notes

- **Production:** Always use `wss://` (secure WebSocket) in production
- **Token:** WebSocket authenticates using same JWT token as API
- **CORS:** Backend must allow WebSocket connections from your domain
- **SSL/TLS:** Production WebSocket requires valid SSL certificate

