#!/bin/bash

echo "🔧 Setting up School Management System Integration..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if required tools are available
echo "Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js not found"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm not found"
    exit 1
fi

if ! command_exists python3; then
    echo "❌ Python3 not found"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Setup frontend
echo "📦 Installing frontend dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Frontend dependency installation failed"
        exit 1
    fi
else
    echo "✅ Frontend dependencies already installed"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📄 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Setup backend
echo "🐍 Setting up Python backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Virtual environment creation failed"
        exit 1
    fi
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Python dependency installation failed"
    exit 1
fi
echo "✅ Python dependencies installed"

cd ..

# Install MongoDB (try different methods)
echo "🗄️ Setting up database..."
if ! command_exists mongod; then
    echo "Installing MongoDB..."
    
    # Try to install MongoDB Community Edition
    if command_exists curl; then
        curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
        sudo apt update
        sudo apt install -y mongodb-org
    else
        echo "⚠️ MongoDB installation requires manual setup"
        echo "Please install MongoDB manually or use a cloud database"
    fi
else
    echo "✅ MongoDB already installed"
fi

# Start MongoDB service
if command_exists systemctl; then
    sudo systemctl start mongod
    sudo systemctl enable mongod
    echo "✅ MongoDB service started"
fi

echo ""
echo "🎉 Integration setup complete!"
echo ""
echo "To start the application:"
echo "1. Start the backend server:"
echo "   cd backend && source venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000"
echo ""
echo "2. Start the frontend server (in a new terminal):"
echo "   npm run dev"
echo ""
echo "3. Open your browser to http://localhost:5173"
echo ""
echo "Backend API will be available at http://localhost:8000"
echo "API documentation at http://localhost:8000/docs"