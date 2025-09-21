// Final Branch Selector Test
// Run this in browser console on http://localhost:8080

async function testBranchSelector() {
    console.log('🧪 Testing Branch Selector Implementation...');
    
    // Clear localStorage to start fresh
    localStorage.removeItem('selectedBranch');
    console.log('✅ Cleared localStorage');
    
    // Check if branch selector is visible
    const branchSelector = document.querySelector('[data-testid="branch-selector"]') || 
                          document.querySelector('button:has(svg)') ||
                          document.querySelector('button[role="combobox"]');
    
    if (branchSelector) {
        console.log('✅ Branch selector found in DOM');
        
        // Check if it shows "Select Branch"
        const buttonText = branchSelector.textContent;
        console.log(`Button text: "${buttonText}"`);
        
        if (buttonText.includes('Select Branch') || buttonText.includes('All Branches')) {
            console.log('✅ Branch selector shows correct text');
        }
        
        // Check if dropdown menu works
        branchSelector.click();
        setTimeout(() => {
            const dropdownItems = document.querySelectorAll('[role="menuitem"]');
            console.log(`✅ Dropdown items found: ${dropdownItems.length}`);
            
            dropdownItems.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.textContent}`);
            });
        }, 100);
    } else {
        console.log('❌ Branch selector not found');
    }
    
    // Check students table state
    const studentsTable = document.querySelector('table');
    const emptyState = document.querySelector('div:contains("Please select a branch")') ||
                      document.querySelector('[class*="text-center"]');
    
    if (studentsTable) {
        const rows = studentsTable.querySelectorAll('tbody tr');
        console.log(`📊 Students table has ${rows.length} rows`);
    } else if (emptyState) {
        console.log('✅ Empty state message displayed');
    }
    
    console.log('🎯 Test complete!');
}

testBranchSelector();