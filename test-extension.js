// Test script to validate the extension setup
// Run this in the browser console to check if everything is working

console.log('🔍 TOS Scanner Extension Test');
console.log('================================');

// Test 1: Check if extension files are present
function testExtensionFiles() {
    console.log('Test 1: Extension Files');
    
    // Check if content script variables exist
    if (typeof tosScanner !== 'undefined') {
        console.log('✅ Content script loaded successfully');
        
        // Test scanning functionality
        const results = tosScanner.scanPage();
        console.log(`✅ Scanner found ${results.length} potential TOS/Privacy links`);
        
        results.forEach((link, index) => {
            console.log(`   ${index + 1}. ${link.type}: ${link.text} - ${link.url}`);
        });
        
        return true;
    } else {
        console.log('❌ Content script not loaded');
        return false;
    }
}

// Test 2: Check Chrome extension APIs
function testChromeAPIs() {
    console.log('\nTest 2: Chrome Extension APIs');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ Chrome extension APIs available');
        console.log(`   Extension ID: ${chrome.runtime.id}`);
        return true;
    } else {
        console.log('❌ Chrome extension APIs not available');
        return false;
    }
}

// Test 3: Check local storage functionality
function testLocalStorage() {
    console.log('\nTest 3: Local Storage');
    
    try {
        const testKey = 'tos_scanner_test';
        const testData = { test: true, timestamp: Date.now() };
        
        localStorage.setItem(testKey, JSON.stringify(testData));
        const retrieved = JSON.parse(localStorage.getItem(testKey));
        localStorage.removeItem(testKey);
        
        if (retrieved && retrieved.test === true) {
            console.log('✅ Local storage working correctly');
            return true;
        } else {
            console.log('❌ Local storage test failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Local storage error:', error.message);
        return false;
    }
}

// Test 4: Check page content for TOS links
function testPageAnalysis() {
    console.log('\nTest 4: Page Analysis');
    
    const tosKeywords = ['terms', 'privacy', 'policy', 'agreement'];
    const links = document.querySelectorAll('a[href]');
    let foundLinks = 0;
    
    links.forEach(link => {
        const text = link.textContent.toLowerCase();
        const href = link.href.toLowerCase();
        
        if (tosKeywords.some(keyword => text.includes(keyword) || href.includes(keyword))) {
            foundLinks++;
            console.log(`   Found potential link: ${link.textContent.trim()} - ${link.href}`);
        }
    });
    
    console.log(`✅ Manual analysis found ${foundLinks} potential links`);
    return foundLinks > 0;
}

// Test 5: Check network connectivity
async function testNetworkConnectivity() {
    console.log('\nTest 5: Network Connectivity');
    
    try {
        const response = await fetch('https://httpbin.org/get', { method: 'GET' });
        if (response.ok) {
            console.log('✅ Network requests working');
            return true;
        } else {
            console.log('❌ Network request failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Network error:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('Running TOS Scanner Extension Tests...\n');
    
    const results = {
        extensionFiles: testExtensionFiles(),
        chromeAPIs: testChromeAPIs(),
        localStorage: testLocalStorage(),
        pageAnalysis: testPageAnalysis(),
        networkConnectivity: await testNetworkConnectivity()
    };
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    let passedTests = 0;
    const totalTests = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
        if (passed) passedTests++;
    });
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Extension is ready to use.');
    } else {
        console.log('⚠️  Some tests failed. Check the extension setup.');
    }
    
    return results;
}

// Auto-run tests when script loads
runAllTests();

// Make functions available globally for manual testing
window.tosTestSuite = {
    runAllTests,
    testExtensionFiles,
    testChromeAPIs,
    testLocalStorage,
    testPageAnalysis,
    testNetworkConnectivity
};
