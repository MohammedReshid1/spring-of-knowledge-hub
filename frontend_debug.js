
// Frontend Debugging Script
// Run in browser console on http://localhost:8080

async function debugFrontendIssues() {
    console.log('🔍 Frontend Debugging Started...');
    
    // Check if API client is working
    if (window.localStorage) {
        const token = localStorage.getItem('auth_token');
        console.log('Auth token in localStorage:', token ? 'Present' : 'Missing');
    }
    
    // Check API base URL
    console.log('Expected API URL: http://localhost:8000');
    
    // Test direct API call
    try {
        const response = await fetch('http://localhost:8000/health');
        const data = await response.json();
        console.log('✅ Direct API health check:', data);
    } catch (error) {
        console.error('❌ Direct API call failed:', error);
    }
    
    // Check React Query cache
    if (window.__REACT_QUERY_DEVTOOLS__) {
        console.log('React Query DevTools available');
    }
    
    // Check for console errors
    console.log('Check for any React errors above this message');
    
    // Test auth context
    console.log('Check if auth context shows user as authenticated');
    
    console.log('🎯 Debug complete. Look for errors above.');
}

debugFrontendIssues();
