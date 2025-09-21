#!/bin/bash

# Spring of Knowledge Hub - Full Backend Startup Script
# This script ensures the backend is fully functional

echo "========================================"
echo "🚀 Spring of Knowledge Hub Backend"
echo "========================================"

# Check if MongoDB is running
echo "🔍 Checking MongoDB status..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Starting MongoDB..."
    # Try to start MongoDB (adjust command based on OS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew services start mongodb-community@7.0 2>/dev/null || mongod --fork --logpath /usr/local/var/log/mongodb/mongo.log --dbpath /usr/local/var/mongodb
    else
        # Linux
        sudo systemctl start mongod 2>/dev/null || mongod --fork --logpath /var/log/mongodb/mongod.log --dbpath /var/lib/mongodb
    fi
    sleep 3
fi

# Check MongoDB connection
echo "🔗 Testing MongoDB connection..."
python3 -c "from motor.motor_asyncio import AsyncIOMotorClient; import asyncio; asyncio.run(AsyncIOMotorClient('mongodb://localhost:27017').server_info())" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to MongoDB. Please ensure MongoDB is installed and running."
    exit 1
fi
echo "✅ MongoDB is running and accessible"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "📚 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Initialize database
echo ""
echo "🗄️  Database Initialization"
echo "----------------------------------------"
read -p "Initialize database with sample data? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python3 comprehensive_init_db.py
fi

# Set environment variables
export MONGODB_URI="mongodb://localhost:27017"
export DATABASE_NAME="spring_of_knowledge"
export JWT_SECRET_KEY="your-secret-key-change-in-production"
export JWT_ALGORITHM="HS256"
export ACCESS_TOKEN_EXPIRE_MINUTES="30"
export ENVIRONMENT="development"

# Start the backend server
echo ""
echo "========================================"
echo "🌟 Starting Backend Server"
echo "========================================"
echo "📍 Server will be available at:"
echo "   • API: http://localhost:8000"
echo "   • Docs: http://localhost:8000/docs"
echo "   • ReDoc: http://localhost:8000/redoc"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000