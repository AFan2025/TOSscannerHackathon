// Side panel script - provides extended functionality and analytics

class TOSSidePanel {
    constructor() {
        this.djangoBackendUrl = 'http://localhost:8000/api';
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.loadStatistics();
            this.loadScanHistory();
            this.loadRecentAnalysis();
        });
    }
    
    setupEventListeners() {
        document.getElementById('scan-current')?.addEventListener('click', () => this.scanCurrentPage());
        document.getElementById('export-data')?.addEventListener('click', () => this.exportData());
        document.getElementById('clear-history')?.addEventListener('click', () => this.clearHistory());
        document.getElementById('configure-backend')?.addEventListener('click', () => this.configureBackend());
        document.getElementById('view-logs')?.addEventListener('click', () => this.viewLogs());
    }
    
    // Load and display statistics
    async loadStatistics() {
        try {
            const allData = await chrome.storage.local.get(null);
            const scanData = Object.entries(allData)
                .filter(([key, value]) => key.startsWith('scan_'))
                .map(([key, value]) => value);
            
            const totalScans = scanData.length;
            const totalLinks = scanData.reduce((sum, scan) => sum + (scan.scanResults?.length || 0), 0);
            
            // Update statistics display
            document.getElementById('total-scans').textContent = totalScans;
            document.getElementById('total-links').textContent = totalLinks;
            
            // Get analysis data from backend if available
            await this.loadBackendStatistics();
            
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }
    
    // Load statistics from backend
    async loadBackendStatistics() {
        try {
            const response = await fetch(`${this.djangoBackendUrl}/statistics/`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const stats = await response.json();
                document.getElementById('high-risk').textContent = stats.high_risk_count || 0;
                document.getElementById('analyzed').textContent = stats.analyzed_count || 0;
            }
        } catch (error) {
            console.log('Backend statistics not available');
        }
    }
    
    // Load and display scan history
    async loadScanHistory() {
        try {
            const allData = await chrome.storage.local.get(null);
            const scanData = Object.entries(allData)
                .filter(([key, value]) => key.startsWith('scan_'))
                .map(([key, value]) => ({ key, ...value }))
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10); // Show only last 10
            
            const historyContainer = document.getElementById('scan-history');
            
            if (scanData.length === 0) {
                historyContainer.innerHTML = `
                    <div class="history-item">
                        <div class="domain">No scans yet</div>
                        <div class="timestamp">Visit websites to start scanning</div>
                    </div>
                `;
                return;
            }
            
            let html = '';
            scanData.forEach(scan => {
                const domain = scan.pageInfo?.domain || 'Unknown';
                const linkCount = scan.scanResults?.length || 0;
                const timestamp = new Date(scan.timestamp).toLocaleString();
                
                html += `
                    <div class="history-item">
                        <div class="domain">${domain} (${linkCount} links)</div>
                        <div class="timestamp">${timestamp}</div>
                    </div>
                `;
            });
            
            historyContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading scan history:', error);
        }
    }
    
    // Load recent analysis from backend
    async loadRecentAnalysis() {
        try {
            const response = await fetch(`${this.djangoBackendUrl}/recent-analysis/`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const analysis = await response.json();
                this.displayRecentAnalysis(analysis);
            } else {
                throw new Error('No analysis data available');
            }
        } catch (error) {
            console.log('Recent analysis not available from backend');
            document.getElementById('recent-analysis').innerHTML = `
                <p>Connect to Django backend to see detailed analysis results.</p>
            `;
        }
    }
    
    // Display recent analysis data
    displayRecentAnalysis(analysisData) {
        const container = document.getElementById('recent-analysis');
        
        if (!analysisData || analysisData.length === 0) {
            container.innerHTML = '<p>No recent analysis available.</p>';
            return;
        }
        
        let html = '';
        analysisData.slice(0, 3).forEach(analysis => {
            const riskClass = this.getRiskClass(analysis.risk_level);
            html += `
                <div style="margin-bottom: 15px;">
                    <div><strong>${analysis.domain}</strong></div>
                    <div class="risk-indicator ${riskClass}">${analysis.risk_level}</div>
                    <div style="font-size: 12px; margin-top: 5px;">
                        ${analysis.summary || 'Analysis complete'}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // Get CSS class for risk level
    getRiskClass(riskLevel) {
        switch (riskLevel?.toLowerCase()) {
            case 'high': return 'risk-high';
            case 'medium': return 'risk-medium';
            case 'low': return 'risk-low';
            default: return 'risk-medium';
        }
    }
    
    // Scan current page
    async scanCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });
            
            if (response && response.success) {
                // Refresh displays
                await this.loadStatistics();
                await this.loadScanHistory();
                
                // Show success message
                this.showNotification(`Found ${response.results.length} TOS/Privacy links on ${new URL(tab.url).hostname}`);
            }
        } catch (error) {
            console.error('Error scanning current page:', error);
            this.showNotification('Error scanning page', 'error');
        }
    }
    
    // Export scan data
    async exportData() {
        try {
            const allData = await chrome.storage.local.get(null);
            const scanData = Object.entries(allData)
                .filter(([key, value]) => key.startsWith('scan_'))
                .map(([key, value]) => value);
            
            const exportData = {
                exportDate: new Date().toISOString(),
                totalScans: scanData.length,
                scans: scanData
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `tos-scanner-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Data exported successfully');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error exporting data', 'error');
        }
    }
    
    // Clear scan history
    async clearHistory() {
        if (confirm('Are you sure you want to clear all scan history?')) {
            try {
                const allData = await chrome.storage.local.get(null);
                const scanKeys = Object.keys(allData).filter(key => key.startsWith('scan_'));
                
                await chrome.storage.local.remove(scanKeys);
                
                // Refresh displays
                await this.loadStatistics();
                await this.loadScanHistory();
                
                this.showNotification('History cleared successfully');
            } catch (error) {
                console.error('Error clearing history:', error);
                this.showNotification('Error clearing history', 'error');
            }
        }
    }
    
    // Configure backend settings
    configureBackend() {
        const newUrl = prompt('Enter Django backend URL:', this.djangoBackendUrl);
        if (newUrl && newUrl !== this.djangoBackendUrl) {
            this.djangoBackendUrl = newUrl;
            chrome.storage.local.set({ backendUrl: newUrl });
            this.showNotification('Backend URL updated');
        }
    }
    
    // View logs (placeholder for future implementation)
    viewLogs() {
        // This could open a new tab with detailed logs
        // or show a modal with recent log entries
        alert('Logs feature coming soon!');
    }
    
    // Show notification message
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            background: ${type === 'error' ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.9)'};
            color: white;
            border-radius: 5px;
            z-index: 1000;
            font-size: 14px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
}

// Initialize the side panel
const tosSidePanel = new TOSSidePanel();
