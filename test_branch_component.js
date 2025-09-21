// Test Branch Component - run in browser console
// This will help us understand what values the BranchSelector is getting

function debugBranchSelector() {
    console.log('🔍 Debug Branch Selector Component State');
    
    // Check if React DevTools can help us see the context
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log('✅ React DevTools detected');
    }
    
    // Try to find the branch selector element
    const selectors = [
        'button:has(svg)', // Button with icon
        '[role="combobox"]', // Dropdown button
        'button:contains("Select Branch")',
        'button:contains("All Branches")',
        // Look for building icon
        'button svg[class*="building"]',
    ];
    
    let found = false;
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`✅ Found ${elements.length} elements for selector: ${selector}`);
                elements.forEach((el, i) => {
                    console.log(`  ${i + 1}. Text: "${el.textContent?.trim()}" | Classes: ${el.className}`);
                });
                found = true;
            }
        } catch (e) {
            // Some selectors might not work in all browsers
        }
    });
    
    if (!found) {
        console.log('❌ Branch selector not found in DOM');
        
        // Check if there are any buttons in the header area
        const headerButtons = document.querySelectorAll('header button, .dashboard button, nav button');
        console.log(`Found ${headerButtons.length} buttons total:`);
        headerButtons.forEach((btn, i) => {
            console.log(`  ${i + 1}. "${btn.textContent?.trim()}" | ${btn.className}`);
        });
    }
    
    // Check for any React error messages
    const errorElements = document.querySelectorAll('[class*="error"], .error, [data-testid*="error"]');
    if (errorElements.length > 0) {
        console.log('⚠️ Potential error elements found:');
        errorElements.forEach(el => console.log('  ', el.textContent));
    }
    
    // Check local storage for branch data
    const savedBranch = localStorage.getItem('selectedBranch');
    console.log('💾 localStorage selectedBranch:', savedBranch);
    
    console.log('\n🎯 Next steps:');
    console.log('1. Check browser console for React errors');
    console.log('2. Check Network tab for failed API calls');
    console.log('3. Use React DevTools to inspect BranchContext state');
}

debugBranchSelector();