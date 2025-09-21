// Clear localStorage branch cache
// Run this in browser console on http://localhost:8080

console.log('🧹 Clearing Branch Cache...');

// Check current localStorage
console.log('Current selectedBranch:', localStorage.getItem('selectedBranch'));

// Clear it
localStorage.removeItem('selectedBranch');

// Confirm cleared
console.log('After clearing:', localStorage.getItem('selectedBranch'));

// Reload page to force re-initialization
console.log('Reloading page...');
window.location.reload();