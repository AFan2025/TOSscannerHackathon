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
