#!/bin/bash

# Start the React/Vite frontend server
echo "🎨 Starting Spring of Knowledge Hub Frontend..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Set environment variables for the frontend
export VITE_API_BASE_URL=${VITE_API_BASE_URL:-"http://127.0.0.1:8000"}

echo "📡 Frontend will connect to backend at: $VITE_API_BASE_URL"
echo "🌐 Starting development server on http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
npm run dev 