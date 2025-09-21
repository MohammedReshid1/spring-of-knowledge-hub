#!/bin/bash

# Start the FastAPI backend server
echo "🚀 Starting Spring of Knowledge Hub Backend..."

# Check if we're in the right directory
if [ ! -f "backend/app/main.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Create uploads directory if it doesn't exist
mkdir -p public/lovable-uploads

# Set environment variables
export USE_MOCK_DB=false
export MONGODB_URL=${MONGODB_URL:-"mongodb://localhost:27017"}
export DATABASE_NAME=${DATABASE_NAME:-"spring_knowledge_hub"}
export JWT_SECRET_KEY=${JWT_SECRET_KEY:-"your-secret-key-change-in-production"}

# Start the server
cd backend
echo "📡 Starting server on http://127.0.0.1:8000"
echo "📚 API documentation available at http://127.0.0.1:8000/docs"
echo "🔧 Using MongoDB at: $MONGODB_URL/$DATABASE_NAME"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload 