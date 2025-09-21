# 🚀 Production Deployment Guide

## ✅ Production Setup Complete!

Your School Management System is now configured for **production** with a real MongoDB database.

## 🎯 What's Been Configured

### ✅ MongoDB Database
- **Status**: ✅ Installed and running
- **Version**: MongoDB 7.0
- **Database**: `spring_of_knowledge`
- **Data Location**: `/data/db`
- **Connection**: `mongodb://localhost:27017`

### ✅ Initial Data
- **1 Branch**: Main Campus
- **3 Grade Levels**: Kindergarten, Grade 1, Grade 2
- **3 Subjects**: Mathematics, English, Science
- **2 Classes**: KG-A, Grade 1-A
- **3 Payment Modes**: Cash, Bank Transfer, Card
- **Database Indexes**: Optimized for performance

### ✅ Backend Configuration
- **Database**: Real MongoDB (not mock)
- **Environment**: Production mode
- **Security**: JWT authentication enabled
- **API Docs**: Available at `/docs`

## 🚀 Quick Start

### Option 1: Automated Start (Recommended)
```bash
./start_production.sh
```

### Option 2: Manual Start

**Terminal 1 - MongoDB & Backend:**
```bash
# Start MongoDB (if not running)
sudo -u mongodb mongod --dbpath /data/db --logpath /var/log/mongodb/mongod.log --fork

# Start Backend
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## 🌐 Access Your Application

- **School Management System**: http://localhost:5173
- **API Documentation**: http://localhost:8000/docs
- **API Base URL**: http://localhost:8000

## 🔐 Security Configuration

### Environment Variables (.env)
```env
# Database
USE_MOCK_DB=false
MONGODB_URI=mongodb://localhost:27017

# Security
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30

# Environment
ENVIRONMENT=production
```

⚠️ **IMPORTANT**: Change the `JWT_SECRET_KEY` to a secure, random string in production!

## 📊 Database Management

### View Database Contents
```bash
# Connect to MongoDB shell
mongosh

# Switch to your database
use spring_of_knowledge

# View collections
show collections

# View branches
db.branches.find().pretty()

# View students
db.students.find().pretty()
```

### Backup Database
```bash
# Create backup
mongodump --db spring_of_knowledge --out /backup/$(date +%Y%m%d)

# Restore backup
mongorestore --db spring_of_knowledge /backup/20240120/spring_of_knowledge/
```

### Reset Database
```bash
# Re-initialize with fresh data
cd backend
source venv/bin/activate
python init_db.py
```

## 🔧 Production Optimizations

### 1. Performance Settings
```bash
# MongoDB configuration for production
sudo nano /etc/mongod.conf
```

Add these settings:
```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1

net:
  maxIncomingConnections: 100

operationProfiling:
  slowOpThresholdMs: 100
  mode: slowOp
```

### 2. Process Management
```bash
# Install PM2 for process management
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start "uvicorn app.main:app --host 0.0.0.0 --port 8000" --name school-backend

# Start frontend with PM2
cd ..
pm2 start "npm run dev" --name school-frontend

# Save PM2 configuration
pm2 save
pm2 startup
```

### 3. Reverse Proxy (Nginx)
```bash
# Install Nginx
sudo apt install nginx

# Create configuration
sudo nano /etc/nginx/sites-available/school-management
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🔍 Monitoring & Logs

### Application Logs
```bash
# Backend logs
tail -f /var/log/mongodb/mongod.log

# Application logs (if using PM2)
pm2 logs school-backend
pm2 logs school-frontend
```

### Health Checks
```bash
# Check MongoDB
mongosh --eval "db.adminCommand('hello')"

# Check Backend API
curl http://localhost:8000/docs

# Check Frontend
curl http://localhost:5173
```

## 🔄 Updates & Maintenance

### Update Application
```bash
# Pull latest changes
git pull origin main

# Update frontend dependencies
npm install

# Update backend dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Restart services
pm2 restart all
```

### Database Maintenance
```bash
# Compact database
mongosh --eval "db.runCommand({compact: 'students'})"

# Rebuild indexes
mongosh --eval "db.students.reIndex()"

# Check database stats
mongosh --eval "db.stats()"
```

## 🚨 Troubleshooting

### Common Issues

#### MongoDB Won't Start
```bash
# Check if port is in use
sudo netstat -tulpn | grep :27017

# Check disk space
df -h /data/db

# Check permissions
sudo chown -R mongodb:mongodb /data/db
```

#### Backend Connection Errors
```bash
# Check environment variables
grep -E "MONGODB_URI|USE_MOCK_DB" .env

# Test MongoDB connection
mongosh --eval "db.adminCommand('hello')"

# Check backend logs
tail -f backend.log
```

#### Frontend Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for port conflicts
sudo netstat -tulpn | grep :5173
```

## 📈 Scaling Considerations

### For High Traffic
1. **Database**: Consider MongoDB replica sets
2. **Backend**: Use multiple uvicorn workers
3. **Frontend**: Build for production and serve with Nginx
4. **Caching**: Implement Redis for session storage
5. **Load Balancing**: Use Nginx upstream for multiple backend instances

### Production Build
```bash
# Build frontend for production
npm run build

# Serve with a production server
npm install -g serve
serve -s dist -l 3000
```

## 🎉 Success Indicators

Your production setup is working correctly when:

1. ✅ MongoDB is running and accessible
2. ✅ Backend API responds at `/docs`
3. ✅ Frontend loads without errors
4. ✅ Database operations work (CRUD)
5. ✅ Authentication system functions
6. ✅ All initial data is populated

---

**🎯 Your School Management System is now production-ready!**

For support or questions, refer to the API documentation at http://localhost:8000/docs