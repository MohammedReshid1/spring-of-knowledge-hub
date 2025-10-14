// Debug Branch Selector Logic
// This simulates what should happen in the BranchSelector component

console.log('🔍 Branch Selector Logic Debug');

// Simulate the data we know from backend
const userBranches = []; // 0 branches from backend
const currentUser = {
  role: 'super_admin', // from backend
  branch_id: null
};

// Simulate the role checks
const isHQRole = ['super_admin', 'hq_admin', 'hq_registrar'].includes(currentUser.role);
const canSwitchBranches = isHQRole;

console.log('User data:', {
  userBranches: userBranches.length,
  role: currentUser.role,
  isHQRole,
  canSwitchBranches
});

// Check BranchSelector visibility logic
const shouldShowSelector = !(userBranches.length === 1 && !canSwitchBranches);
console.log('Should show selector:', shouldShowSelector);

// Check what selectedBranch should be initially
let selectedBranch = null; // Initial state

// Logic from useEffect
if (!selectedBranch) {
  if (userBranches.length > 0) {
    if (!isHQRole && userBranches.length === 1) {
      selectedBranch = userBranches[0].id;
    }
    // HQ roles start with no selection
  }
}

console.log('Initial selectedBranch:', selectedBranch);

// Check dropdown options
console.log('Dropdown should show:');
if (isHQRole) {
  console.log('  - All Branches (0)');
}
userBranches.forEach(branch => {
  console.log(`  - ${branch.name}`);
});

// Check button text
let buttonText;
if (selectedBranch === 'all') buttonText = 'All Branches';
else if (!selectedBranch) buttonText = 'Select Branch';
else buttonText = 'Unknown Branch';

console.log('Button should show:', buttonText);

// Check badge text
let badgeText;
if (selectedBranch === 'all') badgeText = userBranches.length || 0;
else if (!selectedBranch) badgeText = '?';
else badgeText = 1;

console.log('Badge should show:', badgeText);

console.log('\n🎯 Expected result:');
console.log('- Selector should be VISIBLE');
console.log('- Button text: "Select Branch"');
console.log('- Badge: "?"');
console.log('- Dropdown: "All Branches (0)" option only');