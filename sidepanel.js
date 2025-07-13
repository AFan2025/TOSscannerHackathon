// Side panel script - handles the extension side panel UI and interactions

class TOSSidePanel {
    constructor() {
        this.djangoBackendUrl = 'http://192.168.3.180:8080/api'; 
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
    
    // Display scan results in the side panel
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
                        <input type="checkbox" class="link-checkbox" data-url="${link.url}" data-text="${link.text}" data-type="${link.type}" data-index="${index}">
                        <span class="checkmark"></span>
                        <div class="link-content">
                            ${emoji} <strong>${typeLabel}</strong><br>
                            <span class="link-text">${link.text}</span>
                            <a href="${link.url}" target="_blank" class="link-item" onclick="event.stopPropagation();">
                                ${this.truncateUrl(link.url)}
                            </a>
                        </div>
                    </label>
                    <div class="analysis-result-container" id="analysis-result-${index}" style="display: none;">
                        <!-- Analysis results will be displayed here -->
                    </div>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        
        // Set up event listeners for the new elements
        this.setupSelectionEventListeners();
        
        // Store results for future reference
        this.storeResults(pageInfo.domain, { scanResults, pageInfo, timestamp: Date.now() });
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
    
    // Store analysis results for specific links
    storeAnalysisResults(domain, linkIndex, analysisData) {
        chrome.storage.local.get([`scan_${domain}`], (result) => {
            const cachedData = result[`scan_${domain}`] || {};
            
            // Initialize analysis results if not exists
            if (!cachedData.analysisResults) {
                cachedData.analysisResults = {};
            }
            
            // Store the analysis result for this specific link
            cachedData.analysisResults[linkIndex] = {
                ...analysisData,
                timestamp: Date.now()
            };
            
            // Update the cached data
            chrome.storage.local.set({
                [`scan_${domain}`]: cachedData
            });
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
                    
                    // Restore analysis results if they exist (with small delay to ensure UI is ready)
                    if (cachedData.analysisResults) {
                        console.log(`📁 Found cached analysis results for ${Object.keys(cachedData.analysisResults).length} links`);
                        setTimeout(() => {
                            this.restoreAnalysisResults(cachedData.analysisResults);
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading cached results:', error);
        }
    }
    
    // Restore analysis results for previously analyzed links
    async restoreAnalysisResults(analysisResults) {
        console.log('🔄 Restoring analysis results from cache:', analysisResults);
        
        for (const [linkIndex, analysisData] of Object.entries(analysisResults)) {
            // Check if analysis result is recent (less than 1 hour old)
            const hourAgo = Date.now() - (60 * 60 * 1000);
            if (analysisData.timestamp > hourAgo) {
                console.log(`✅ Restoring analysis for link ${linkIndex}`);
                
                // Display the cached analysis result
                this.displayIndividualAnalysisResult({
                    url: analysisData.url,
                    text: analysisData.text,
                    type: analysisData.type,
                    index: linkIndex,
                    analysis: analysisData.analysis,
                    error: analysisData.error,
                    fromCache: true
                });
                
                // Check the corresponding checkbox if it was previously analyzed
                const checkbox = document.querySelector(`.link-checkbox[data-index="${linkIndex}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
        }
        
        // Update the analyze button and select all button states
        this.updateAnalyzeButton();
        this.updateSelectAllButton();
    }
    
    // Clear cached analysis results for current domain
    async clearCachedAnalysisResults() {
        try {
            const tab = await this.getCurrentTab();
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            const result = await chrome.storage.local.get([`scan_${domain}`]);
            const cachedData = result[`scan_${domain}`];
            
            if (cachedData) {
                // Remove analysis results but keep scan results
                delete cachedData.analysisResults;
                
                chrome.storage.local.set({
                    [`scan_${domain}`]: cachedData
                });
                
                console.log(`🗑️ Cleared cached analysis results for domain: ${domain}`);
            }
        } catch (error) {
            console.error('Error clearing cached analysis results:', error);
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
            const response = await fetch(`${this.djangoBackendUrl}/analyze/`, {
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
        
        console.log(`🎯 Starting analysis of ${selectedCheckboxes.length} selected links`);
        
        if (selectedCheckboxes.length === 0) {
            console.log('⚠️ No links selected for analysis');
            return;
        }
        
        // Log selected links
        selectedCheckboxes.forEach((checkbox, index) => {
            console.log(`📝 Selected link ${index + 1}:`, {
                url: checkbox.dataset.url,
                text: checkbox.dataset.text,
                type: checkbox.dataset.type
            });
        });
        
        // Show loading state
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        
        try {
            // Show main progress indicator near the top (after selection controls)
            const selectionControls = document.querySelector('.selection-controls');
            const mainProgressDiv = document.createElement('div');
            mainProgressDiv.className = 'result-item found main-progress';
            mainProgressDiv.innerHTML = `
                <div class="analysis-progress">
                    <div class="spinner"></div>
                    <span>Starting analysis of ${selectedCheckboxes.length} selected link(s)...</span>
                </div>
            `;
            
            // Insert after selection controls
            if (selectionControls && selectionControls.parentElement) {
                selectionControls.parentElement.insertAdjacentElement('afterend', mainProgressDiv);
            } else {
                results.insertBefore(mainProgressDiv, results.firstChild);
            }
            
            // Analyze each selected link and display results immediately
            for (let i = 0; i < selectedCheckboxes.length; i++) {
                const checkbox = selectedCheckboxes[i];
                const linkUrl = checkbox.dataset.url;
                const linkText = checkbox.dataset.text;
                const linkType = checkbox.dataset.type;
                const linkIndex = checkbox.dataset.index;
                
                console.log(`🔄 Processing link ${i + 1}/${selectedCheckboxes.length}:`, linkUrl);
                
                // Update main progress
                mainProgressDiv.innerHTML = `
                    <div class="analysis-progress">
                        <div class="spinner"></div>
                        <span>Analyzing ${i + 1} of ${selectedCheckboxes.length}: ${linkText}</span>
                    </div>
                `;
                
                // Show individual progress
                this.showIndividualProgress(linkIndex, linkText);
                
                try {
                    console.log(`📥 Fetching content for: ${linkText}`);
                    // Fetch and analyze the TOS content
                    const fetchResult = await this.fetchToSContent(linkUrl);
                    
                    if (fetchResult && fetchResult.success) {
                        if (fetchResult.fromScrapeAndAnalyze) {
                            // Result already includes analysis from scrape-and-analyze endpoint
                            console.log(`🎉 Analysis completed via scrape-and-analyze for: ${linkText}`);
                            this.displayIndividualAnalysisResult({
                                url: linkUrl,
                                text: linkText,
                                type: linkType,
                                index: linkIndex,
                                analysis: fetchResult.analysis
                            });
                        } else {
                            // Regular fetch succeeded, need to analyze separately
                            console.log(`✅ Content fetched successfully, analyzing with backend...`);
                            const analysis = await this.analyzeToSContent(fetchResult.content);
                            console.log(`🎉 Analysis completed for: ${linkText}`);
                            this.displayIndividualAnalysisResult({
                                url: linkUrl,
                                text: linkText,
                                type: linkType,
                                index: linkIndex,
                                analysis: analysis
                            });
                        }
                    } else {
                        console.log(`❌ Failed to fetch content for: ${linkUrl}`);
                        this.displayIndividualAnalysisResult({
                            url: linkUrl,
                            text: linkText,
                            type: linkType,
                            index: linkIndex,
                            error: fetchResult?.error || 'Failed to fetch content'
                        });
                    }
                } catch (error) {
                    console.error(`💥 Error analyzing ${linkUrl}:`, error);
                    this.displayIndividualAnalysisResult({
                        url: linkUrl,
                        text: linkText,
                        type: linkType,
                        index: linkIndex,
                        error: error.message
                    });
                }
            }
            
            // Remove main progress indicator
            mainProgressDiv.remove();
            
            console.log(`🏁 Analysis completed for all ${selectedCheckboxes.length} links`);
            
        } catch (error) {
            console.error('💥 Error in analysis process:', error);
            // Remove progress indicator if it exists
            const mainProgressDiv = document.querySelector('.main-progress');
            if (mainProgressDiv) {
                mainProgressDiv.remove();
            }
            results.innerHTML += `<div class="result-item warning">Analysis failed: ${error.message}</div>`;
        } finally {
            // Reset button state
            analyzeBtn.disabled = false;
            this.updateAnalyzeButton();
            console.log('🔄 Analysis process finished, button state reset');
        }
    }
    
    // Fetch TOS content from URL
    async fetchToSContent(url) {
        try {
            console.log(`🔍 Starting to fetch TOS content from: ${url}`);
            const response = await fetch(url);
            
            if (response.ok) {
                console.log(`✅ Successfully fetched response from ${url}`);
                console.log(`📊 Response status: ${response.status}`);
                console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);
                
                const html = await response.text();
                console.log(`📄 Raw HTML length: ${html.length} characters`);
                
                // Create a temporary DOM to extract text content
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                console.log('📝 HTML parsed into DOM');
                console.log('🏗️ Document title:', doc.title);
                
                // Remove script and style elements
                const scripts = doc.querySelectorAll('script, style');
                console.log(`🗑️ Removing ${scripts.length} script/style elements`);
                scripts.forEach(el => el.remove());
                
                // Get text content
                const textContent = doc.body.textContent || doc.body.innerText || '';
                console.log(`📝 Extracted text content length: ${textContent.length} characters`);
                
                // Check if content is empty or too short
                if (!textContent || textContent.trim().length < 100) {
                    console.log(`⚠️ Content is empty or too short (${textContent.trim().length} chars), falling back to scrape-and-analyze`);
                    return await this.fallbackToScrapeAndAnalyze(url);
                }
                
                // Show first 500 characters for debugging
                const preview = textContent.substring(0, 500).replace(/\s+/g, ' ').trim();
                console.log(`📖 Content preview (first 500 chars): "${preview}..."`);
                
                // Limit content length (backend might have limits)
                const finalContent = textContent.substring(0, 50000);
                console.log(`✂️ Final content length after truncation: ${finalContent.length} characters`);
                
                return { success: true, content: finalContent };
            } else {
                console.error(`❌ Failed to fetch ${url}. Status: ${response.status} ${response.statusText}`);
                console.log(`🔄 Falling back to scrape-and-analyze due to fetch failure`);
                return await this.fallbackToScrapeAndAnalyze(url);
            }
        } catch (error) {
            console.error('💥 Error fetching TOS content:', error);
            console.error('🔍 Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            console.log(`🔄 Falling back to scrape-and-analyze due to error`);
            return await this.fallbackToScrapeAndAnalyze(url);
        }
    }

    // Fallback to scrape-and-analyze endpoint
    async fallbackToScrapeAndAnalyze(url) {
        try {
            console.log(`🔧 Using scrape-and-analyze fallback for: ${url}`);
            
            const payload = {
                url: url,
                headless: true,
                timeout: 30000
            };
            
            const response = await fetch(`${this.djangoBackendUrl}/scrape-and-analyze/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            console.log(`📡 Scrape-and-analyze response status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Successfully scraped and analyzed with backend');
                console.log('📊 Scrape-and-analyze result:', result);
                
                return {
                    success: true,
                    fromScrapeAndAnalyze: true,
                    analysis: result.analysis,
                    metadata: result.scraping_metadata
                };
            } else {
                const errorText = await response.text();
                console.error(`❌ Scrape-and-analyze error response: ${errorText}`);
                return {
                    success: false,
                    error: `Scrape-and-analyze failed: ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            console.error('💥 Error in scrape-and-analyze fallback:', error);
            return {
                success: false,
                error: `Scrape-and-analyze fallback failed: ${error.message}`
            };
        }
    }

    // Send TOS content to backend for analysis
    async analyzeToSContent(tosText) {
        try {
            console.log(`🚀 Preparing to send content to backend: ${this.djangoBackendUrl}/analyze/`);
            console.log(`📏 Content length being sent: ${tosText.length} characters`);
            
            // Show first 200 characters of what we're sending
            const preview = tosText.substring(0, 200).replace(/\s+/g, ' ').trim();
            console.log(`📤 Sending content preview: "${preview}..."`);
            
            const payload = {
                tos_text: tosText
            };
            
            console.log(`📦 Payload size: ${JSON.stringify(payload).length} bytes`);
            
            const response = await fetch(`${this.djangoBackendUrl}/analyze/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            console.log(`📡 Backend response status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Successfully analyzed with backend:');
                console.log('📊 Analysis result:', result);
                
                // Log specific parts of the analysis
                if (result.summary) {
                    console.log('📝 Summary:', result.summary);
                }
                if (result.key_clauses) {
                    console.log(`🔑 Found ${result.key_clauses.length} key clauses:`, result.key_clauses);
                }
                
                return result;
            } else {
                const errorText = await response.text();
                console.error(`❌ Backend error response: ${errorText}`);
                throw new Error(`Backend responded with status: ${response.status}`);
            }
        } catch (error) {
            console.error('💥 Error sending to backend:', error);
            console.error('🔍 Error details:', {
                name: error.name,
                message: error.message,
                url: this.djangoBackendUrl
            });
            throw error;
        }
    }

    // Display individual analysis result for a single link
    displayIndividualAnalysisResult(result) {
        const resultsContainer = document.getElementById('results');
        const linkIndex = result.index;
        const analysisResultContainer = document.getElementById(`analysis-result-${linkIndex}`);

        if (!analysisResultContainer) {
            console.warn(`Analysis result container for index ${linkIndex} not found.`);
            return;
        }

        let html = '';
        const emoji = result.type === 'tos' ? '📄' : '🔒';

        // Add cache indicator if result is from cache
        const cacheIndicator = result.fromCache ? '<span style="font-size: 10px; opacity: 0.7; margin-left: 8px;">📁 Cached</span>' : '';
        
        if (result.error) {
            html += `
                <div class="result-item warning">
                    ${emoji} <strong>Error analyzing:</strong> ${result.text}<br>
                    <small>${result.error}</small>
                </div>
            `;
        } else if (result.analysis) {
            html += `
                <div class="result-item found analysis-result">
                    <div class="analysis-header">
                        ${emoji} <strong>Analysis Results</strong>${cacheIndicator}
                        <button class="toggle-analysis" data-link-index="${linkIndex}">Show Details</button>
                    </div>
                    <div class="analysis-content" style="display: none;">
                        ${this.formatAnalysisResult(result.analysis)}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="result-item found analysis-result">
                    <div class="analysis-header">
                        ${emoji} <strong>Analysis Results</strong>${cacheIndicator}
                        <button class="toggle-analysis" data-link-index="${linkIndex}">Show Details</button>
                    </div>
                    <div class="analysis-content" style="display: none;">
                        <p>No analysis available for this link.</p>
                    </div>
                </div>
            `;
        }

        analysisResultContainer.innerHTML = html;
        analysisResultContainer.style.display = 'block'; // Show the container

        // Set up toggle buttons for this specific analysis result
        this.setupIndividualAnalysisToggle(linkIndex);
        
        // Store the analysis result for persistence across popup sessions
        this.storeAnalysisResult(result);
    }
    
    // Store analysis result for a specific link
    async storeAnalysisResult(result) {
        try {
            const tab = await this.getCurrentTab();
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            const analysisData = {
                url: result.url,
                text: result.text,
                type: result.type,
                analysis: result.analysis,
                error: result.error
            };
            
            console.log(`💾 Storing analysis result for link ${result.index} on domain ${domain}`);
            this.storeAnalysisResults(domain, result.index, analysisData);
        } catch (error) {
            console.error('Error storing analysis result:', error);
        }
    }

    // Show individual progress indicator for a specific link
    showIndividualProgress(linkIndex, linkText) {
        const analysisResultContainer = document.getElementById(`analysis-result-${linkIndex}`);
        if (!analysisResultContainer) {
            console.warn(`Analysis result container for index ${linkIndex} not found.`);
            return;
        }

        const progressHtml = `
            <div class="result-item found individual-progress">
                <div class="analysis-progress">
                    <div class="spinner"></div>
                    <span>Analyzing: ${linkText}</span>
                </div>
            </div>
        `;

        analysisResultContainer.innerHTML = progressHtml;
        analysisResultContainer.style.display = 'block';
    }

    // Format analysis result for display
    formatAnalysisResult(analysis) {
        let html = '';
        const uniqueId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Always show overall assessment first
        if (analysis.overall_assessment) {
            html += `<div class="analysis-section"><strong>Overall Assessment:</strong><br>${analysis.overall_assessment}</div>`;
        }
        
        // Always show recommendations if available
        if (analysis.recommendations && Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0) {
            html += '<div class="analysis-section"><strong>💡 Recommendations:</strong><ul>';
            analysis.recommendations.forEach(recommendation => {
                html += `<li>${recommendation}</li>`;
            });
            html += '</ul></div>';
        }
        
        // Add toggle button for detailed analysis
        const hasDetailedInfo = (analysis.harmful_clauses_found && analysis.harmful_clauses_found.length > 0) || 
                               analysis.risk_level || 
                               analysis.summary || 
                               (analysis.key_clauses && analysis.key_clauses.length > 0);
        
        if (hasDetailedInfo) {
            html += `
                <div class="analysis-section">
                    <button class="toggle-detailed-analysis" 
                            data-target="${uniqueId}" 
                            style="background: rgba(255,255,255,0.2); border: none; border-radius: 4px; color: white; padding: 6px 12px; font-size: 12px; cursor: pointer; margin-top: 10px;">
                        View Full Analysis
                    </button>
                </div>
            `;
            
            // Detailed analysis content (initially hidden)
            html += `<div id="${uniqueId}" class="detailed-analysis-content" style="display: none;">`;
            
            // Display risk level with appropriate styling
            if (analysis.risk_level) {
                const riskColor = this.getRiskColor(analysis.risk_level);
                html += `<div class="analysis-section"><strong>Risk Level:</strong> <span style="color: ${riskColor}; font-weight: bold;">${analysis.risk_level.toUpperCase()}</span></div>`;
            }
            
            // Display harmful clauses found
            if (analysis.harmful_clauses_found && Array.isArray(analysis.harmful_clauses_found)) {
                if (analysis.harmful_clauses_found.length > 0) {
                    html += '<div class="analysis-section"><strong>⚠️ Harmful Clauses Found:</strong>';
                    analysis.harmful_clauses_found.forEach(clause => {
                        const severityColor = this.getSeverityColor(clause.severity);
                        html += `
                            <div style="margin: 10px 0; padding: 10px; border-left: 4px solid ${severityColor}; background: rgba(255,255,255,0.1);">
                                <strong>${clause.title}</strong> 
                                <span style="color: ${severityColor}; font-size: 12px;">[${clause.severity?.toUpperCase()}]</span>
                                <br><strong>Category:</strong> ${clause.category}
                                <br><strong>Impact:</strong> ${clause.user_impact}
                                <br><strong>Why it's harmful:</strong> ${clause.description}
                                ${clause.clause_text ? `<br><em>Clause text: "${clause.clause_text}"</em>` : ''}
                            </div>
                        `;
                    });
                    html += '</div>';
                } else {
                    html += '<div class="analysis-section"><strong>✅ No Harmful Clauses Found</strong><br>This document appears to be fair to users.</div>';
                }
            }
            
            // Fallback to old format for backward compatibility
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
            
            html += '</div>'; // Close detailed-analysis-content
        }
        
        return html;
    }
    
    // Get color for risk level
    getRiskColor(riskLevel) {
        switch (riskLevel?.toLowerCase()) {
            case 'high': return '#e74c3c';
            case 'medium': return '#f39c12';
            case 'low': return '#27ae60';
            default: return '#f39c12';
        }
    }
    
    // Get color for severity level
    getSeverityColor(severity) {
        switch (severity?.toLowerCase()) {
            case 'high': return '#e74c3c';
            case 'medium': return '#f39c12';
            case 'low': return '#f1c40f';
            default: return '#f39c12';
        }
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
        
        // Set up toggle functionality for detailed analysis buttons
        const detailedToggleButtons = document.querySelectorAll('.toggle-detailed-analysis');
        detailedToggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const detailedContent = document.getElementById(targetId);
                
                if (detailedContent) {
                    const isVisible = detailedContent.style.display !== 'none';
                    detailedContent.style.display = isVisible ? 'none' : 'block';
                    button.textContent = isVisible ? 'View Full Analysis' : 'Hide Full Analysis';
                    
                    // Add hover effect
                    button.style.background = isVisible ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)';
                }
            });
            
            // Add hover effects
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255,255,255,0.3)';
            });
            
            button.addEventListener('mouseleave', () => {
                const targetId = button.getAttribute('data-target');
                const detailedContent = document.getElementById(targetId);
                const isVisible = detailedContent && detailedContent.style.display !== 'none';
                button.style.background = isVisible ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)';
            });
        });
    }

    // Set up toggle functionality for individual analysis results
    setupIndividualAnalysisToggle(linkIndex) {
        const analysisResultContainer = document.getElementById(`analysis-result-${linkIndex}`);
        if (!analysisResultContainer) return;
        
        const toggleButton = analysisResultContainer.querySelector('.toggle-analysis');
        if (toggleButton) {
            // Remove any existing event listeners to prevent duplicates
            toggleButton.replaceWith(toggleButton.cloneNode(true));
            const newToggleButton = analysisResultContainer.querySelector('.toggle-analysis');
            
            newToggleButton.addEventListener('click', () => {
                const analysisContent = analysisResultContainer.querySelector('.analysis-content');
                const isVisible = analysisContent.style.display !== 'none';
                
                analysisContent.style.display = isVisible ? 'none' : 'block';
                newToggleButton.textContent = isVisible ? 'Show Details' : 'Hide Details';
            });
        }
        
        // Set up toggle functionality for detailed analysis buttons
        const detailedToggleButtons = analysisResultContainer.querySelectorAll('.toggle-detailed-analysis');
        detailedToggleButtons.forEach(button => {
            // Remove any existing event listeners to prevent duplicates
            button.replaceWith(button.cloneNode(true));
        });
        
        // Re-select after cloning
        const newDetailedToggleButtons = analysisResultContainer.querySelectorAll('.toggle-detailed-analysis');
        newDetailedToggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const detailedContent = document.getElementById(targetId);
                
                if (detailedContent) {
                    const isVisible = detailedContent.style.display !== 'none';
                    detailedContent.style.display = isVisible ? 'none' : 'block';
                    button.textContent = isVisible ? 'View Full Analysis' : 'Hide Full Analysis';
                    
                    // Add hover effect
                    button.style.background = isVisible ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)';
                }
            });
            
            // Add hover effects
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255,255,255,0.3)';
            });
            
            button.addEventListener('mouseleave', () => {
                const targetId = button.getAttribute('data-target');
                const detailedContent = document.getElementById(targetId);
                const isVisible = detailedContent && detailedContent.style.display !== 'none';
                button.style.background = isVisible ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)';
            });
        });
    }
}

// Initialize the side panel when DOM is loaded
const tosSidePanel = new TOSSidePanel();
