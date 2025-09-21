#!/bin/bash

# Start both backend and frontend for development
echo "🚀 Starting Spring of Knowledge Hub Development Environment..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "backend/app/main.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Create necessary directories
mkdir -p public/lovable-uploads

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Set environment variables
export USE_MOCK_DB=false
export MONGODB_URL=${MONGODB_URL:-"mongodb://localhost:27017"}
export DATABASE_NAME=${DATABASE_NAME:-"spring_knowledge_hub"}
export JWT_SECRET_KEY=${JWT_SECRET_KEY:-"your-secret-key-change-in-production"}
export VITE_API_BASE_URL=${VITE_API_BASE_URL:-"http://127.0.0.1:8000"}

echo "📡 Backend will run on: http://127.0.0.1:8000"
echo "🌐 Frontend will run on: http://localhost:8080"
echo "📚 API docs will be at: http://127.0.0.1:8000/docs"
echo ""

# Start backend in background
echo "🔧 Starting backend server..."
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background
echo "🎨 Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are starting up..."
echo "📡 Backend PID: $BACKEND_PID"
echo "🎨 Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait 
