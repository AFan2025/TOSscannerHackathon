// Background script - service worker for Chrome extension
// Handles background tasks, API calls, and coordinates between components

class TOSBackground {
    constructor() {
        this.djangoBackendUrl = 'http://localhost:8000/api/analyze'; // Django backend analyze endpoint
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
                        
                        // Analyze found TOS/Privacy links
                        await this.analyzeFoundLinks(response.results, response.pageInfo);
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
                    if (response.results.length > 0) {
                        await this.analyzeFoundLinks(response.results, response.pageInfo);
                    }
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
                case 'analyzeToS':
                    const analysisResponse = await this.analyzeToSContent(request.data.tosText);
                    sendResponse({ success: true, response: analysisResponse });
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
    
    // Analyze found TOS/Privacy links by fetching their content
    async analyzeFoundLinks(scanResults, pageInfo) {
        for (const link of scanResults) {
            try {
                // Fetch the TOS content
                const tosContent = await this.fetchToSContent(link.url);
                if (tosContent) {
                    // Send to backend for analysis
                    const analysis = await this.analyzeToSContent(tosContent);
                    
                    // Store analysis result
                    await this.storeAnalysisResult(pageInfo.domain, link, analysis);
                }
            } catch (error) {
                console.error(`Error analyzing ${link.url}:`, error);
            }
        }
    }
    
    // Fetch TOS content from a URL
    async fetchToSContent(url) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const html = await response.text();
                
                // Create a temporary DOM to extract text content
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Remove script and style elements
                const scripts = doc.querySelectorAll('script, style');
                scripts.forEach(el => el.remove());
                
                // Get text content
                const textContent = doc.body.textContent || doc.body.innerText || '';
                
                // Limit content length (backend might have limits)
                return textContent.substring(0, 50000); // First 50k characters
            }
        } catch (error) {
            console.error('Error fetching TOS content:', error);
        }
        return null;
    }
    
    // Send TOS content to Django backend for analysis
    async analyzeToSContent(tosText) {
        try {
            const payload = {
                tos_text: tosText
            };
            
            const response = await fetch(this.djangoBackendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Successfully analyzed with backend:', result);
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
            const tosContent = await this.fetchToSContent(linkUrl);
            if (tosContent) {
                const analysis = await this.analyzeToSContent(tosContent);
                
                // Show notification with analysis result
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/icon-16.svg',
                    title: 'TOS Scanner Analysis',
                    message: `Analysis complete for ${new URL(linkUrl).hostname}`
                });
                
                return analysis;
            }
        } catch (error) {
            console.error('Error analyzing link:', error);
        }
    }
    
    // Check backend health (simple ping to analyze endpoint)
    async checkBackendHealth() {
        try {
            // Send a minimal request to check if backend is responsive
            const response = await fetch(this.djangoBackendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tos_text: 'health check' })
            });
            
            return response.status === 200 || response.status === 400; // 400 is ok, means backend is responding
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
    
    // Store analysis results
    async storeAnalysisResult(domain, link, analysis) {
        try {
            const key = `analysis_${domain}_${Date.now()}`;
            await chrome.storage.local.set({
                [key]: {
                    link: link,
                    analysis: analysis,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.error('Error storing analysis result:', error);
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
    
    // Get stored analysis results
    async getStoredAnalysis(domain) {
        try {
            const allData = await chrome.storage.local.get(null);
            const analysisResults = Object.entries(allData)
                .filter(([key, value]) => key.startsWith(`analysis_${domain}_`))
                .map(([key, value]) => value);
            
            return analysisResults;
        } catch (error) {
            console.error('Error getting stored analysis:', error);
            return [];
        }
    }
    
    // Clear stored results
    async clearStoredResults(domain) {
        try {
            await chrome.storage.local.remove([`scan_${domain}`]);
            
            // Also clear analysis results for this domain
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(allData)
                .filter(key => key.startsWith(`analysis_${domain}_`));
            
            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
            }
        } catch (error) {
            console.error('Error clearing stored results:', error);
        }
    }
}

// Initialize the background script
const tosBackground = new TOSBackground();

console.log('TOS Scanner background script loaded');
