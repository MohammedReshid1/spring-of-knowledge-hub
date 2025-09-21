# Spring of Knowledge Hub - Backend Integration Guide

## Overview

This guide covers the complete integration between the React frontend and FastAPI backend, including the recent changes to move registration payments under the fees endpoint.

## Backend Changes Made

### 1. Registration Payments Endpoint Restructure

**Before:**
- Registration payments were under `/registration-payments`
- Separate router and endpoints

**After:**
- Registration payments are now under `/fees/registration-payments`
- Integrated into the fees router for better organization

### 2. New Endpoints Structure

```
/fees/
├── /                    # Regular fee operations
├── /registration-payments     # List registration payments
├── /registration-payments/    # Create registration payment
├── /registration-payments/{id} # Get/Update/Delete specific payment
```

### 3. File Upload System

Added comprehensive file upload system:
- `/uploads/upload` - Upload files
- `/uploads/files` - List uploaded files
- `/uploads/{filename}` - Get/Delete specific files
- Static file serving for direct access

## Frontend Integration

### API Client Updates

The frontend API client (`src/lib/api.ts`) has been updated to use the new endpoints:

```typescript
// Registration Payment methods now use /fees/registration-payments
async getRegistrationPayments(): Promise<ApiResponse<any[]>> {
  return this.request('/fees/registration-payments');
}

async createRegistrationPayment(paymentData: any): Promise<ApiResponse<any>> {
  return this.request('/fees/registration-payments', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}
```

### New Upload Methods

```typescript
// File upload methods
async uploadFile(file: File): Promise<ApiResponse<any>>
async getUploadedFiles(): Promise<ApiResponse<any[]>>
async deleteUploadedFile(filename: string): Promise<ApiResponse<void>>
```

## Development Setup

### Prerequisites

1. **MongoDB** - Running locally or accessible via connection string
2. **Node.js** - For frontend development
3. **Python 3.8+** - For backend development

### Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository>
   cd spring-of-knowledge-hub
   ```

2. **Install dependencies:**
   ```bash
   # Frontend dependencies
   npm install
   
   # Backend dependencies
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

3. **Start development environment:**
   ```bash
   # Start both backend and frontend
   ./start_dev.sh
   
   # Or start individually:
   ./start_backend.sh    # Backend only
   ./start_frontend.sh   # Frontend only
   ```

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=spring_knowledge_hub

# Security
JWT_SECRET_KEY=your-secret-key-change-in-production

# Development
USE_MOCK_DB=false
```

For frontend, create a `.env` file in the root:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## API Endpoints

### Authentication
- `POST /users/login` - User login
- `POST /users/signup` - User registration
- `GET /users/me` - Get current user

### Branches
- `GET /branches/` - List branches
- `POST /branches/` - Create branch
- `PUT /branches/{id}` - Update branch
- `DELETE /branches/{id}` - Delete branch

### Students
- `GET /students/` - List students
- `POST /students/` - Create student
- `PUT /students/{id}` - Update student
- `DELETE /students/{id}` - Delete student

### Teachers
- `GET /teachers/` - List teachers
- `POST /teachers/` - Create teacher
- `PUT /teachers/{id}` - Update teacher
- `DELETE /teachers/{id}` - Delete teacher

### Classes
- `GET /classes/` - List classes
- `POST /classes/` - Create class
- `PUT /classes/{id}` - Update class
- `DELETE /classes/{id}` - Delete class

### Fees
- `GET /fees/` - List fees
- `POST /fees/` - Create fee
- `PUT /fees/{id}` - Update fee
- `DELETE /fees/{id}` - Delete fee

### Registration Payments (under fees)
- `GET /fees/registration-payments` - List registration payments
- `POST /fees/registration-payments` - Create registration payment
- `PUT /fees/registration-payments/{id}` - Update registration payment
- `DELETE /fees/registration-payments/{id}` - Delete registration payment

### File Uploads
- `POST /uploads/upload` - Upload file
- `GET /uploads/files` - List uploaded files
- `GET /uploads/{filename}` - Get specific file
- `DELETE /uploads/{filename}` - Delete file

### Other Endpoints
- `GET /attendance/` - Attendance management
- `GET /grade-levels/` - Grade level management
- `GET /subjects/` - Subject management
- `GET /payment-mode/` - Payment mode management
- `GET /student-enrollments/` - Student enrollment management
- `GET /stats/dashboard` - Dashboard statistics

## Database Schema

The system uses MongoDB with the following collections:
- `users` - User accounts and authentication
- `branches` - School branches
- `students` - Student information
- `teachers` - Teacher information
- `classes` - School classes
- `fees` - Fee records
- `registration_payments` - Registration payment records
- `attendance` - Attendance records
- `grade_levels` - Grade level definitions
- `subjects` - Subject definitions
- `payment_modes` - Payment method definitions
- `student_enrollments` - Student enrollment records
- `backup_logs` - System backup logs
- `grade_transitions` - Grade transition records

## Testing

### Backend Testing
```bash
cd backend
pytest
```

### Frontend Testing
```bash
npm test
```

## Production Deployment

### Backend Deployment
1. Set production environment variables
2. Use production MongoDB instance
3. Deploy using uvicorn or gunicorn
4. Set up reverse proxy (nginx)

### Frontend Deployment
1. Build the application: `npm run build`
2. Serve static files from `dist/` directory
3. Configure API base URL for production

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend CORS settings include frontend URL
   - Check that frontend is running on expected port

2. **Database Connection**
   - Verify MongoDB is running
   - Check connection string in environment variables

3. **File Upload Issues**
   - Ensure `public/lovable-uploads` directory exists
   - Check file permissions

4. **Authentication Issues**
   - Verify JWT secret key is set
   - Check token expiration settings

### Logs

- Backend logs: Check uvicorn output
- Frontend logs: Check browser console
- Database logs: Check MongoDB logs

## Support

For issues or questions:
1. Check the API documentation at `http://127.0.0.1:8000/docs`
2. Review the FastAPI automatic documentation
3. Check the browser console for frontend errors
4. Review backend logs for server errors