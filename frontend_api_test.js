
// Test Frontend-Backend Connection
// Run this in browser console on http://localhost:8080

async function testAPIConnection() {
    console.log('🧪 Testing Frontend-Backend Connection...');
    
    // Test 1: Health check
    try {
        const healthResponse = await fetch('http://localhost:8000/health');
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
    } catch (error) {
        console.error('❌ Health check failed:', error);
    }
    
    // Test 2: Students endpoint (should require auth)
    try {
        const studentsResponse = await fetch('http://localhost:8000/students');
        if (studentsResponse.status === 401) {
            console.log('✅ Students endpoint accessible (401 expected without auth)');
        } else {
            console.log('Students response status:', studentsResponse.status);
        }
    } catch (error) {
        console.error('❌ Students endpoint error:', error);
    }
    
    // Test 3: Login endpoint
    try {
        const loginResponse = await fetch('http://localhost:8000/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'username=test&password=test'
        });
        console.log('✅ Login endpoint accessible (status:', loginResponse.status, ')');
    } catch (error) {
        console.error('❌ Login endpoint error:', error);
    }
    
    console.log('🎯 Test complete. Check for CORS errors above.');
}

testAPIConnection();
