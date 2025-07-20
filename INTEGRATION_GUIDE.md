# School Management System - Integration Guide

## 🎯 Overview

This project is a full-stack school management system with:
- **Frontend**: React + TypeScript + Vite + shadcn/ui
- **Backend**: FastAPI + Python
- **Database**: MongoDB (with mock database option for development)

## 🚀 Quick Start

### Automated Setup
Run the automated setup script:
```bash
./setup_integration.sh
```

### Manual Setup

#### 1. Frontend Setup
```bash
# Install Node.js dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

#### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python -m uvicorn app.main:app --reload --port 8000
```

## 🗄️ Database Configuration

### Option 1: Mock Database (Recommended for Development)
The application is configured to use a mock database by default. This requires no additional setup.

**Environment Variable**: `USE_MOCK_DB=true` (in .env file)

### Option 2: MongoDB (Production)
To use a real MongoDB database:

1. Install MongoDB:
   ```bash
   # Ubuntu/Debian
   sudo apt install mongodb-org
   
   # macOS
   brew install mongodb-community
   
   # Or use MongoDB Atlas (cloud)
   ```

2. Start MongoDB service:
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. Update environment variables:
   ```env
   USE_MOCK_DB=false
   MONGODB_URI=mongodb://localhost:27017
   ```

## 🔧 Integration Components

### Frontend (React + Vite)
- **Port**: 5173
- **API Client**: `src/lib/api.ts`
- **Configuration**: `src/lib/config.ts`
- **Types**: `src/types/api.ts`

### Backend (FastAPI)
- **Port**: 8000
- **API Documentation**: http://localhost:8000/docs
- **Main Entry**: `backend/app/main.py`
- **Database**: `backend/app/db.py` or `backend/app/db_mock.py`
- **Routes**: `backend/app/routers/`

### Key Files
- `package.json` - Frontend dependencies and scripts
- `backend/requirements.txt` - Python dependencies
- `.env` - Environment configuration
- `vite.config.ts` - Frontend build configuration
- `backend/app/main.py` - Backend entry point

## 🐛 Troubleshooting

### Common Issues

#### 1. Frontend Not Starting
```bash
# Error: Module not found
npm install

# Error: Port 5173 already in use
npm run dev -- --port 3000
```

#### 2. Backend Not Starting
```bash
# Error: Python module not found
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Error: Port 8000 already in use
python -m uvicorn app.main:app --reload --port 8001
```

#### 3. Database Connection Issues
```bash
# Check if using mock database
grep "USE_MOCK_DB" .env

# For MongoDB issues
sudo systemctl status mongod
sudo systemctl start mongod
```

#### 4. CORS Errors
The backend is configured to allow CORS from:
- `http://localhost:5173` (Vite default)
- `http://localhost:8080` (Alternative port)

If using a different port, update `backend/app/main.py`:
```python
origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:3000",  # Add your port here
]
```

### Environment Variables

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_APP_NAME="School Management System"
```

#### Backend (.env)
```env
USE_MOCK_DB=true
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET_KEY=your-secret-key
```

## 🛠️ Development Workflow

### Starting Both Services
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
npm run dev
```

### Making Changes
- **Frontend**: Changes auto-reload with Vite
- **Backend**: Changes auto-reload with `--reload` flag
- **Database**: Mock data persists in `backend/mock_data.json`

## 📚 API Documentation

Once the backend is running, visit:
- **Interactive Docs**: http://localhost:8000/docs
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🔒 Security Notes

- JWT tokens are stored in localStorage (30-minute timeout)
- CORS is enabled for development ports
- Mock database is for development only - use proper authentication in production

## 📁 Project Structure

```
.
├── src/                    # Frontend React app
│   ├── components/         # React components
│   ├── lib/               # Utilities and API client
│   └── types/             # TypeScript definitions
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── main.py        # FastAPI app entry
│   │   ├── db.py          # MongoDB connection
│   │   ├── db_mock.py     # Mock database
│   │   └── routers/       # API endpoints
│   └── requirements.txt   # Python dependencies
├── package.json           # Frontend dependencies
├── .env                   # Environment variables
└── setup_integration.sh   # Automated setup script
```

## 🎉 Success Indicators

When everything is working correctly:
1. Frontend loads at http://localhost:5173
2. Backend API docs at http://localhost:8000/docs
3. No CORS errors in browser console
4. API calls return data (check Network tab)
5. Database operations work (create/read/update/delete)

## 🆘 Getting Help

If you encounter issues not covered here:
1. Check the browser console for errors
2. Check the backend console output
3. Verify all dependencies are installed
4. Ensure ports 5173 and 8000 are available
5. Try restarting both services