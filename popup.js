// Popup script - handles the extension popup UI and interactions

class TOSPopup {
    constructor() {
        this.djangoBackendUrl = 'http://localhost:8000/api'; // Update this to your Django backend URL
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.loadCurrentSite();
            this.checkBackendConnection();
            this.loadCachedResults();
        });
    }
    
    setupEventListeners() {
        const scanButton = document.getElementById('scan-button');
        if (scanButton) {
            scanButton.addEventListener('click', () => this.performScan());
        }
    }
    
    // Get current tab information
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }
    
    // Load and display current site information
    async loadCurrentSite() {
        try {
            const tab = await this.getCurrentTab();
            const siteUrlElement = document.getElementById('site-url');
            if (siteUrlElement && tab) {
                const url = new URL(tab.url);
                siteUrlElement.textContent = url.hostname;
            }
        } catch (error) {
            console.error('Error loading current site:', error);
        }
    }
    
    // Perform TOS scan on current page
    async performScan() {
        const scanButton = document.getElementById('scan-button');
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        
        try {
            // Show loading state
            scanButton.disabled = true;
            loading.style.display = 'block';
            results.innerHTML = '<div class="result-item">Scanning page...</div>';
            
            const tab = await this.getCurrentTab();
            
            // Send message to content script to scan the page
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });
            
            if (response && response.success) {
                await this.displayResults(response.results, response.pageInfo);
                
                // Send results to Django backend for analysis
                await this.sendToBackend(response.results, response.pageInfo);
            } else {
                throw new Error('Failed to scan page');
            }
        } catch (error) {
            console.error('Scan error:', error);
            results.innerHTML = `<div class="result-item warning">Error: ${error.message}</div>`;
        } finally {
            // Hide loading state
            scanButton.disabled = false;
            loading.style.display = 'none';
        }
    }
    
    // Display scan results in the popup
    async displayResults(scanResults, pageInfo) {
        const resultsContainer = document.getElementById('results');
        
        if (scanResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="result-item warning">
                    No Terms of Service or Privacy Policy links found on this page.
                </div>
            `;
            return;
        }
        
        let html = `<div class="result-item found">Found ${scanResults.length} relevant link(s):</div>`;
        
        scanResults.forEach(link => {
            const emoji = link.type === 'tos' ? '📄' : '🔒';
            const typeLabel = link.type === 'tos' ? 'Terms of Service' : 'Privacy Policy';
            
            html += `
                <div class="result-item found">
                    ${emoji} <strong>${typeLabel}</strong><br>
                    ${link.text}
                    <a href="${link.url}" target="_blank" class="link-item">
                        ${this.truncateUrl(link.url)}
                    </a>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        
        // Store results for future reference
        this.storeResults(pageInfo.domain, { scanResults, pageInfo, timestamp: Date.now() });
    }
    
    // Send scan results to Django backend for analysis
    async sendToBackend(scanResults, pageInfo) {
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
                timestamp: new Date().toISOString()
            };
            
            const response = await fetch(`${this.djangoBackendUrl}/scan-results/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('Results sent to backend successfully');
                this.updateBackendStatus('Connected ✅', 'found');
            } else {
                throw new Error(`Backend responded with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error sending to backend:', error);
            this.updateBackendStatus('Connection failed ❌', 'warning');
        }
    }
    
    // Check if Django backend is available
    async checkBackendConnection() {
        try {
            const response = await fetch(`${this.djangoBackendUrl}/health/`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                this.updateBackendStatus('Connected ✅', 'found');
            } else {
                throw new Error('Backend not responding');
            }
        } catch (error) {
            this.updateBackendStatus('Disconnected ❌', 'warning');
            console.log('Backend not available - results will be stored locally');
        }
    }
    
    // Update backend connection status in UI
    updateBackendStatus(message, type = '') {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = type;
        }
    }
    
    // Store results locally
    storeResults(domain, data) {
        chrome.storage.local.set({
            [`scan_${domain}`]: data
        });
    }
    
    // Load cached results if available
    async loadCachedResults() {
        try {
            const tab = await this.getCurrentTab();
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            const result = await chrome.storage.local.get([`scan_${domain}`]);
            const cachedData = result[`scan_${domain}`];
            
            if (cachedData && cachedData.scanResults) {
                // Check if cached data is recent (less than 1 hour old)
                const hourAgo = Date.now() - (60 * 60 * 1000);
                if (cachedData.timestamp > hourAgo) {
                    await this.displayResults(cachedData.scanResults, cachedData.pageInfo);
                }
            }
        } catch (error) {
            console.error('Error loading cached results:', error);
        }
    }
    
    // Utility function to truncate long URLs
    truncateUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }
    
    // Get analysis results from backend
    async getAnalysisResults(domain) {
        try {
            const response = await fetch(`${this.djangoBackendUrl}/analysis/${domain}/`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Error fetching analysis results:', error);
        }
        return null;
    }
}

// Initialize the popup when DOM is loaded
const tosPopup = new TOSPopup();
