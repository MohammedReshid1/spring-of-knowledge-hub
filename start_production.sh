#!/bin/bash

echo "🚀 Starting School Management System in Production Mode"

# Check if MongoDB is running
if ! pgrep mongod > /dev/null; then
    echo "📊 Starting MongoDB..."
    sudo mkdir -p /data/db
    sudo chown -R mongodb:mongodb /data/db
    sudo -u mongodb mongod --dbpath /data/db --logpath /var/log/mongodb/mongod.log --fork
    sleep 3
else
    echo "✅ MongoDB is already running"
fi

# Check MongoDB connection
echo "🔗 Testing MongoDB connection..."
if mongosh --eval "db.adminCommand('hello')" > /dev/null 2>&1; then
    echo "✅ MongoDB connection successful"
else
    echo "❌ MongoDB connection failed"
    exit 1
fi

# Initialize database if not already done
echo "📊 Checking database initialization..."
cd backend
source venv/bin/activate
python init_db.py

# Start backend server
echo "🔧 Starting backend server..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Test backend
if curl -f http://localhost:8000/docs > /dev/null 2>&1; then
    echo "✅ Backend server started successfully"
else
    echo "❌ Backend server failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Go back to project root
cd ..

# Start frontend server
echo "🎨 Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo ""
echo "🎉 Production servers started successfully!"
echo ""
echo "📊 Services Status:"
echo "   • MongoDB:  ✅ Running"
echo "   • Backend:  ✅ Running on http://localhost:8000"
echo "   • Frontend: ✅ Running on http://localhost:5173"
echo ""
echo "🌐 Access your application:"
echo "   • School Management System: http://localhost:5173"
echo "   • API Documentation: http://localhost:8000/docs"
echo ""
echo "🛑 To stop all services, press Ctrl+C and run: pkill -f 'uvicorn|vite|mongod'"
echo ""

# Keep script running
trap 'echo "🛑 Stopping services..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT

# Wait for processes to finish
wait