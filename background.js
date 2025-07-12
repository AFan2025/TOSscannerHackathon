// Background script - service worker for Chrome extension
// Handles background tasks, API calls, and coordinates between components

class TOSBackground {
    constructor() {
        this.djangoBackendUrl = 'http://localhost:8000/api'; // Update this to your Django backend URL
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
                        
                        // Send to backend for analysis
                        await this.sendToBackendForAnalysis(response.results, response.pageInfo);
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
            // Analyze specific link
            try {
                await this.analyzeSpecificLink(info.linkUrl, tab);
            } catch (error) {
                console.error('Link analysis failed:', error);
            }
        }
    }
    
    // Handle messages from content script and popup
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'sendToBackend':
                    const backendResponse = await this.sendToBackendForAnalysis(request.data.results, request.data.pageInfo);
                    sendResponse({ success: true, response: backendResponse });
                    break;
                    
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
    
    // Send results to Django backend for analysis
    async sendToBackendForAnalysis(scanResults, pageInfo) {
        try {
            const payload = {
                domain: pageInfo.domain,
                url: pageInfo.url,
                title: pageInfo.title,
                links: scanResults.map(link => ({
                    type: link.type,
                    text: link.text,
                    url: link.url
                })),
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent
            };
            
            const response = await fetch(`${this.djangoBackendUrl}/scan-results/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Successfully sent to backend:', result);
                return result;
            } else {
                throw new Error(`Backend responded with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error sending to backend:', error);
            throw error;
        }
    }
    
    // Analyze a specific link
    async analyzeSpecificLink(linkUrl, tab) {
        try {
            const payload = {
                url: linkUrl,
                referrer: tab.url,
                timestamp: new Date().toISOString()
            };
            
            const response = await fetch(`${this.djangoBackendUrl}/analyze-link/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Link analysis result:', result);
                
                // Show notification with analysis result
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/icon-48.png',
                    title: 'TOS Scanner Analysis',
                    message: `Analysis complete for ${new URL(linkUrl).hostname}`
                });
                
                return result;
            }
        } catch (error) {
            console.error('Error analyzing link:', error);
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
    
    // Batch send multiple scan results to backend
    async batchSendToBackend() {
        try {
            const allData = await chrome.storage.local.get(null);
            const scanData = Object.entries(allData)
                .filter(([key, value]) => key.startsWith('scan_'))
                .map(([key, value]) => value);
            
            if (scanData.length > 0) {
                const response = await fetch(`${this.djangoBackendUrl}/batch-scan-results/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ scans: scanData })
                });
                
                if (response.ok) {
                    console.log('Batch data sent successfully');
                }
            }
        } catch (error) {
            console.error('Error in batch send:', error);
        }
    }
}

// Initialize the background script
const tosBackground = new TOSBackground();

// Set up periodic batch sending (every 30 minutes)
chrome.alarms.create('batchSend', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'batchSend') {
        tosBackground.batchSendToBackend();
    }
});

console.log('TOS Scanner background script loaded');
