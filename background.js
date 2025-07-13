// Background script - service worker for Chrome extension
// Handles background tasks, API calls, and coordinates between components

class TOSBackground {
    constructor() {
        this.djangoBackendUrl = 'http://192.168.3.180:8080/api'; // Update this to your Django backend URL
        this.init();
    }
    
    init() {
        // Listen for extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('TOS Scanner installed/updated');
            this.setupContextMenus();
            this.setupKeyboardShortcuts();
            this.setupSidePanel();
        });
        
        // Listen for tab updates to auto-scan
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab);
            }
        });
        
        // Listen for messages from content script and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
        
        // Note: chrome.action.onClicked will NOT fire when default_popup is set in manifest
        // We handle side panel opening through context menus and keyboard shortcuts instead
        chrome.action.onClicked.addListener((tab) => {
            console.log('Action clicked - this should not fire when popup is configured');
        });
    }
    
    // Set up context menus
    setupContextMenus() {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'scan-tos',
                title: 'Scan for TOS & Privacy Policy',
                contexts: ['page']
            });
            
            chrome.contextMenus.create({
                id: 'analyze-link',
                title: 'Analyze this link with TOS Scanner',
                contexts: ['link']
            });
            
            chrome.contextMenus.create({
                id: 'open-side-panel',
                title: '📋 Open TOS Scanner Side Panel',
                contexts: ['page', 'action']
            });
        });
        
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }
    
    // Handle tab updates for auto-scanning
    async handleTabUpdate(tabId, tab) {
        try {
            // Only scan if it's a web page (not chrome:// or extension pages)
            if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
                return;
            }
            
            // Wait a bit for the page to fully load
            setTimeout(async () => {
                try {
                    // Send scan message to content script
                    const response = await chrome.tabs.sendMessage(tabId, { action: 'scanPage' });
                    
                    if (response && response.success && response.results.length > 0) {
                        // Store scan results
                        const domain = new URL(tab.url).hostname;
                        await this.storeResults(domain, {
                            scanResults: response.results,
                            pageInfo: response.pageInfo,
                            timestamp: Date.now()
                        });
                        
                        // Show badge with number of found links
                        chrome.action.setBadgeText({
                            tabId: tabId,
                            text: response.results.length.toString()
                        });
                        
                        chrome.action.setBadgeBackgroundColor({
                            color: '#4CAF50'
                        });
                    } else {
                        // Clear badge if no results
                        chrome.action.setBadgeText({
                            tabId: tabId,
                            text: ''
                        });
                    }
                } catch (error) {
                    console.log('Auto-scan failed (content script may not be ready):', error.message);
                }
            }, 3000);
        } catch (error) {
            console.error('Error in handleTabUpdate:', error);
        }
    }
    
    // Handle context menu clicks
    async handleContextMenuClick(info, tab) {
        if (info.menuItemId === 'scan-tos') {
            // Trigger manual scan
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });
                if (response && response.success) {
                    console.log(`Found ${response.results.length} TOS/Privacy links`);
                }
            } catch (error) {
                console.error('Manual scan failed:', error);
            }
        } else if (info.menuItemId === 'analyze-link') {
            // Note: Analysis functionality removed - only scanning available
            console.log('Link analysis not currently available');
        } else if (info.menuItemId === 'open-side-panel') {
            // Open side panel
            this.openSidePanel(tab);
        }
    }
    
    // Open side panel with robust error handling
    async openSidePanel(tab) {
        if (!tab || !tab.id) {
            console.error('❌ Invalid tab provided to openSidePanel');
            return false;
        }
        
        try {
            // Method 1: Try opening for specific tab
            await chrome.sidePanel.open({ tabId: tab.id });
            console.log('✅ Side panel opened for tab:', tab.id);
            return true;
        } catch (tabError) {
            console.log('⚠️ Failed to open side panel for tab, trying window:', tabError.message);
            
            try {
                // Method 2: Try opening for window
                await chrome.sidePanel.open({ windowId: tab.windowId });
                console.log('✅ Side panel opened for window:', tab.windowId);
                return true;
            } catch (windowError) {
                console.error('❌ Failed to open side panel for window:', windowError.message);
                
                // Method 3: Check if side panel is available and enabled
                try {
                    const options = await chrome.sidePanel.getOptions({ tabId: tab.id });
                    console.log('Side panel options:', options);
                    
                    if (!options.enabled) {
                        console.log('Side panel is disabled for this tab');
                    }
                } catch (optionsError) {
                    console.error('Failed to get side panel options:', optionsError.message);
                }
                
                // Method 4: Last resort - show user-friendly message
                this.showSidePanelFallback(tab);
                return false;
            }
        }
    }
    
    // Fallback method when side panel fails to open
    async showSidePanelFallback(tab) {
        try {
            // Try to show a notification or badge to guide the user
            await chrome.action.setBadgeText({
                tabId: tab.id,
                text: '📋'
            });
            
            await chrome.action.setBadgeBackgroundColor({
                color: '#4CAF50'
            });
            
            await chrome.action.setTitle({
                tabId: tab.id,
                title: 'Click to open TOS Scanner side panel'
            });
            
            console.log('💡 Fallback: Set badge and title to guide user');
            
            // Clear the badge after a few seconds
            setTimeout(() => {
                chrome.action.setBadgeText({ tabId: tab.id, text: '' });
            }, 5000);
            
        } catch (error) {
            console.error('Even fallback method failed:', error);
        }
    }
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    }
    
    // Handle keyboard commands
    async handleCommand(command) {
        if (command === 'open-side-panel') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                this.openSidePanel(tab);
            }
        }
    }
    
    // Setup side panel behavior
    async setupSidePanel() {
        try {
            // Check if side panel API is available
            if (!chrome.sidePanel) {
                throw new Error('Side panel API not available (requires Chrome 114+)');
            }
            
            // Note: We don't set openPanelOnActionClick to true because we have a popup configured
            // Users can access the side panel via:
            // 1. Right-click context menu -> "📋 Open TOS Scanner Side Panel"
            // 2. Keyboard shortcut: Ctrl+Shift+S (Cmd+Shift+S on Mac)
            // 3. From within the popup -> "📋 Open Side Panel" button
            
            console.log('✅ Side panel available via multiple access methods:');
            console.log('  1. Right-click menu');
            console.log('  2. Keyboard shortcut (Ctrl+Shift+S)');
            console.log('  3. Button in popup');
            
            // Ensure the side panel is enabled globally
            await chrome.sidePanel.setOptions({
                enabled: true
            });
            
            // Test if we can get options (this will throw if there are permission issues)
            const options = await chrome.sidePanel.getOptions({});
            console.log('Side panel options:', options);
            
        } catch (error) {
            console.error('❌ Failed to configure side panel:', error);
            
            if (error.message.includes('Chrome 114')) {
                console.log('💡 Solution: Update Chrome to version 114 or later');
            } else if (error.message.includes('permission')) {
                console.log('💡 Solution: Check that "sidePanel" permission is in manifest.json');
            } else {
                console.log('💡 Side panel features will be limited, but extension will still work');
            }
        }
    }
    
    // Handle messages from content script and popup
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getStoredResults':
                    const results = await this.getStoredResults(request.domain);
                    sendResponse({ success: true, results: results });
                    break;
                    
                case 'clearResults':
                    await this.clearStoredResults(request.domain);
                    sendResponse({ success: true });
                    break;
                    
                case 'checkBackendHealth':
                    const health = await this.checkBackendHealth();
                    sendResponse({ success: true, healthy: health });
                    break;
                
                case 'openSidePanel':
                    const tab = { 
                        id: request.tabId, 
                        windowId: request.windowId 
                    };
                    const opened = await this.openSidePanel(tab);
                    sendResponse({ success: opened });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    // Check backend health
    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.djangoBackendUrl}/health/`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            return response.ok;
        } catch (error) {
            console.log('Backend health check failed:', error);
            return false;
        }
    }
    
    // Store results in local storage
    async storeResults(domain, data) {
        try {
            await chrome.storage.local.set({
                [`scan_${domain}`]: data
            });
        } catch (error) {
            console.error('Error storing results:', error);
        }
    }
    
    // Get stored results
    async getStoredResults(domain) {
        try {
            const result = await chrome.storage.local.get([`scan_${domain}`]);
            return result[`scan_${domain}`] || null;
        } catch (error) {
            console.error('Error getting stored results:', error);
            return null;
        }
    }
    
    // Clear stored results
    async clearStoredResults(domain) {
        try {
            await chrome.storage.local.remove([`scan_${domain}`]);
        } catch (error) {
            console.error('Error clearing stored results:', error);
        }
    }
}

// Initialize the background script
const tosBackground = new TOSBackground();

console.log('TOS Scanner background script loaded');
