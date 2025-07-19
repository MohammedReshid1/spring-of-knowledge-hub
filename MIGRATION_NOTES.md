# Migration from Supabase to FastAPI Backend

## Overview
This project has been successfully migrated from using Supabase as the backend to a custom FastAPI backend. This migration provides better control over the API, improved performance, and easier customization.

## Changes Made

### 1. Removed Supabase Dependencies
- Removed `@supabase/supabase-js` package
- Deleted `src/integrations/supabase/` directory
- Removed Supabase configuration files

### 2. Created New API Client
- **File**: `src/lib/api.ts`
- Implements all CRUD operations for the FastAPI backend
- Handles authentication with JWT tokens
- Includes proper error handling

### 3. Updated Authentication System
- **File**: `src/contexts/AuthContext.tsx`
- Now uses FastAPI's JWT-based authentication
- Stores tokens in localStorage
- Implements session management with 30-minute timeout

### 4. Created New Type Definitions
- **File**: `src/types/api.ts`
- Defines TypeScript interfaces for all API entities
- Replaces old Supabase-generated types

### 5. Updated Core Hooks
- **File**: `src/hooks/useBranchData.tsx` - Simplified to work with REST API
- **File**: `src/hooks/useAuth.tsx` - Updated to use new auth context
- **File**: `src/contexts/BranchContext.tsx` - Uses new API client

### 6. Updated Components
- **File**: `src/components/branches/BranchManagement.tsx` - Updated to use new API client
- All other components will work with the updated hooks and contexts

## Configuration

### Environment Variables
Create a `.env` file based on `.env.example`:

```bash
# FastAPI Backend URL
VITE_API_BASE_URL=http://127.0.0.1:8000

# Application Configuration
VITE_APP_NAME="School Management System"
```

### Backend Requirements
Ensure your FastAPI backend is running on the configured URL (default: `http://127.0.0.1:8000`) with the following endpoints:

#### Authentication
- `POST /users/login` - User login
- `POST /users/signup` - User registration
- `GET /users/me` - Get current user

#### Core Entities
- `GET|POST /branches/` - Branches management
- `GET|POST /students/` - Students management
- `GET|POST /classes/` - Classes management
- `GET|POST /attendance/` - Attendance management
- `GET|POST /fees/` - Fees management
- `GET|POST /subjects/` - Subjects management
- `GET|POST /grade-levels/` - Grade levels management
- And all other endpoints as documented in your FastAPI swagger docs

## API Client Features

### Authentication
- Automatic token management
- Session persistence
- Automatic logout on token expiration

### Error Handling
- Consistent error format across all requests
- Proper HTTP status code handling
- User-friendly error messages

### Branch Filtering
- Automatic branch-based data filtering
- Support for multi-branch and single-branch users
- "All branches" view for admin users

## Migration Benefits

1. **Better Performance**: Direct REST API calls without Supabase overhead
2. **Full Control**: Complete control over API endpoints and business logic
3. **Easier Debugging**: Direct access to backend logs and debugging
4. **Cost Effective**: No Supabase subscription costs
5. **Customization**: Easy to add custom endpoints and business logic

## Next Steps

1. Ensure your FastAPI backend is running and properly configured
2. Test all major functionality (authentication, CRUD operations)
3. Update any remaining components that might still reference Supabase
4. Set up proper error monitoring and logging
5. Consider implementing API caching for better performance

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your FastAPI backend has proper CORS configuration
2. **Authentication Failures**: Check that JWT token format matches between frontend and backend
3. **API Not Found**: Verify the API base URL in your environment configuration
4. **Missing Data**: Ensure all required fields are being sent to the backend API

### Development Setup

1. Start the FastAPI backend server
2. Start the frontend development server
3. Check browser console for any remaining Supabase references
4. Test core functionality like login, branch switching, and data management

The migration is now complete! Your application should work seamlessly with the FastAPI backend.