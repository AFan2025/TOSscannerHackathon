// Popup script - handles the extension popup UI and interactions

class TOSPopup {
    constructor() {
        this.djangoBackendUrl = 'http://192.168.3.180:8080/api/analyze/'; 
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.loadCurrentSite();
            // this.checkBackendConnection();
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
        
        let html = `
            <div class="result-item found">
                Found ${scanResults.length} relevant link(s):
                <div class="selection-controls">
                    <button id="select-all-btn" class="control-btn">Select All</button>
                    <button id="analyze-selected-btn" class="control-btn" disabled>Analyze Selected</button>
                </div>
            </div>
        `;
        
        scanResults.forEach((link, index) => {
            const emoji = link.type === 'tos' ? '📄' : '🔒';
            const typeLabel = link.type === 'tos' ? 'Terms of Service' : 'Privacy Policy';
            
            html += `
                <div class="result-item found selectable-item" data-index="${index}">
                    <label class="link-checkbox-container">
                        <input type="checkbox" class="link-checkbox" data-url="${link.url}" data-text="${link.text}" data-type="${link.type}">
                        <span class="checkmark"></span>
                        <div class="link-content">
                            ${emoji} <strong>${typeLabel}</strong><br>
                            <span class="link-text">${link.text}</span>
                            <a href="${link.url}" target="_blank" class="link-item" onclick="event.stopPropagation();">
                                ${this.truncateUrl(link.url)}
                            </a>
                        </div>
                    </label>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        
        // Set up event listeners for the new elements
        this.setupSelectionEventListeners();
        
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
            
            // const response = await fetch(`${this.djangoBackendUrl}/scan-results/`, {
            const response = await fetch(`${this.djangoBackendUrl}/`, {
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
    // async checkBackendConnection() {
    //     try {
    //         const response = await fetch(`${this.djangoBackendUrl}/health/`, {
    //             method: 'GET',
    //             headers: { 'Content-Type': 'application/json' }
    //         });
            
    //         if (response.ok) {
    //             this.updateBackendStatus('Connected ✅', 'found');
    //         } else {
    //             throw new Error('Backend not responding');
    //         }
    //     } catch (error) {
    //         this.updateBackendStatus('Disconnected ❌', 'warning');
    //         console.log('Backend not available - results will be stored locally');
    //     }
    // }
    
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
            // const response = await fetch(`${this.djangoBackendUrl}/analysis/${domain}/`, {
            const response = await fetch(`${this.djangoBackendUrl}/`, {
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
    
    // Set up event listeners for selection controls
    setupSelectionEventListeners() {
        const selectAllBtn = document.getElementById('select-all-btn');
        const analyzeSelectedBtn = document.getElementById('analyze-selected-btn');
        const checkboxes = document.querySelectorAll('.link-checkbox');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
                selectAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
                this.updateAnalyzeButton();
            });
        }
        
        if (analyzeSelectedBtn) {
            analyzeSelectedBtn.addEventListener('click', () => {
                this.analyzeSelectedLinks();
            });
        }
        
        // Add event listeners to checkboxes
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateAnalyzeButton();
                this.updateSelectAllButton();
            });
        });
        
        // Make the entire item clickable (except for the link)
        const selectableItems = document.querySelectorAll('.selectable-item');
        selectableItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'A') {
                    const checkbox = item.querySelector('.link-checkbox');
                    checkbox.checked = !checkbox.checked;
                    this.updateAnalyzeButton();
                    this.updateSelectAllButton();
                }
            });
        });
    }
    
    // Update the analyze button state based on selected checkboxes
    updateAnalyzeButton() {
        const analyzeBtn = document.getElementById('analyze-selected-btn');
        const selectedCheckboxes = document.querySelectorAll('.link-checkbox:checked');
        
        if (analyzeBtn) {
            analyzeBtn.disabled = selectedCheckboxes.length === 0;
            analyzeBtn.textContent = selectedCheckboxes.length === 0 
                ? 'Analyze Selected' 
                : `Analyze ${selectedCheckboxes.length} Selected`;
        }
    }
    
    // Update the select all button text
    updateSelectAllButton() {
        const selectAllBtn = document.getElementById('select-all-btn');
        const checkboxes = document.querySelectorAll('.link-checkbox');
        const checkedBoxes = document.querySelectorAll('.link-checkbox:checked');
        
        if (selectAllBtn) {
            if (checkedBoxes.length === 0) {
                selectAllBtn.textContent = 'Select All';
            } else if (checkedBoxes.length === checkboxes.length) {
                selectAllBtn.textContent = 'Deselect All';
            } else {
                selectAllBtn.textContent = 'Select All';
            }
        }
    }
    
    // Analyze selected links
    async analyzeSelectedLinks() {
        const selectedCheckboxes = document.querySelectorAll('.link-checkbox:checked');
        const analyzeBtn = document.getElementById('analyze-selected-btn');
        const results = document.getElementById('results');
        
        if (selectedCheckboxes.length === 0) {
            return;
        }
        
        // Show loading state
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        
        try {
            // Show analysis progress
            const progressDiv = document.createElement('div');
            progressDiv.className = 'result-item found';
            progressDiv.innerHTML = `
                <div class="analysis-progress">
                    <div class="spinner"></div>
                    <span>Analyzing ${selectedCheckboxes.length} selected link(s)...</span>
                </div>
            `;
            results.appendChild(progressDiv);
            
            const analysisResults = [];
            
            // Analyze each selected link
            for (let i = 0; i < selectedCheckboxes.length; i++) {
                const checkbox = selectedCheckboxes[i];
                const linkUrl = checkbox.dataset.url;
                const linkText = checkbox.dataset.text;
                const linkType = checkbox.dataset.type;
                
                progressDiv.innerHTML = `
                    <div class="analysis-progress">
                        <div class="spinner"></div>
                        <span>Analyzing ${i + 1} of ${selectedCheckboxes.length}: ${linkText}</span>
                    </div>
                `;
                
                try {
                    // Fetch and analyze the TOS content
                    const tosContent = await this.fetchToSContent(linkUrl);
                    if (tosContent) {
                        const analysis = await this.analyzeToSContent(tosContent);
                        analysisResults.push({
                            url: linkUrl,
                            text: linkText,
                            type: linkType,
                            analysis: analysis
                        });
                    }
                } catch (error) {
                    console.error(`Error analyzing ${linkUrl}:`, error);
                    analysisResults.push({
                        url: linkUrl,
                        text: linkText,
                        type: linkType,
                        error: error.message
                    });
                }
            }
            
            // Remove progress indicator
            progressDiv.remove();
            
            // Display analysis results
            this.displayAnalysisResults(analysisResults);
            
        } catch (error) {
            console.error('Error in analysis:', error);
            results.innerHTML += `<div class="result-item warning">Analysis failed: ${error.message}</div>`;
        } finally {
            // Reset button state
            analyzeBtn.disabled = false;
            this.updateAnalyzeButton();
        }
    }
    
    // Fetch TOS content from URL
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
    
    // Send TOS content to backend for analysis
    async analyzeToSContent(tosText) {
        try {
            const payload = {
                tos_text: tosText
            };
            
            const response = await fetch(`${this.djangoBackendUrl}/analyze`, {
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
    
    // Display analysis results
    displayAnalysisResults(analysisResults) {
        const results = document.getElementById('results');
        
        let analysisHtml = '<div class="result-item found"><strong>📊 Analysis Results:</strong></div>';
        
        analysisResults.forEach((result, index) => {
            const emoji = result.type === 'tos' ? '📄' : '🔒';
            
            if (result.error) {
                analysisHtml += `
                    <div class="result-item warning">
                        ${emoji} <strong>Error analyzing:</strong> ${result.text}<br>
                        <small>${result.error}</small>
                    </div>
                `;
            } else if (result.analysis) {
                analysisHtml += `
                    <div class="result-item found analysis-result">
                        <div class="analysis-header">
                            ${emoji} <strong>${result.text}</strong>
                            <button class="toggle-analysis" data-index="${index}">Show Details</button>
                        </div>
                        <div class="analysis-content" style="display: none;">
                            ${this.formatAnalysisResult(result.analysis)}
                        </div>
                    </div>
                `;
            }
        });
        
        results.innerHTML += analysisHtml;
        
        // Set up toggle buttons for analysis details
        this.setupAnalysisToggle();
    }
    
    // Format analysis result for display
    formatAnalysisResult(analysis) {
        let html = '';
        
        if (analysis.summary) {
            html += `<div class="analysis-section"><strong>Summary:</strong><br>${analysis.summary}</div>`;
        }
        
        if (analysis.key_clauses && Array.isArray(analysis.key_clauses)) {
            html += '<div class="analysis-section"><strong>Key Clauses:</strong><ul>';
            analysis.key_clauses.forEach(clause => {
                html += `<li><strong>${clause.title}:</strong> ${clause.details}</li>`;
            });
            html += '</ul></div>';
        }
        
        return html;
    }
    
    // Set up toggle functionality for analysis results
    setupAnalysisToggle() {
        const toggleButtons = document.querySelectorAll('.toggle-analysis');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const analysisContent = button.closest('.analysis-result').querySelector('.analysis-content');
                const isVisible = analysisContent.style.display !== 'none';
                
                analysisContent.style.display = isVisible ? 'none' : 'block';
                button.textContent = isVisible ? 'Show Details' : 'Hide Details';
            });
        });
    }
}

// Initialize the popup when DOM is loaded
const tosPopup = new TOSPopup();
