// Content script - runs on every webpage
// This script scans the current page for TOS and Privacy Policy links

class TOSScanner {
    constructor() {
        this.tosTerms = [
            'terms of service', 'terms of use', 'user agreement', 'terms and conditions',
            'service agreement', 'user terms', 'website terms', 'terms & conditions',
            'tos', 'terms', 'user policy', 'service terms'
        ];
        
        this.privacyTerms = [
            'privacy policy', 'privacy notice', 'privacy statement', 'data policy',
            'cookie policy', 'privacy practices', 'data protection', 'privacy & cookies',
            'privacy', 'data usage', 'information collection', 'data security', 'cookies',
            'information usage', 'data collection', 'user privacy', 'privacy practices'
        ];
        
        this.foundLinks = [];
    }
    
    // Main scanning function
    scanPage() {
        console.log('TOS Scanner: Starting page scan...');
        this.foundLinks = [];
        
        // Find all links on the page
        const allLinks = document.querySelectorAll('a[href]');
        
        allLinks.forEach(link => {
            const linkText = link.textContent.toLowerCase().trim();
            const linkHref = link.getAttribute('href');
            const linkUrl = this.resolveUrl(linkHref);
            
            // Check for TOS links
            if (this.containsTerms(linkText, this.tosTerms) || this.containsTerms(linkUrl, this.tosTerms)) {
                this.foundLinks.push({
                    type: 'tos',
                    text: link.textContent.trim(),
                    url: linkUrl,
                    element: link
                });
            }
            
            // Check for Privacy Policy links
            if (this.containsTerms(linkText, this.privacyTerms) || this.containsTerms(linkUrl, this.privacyTerms)) {
                this.foundLinks.push({
                    type: 'privacy',
                    text: link.textContent.trim(),
                    url: linkUrl,
                    element: link
                });
            }
        });
        
        // Also check for common footer patterns
        this.scanFooter();
        
        // Also check for common navigation patterns
        this.scanNavigation();
        
        console.log(`TOS Scanner: Found ${this.foundLinks.length} relevant links`);
        return this.foundLinks;
    }
    
    // Scan footer for legal links
    scanFooter() {
        const footers = document.querySelectorAll('footer, .footer, #footer, [class*="footer"]');
        footers.forEach(footer => {
            const links = footer.querySelectorAll('a[href]');
            this.processLinks(links);
        });
    }
    
    // Scan navigation for legal links
    scanNavigation() {
        const navs = document.querySelectorAll('nav, .nav, #nav, [class*="nav"], .menu, #menu, [class*="menu"]');
        navs.forEach(nav => {
            const links = nav.querySelectorAll('a[href]');
            this.processLinks(links);
        });
    }
    
    // Process a set of links
    processLinks(links) {
        links.forEach(link => {
            const linkText = link.textContent.toLowerCase().trim();
            const linkHref = link.getAttribute('href');
            const linkUrl = this.resolveUrl(linkHref);
            
            if (this.containsTerms(linkText, [...this.tosTerms, ...this.privacyTerms]) || 
                this.containsTerms(linkUrl, [...this.tosTerms, ...this.privacyTerms])) {
                
                // Avoid duplicates
                const isDuplicate = this.foundLinks.some(existing => existing.url === linkUrl);
                if (!isDuplicate) {
                    const type = this.containsTerms(linkText, this.tosTerms) || this.containsTerms(linkUrl, this.tosTerms) ? 'tos' : 'privacy';
                    this.foundLinks.push({
                        type: type,
                        text: link.textContent.trim(),
                        url: linkUrl,
                        element: link
                    });
                }
            }
        });
    }
    
    // Check if text contains any of the search terms
    containsTerms(text, terms) {
        const lowerText = text.toLowerCase();
        return terms.some(term => lowerText.includes(term));
    }
    
    // Resolve relative URLs to absolute URLs
    resolveUrl(href) {
        if (!href) return '';
        
        try {
            // If it's already an absolute URL, return as is
            if (href.startsWith('http://') || href.startsWith('https://')) {
                return href;
            }
            
            // Create absolute URL from relative
            const baseUrl = window.location.origin;
            const currentPath = window.location.pathname;
            
            if (href.startsWith('/')) {
                return baseUrl + href;
            } else if (href.startsWith('./')) {
                const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                return baseUrl + basePath + href.substring(2);
            } else if (href.startsWith('../')) {
                let pathParts = currentPath.split('/').filter(part => part);
                let hrefParts = href.split('/');
                
                hrefParts.forEach(part => {
                    if (part === '..') {
                        pathParts.pop();
                    } else if (part !== '.') {
                        pathParts.push(part);
                    }
                });
                
                return baseUrl + '/' + pathParts.join('/');
            } else {
                const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                return baseUrl + basePath + href;
            }
        } catch (error) {
            console.error('Error resolving URL:', href, error);
            return href;
        }
    }
    
    // Extract text content from a TOS/Privacy page
    async extractPageContent(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            // Create a temporary DOM to parse the content
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Remove script and style elements
            const scripts = doc.querySelectorAll('script, style, nav, header, footer');
            scripts.forEach(el => el.remove());
            
            // Get the main content
            const mainContent = doc.querySelector('main, .main, #main, .content, #content, .container, #container') || doc.body;
            
            return {
                title: doc.title || '',
                content: mainContent.textContent.trim(),
                url: url
            };
        } catch (error) {
            console.error('Error extracting content from:', url, error);
            return null;
        }
    }
    
    // Highlight found links on the page
    highlightLinks() {
        this.foundLinks.forEach(link => {
            if (link.element) {
                link.element.style.border = '2px solid #ff6b6b';
                link.element.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
                link.element.title = `TOS Scanner found: ${link.type} link`;
            }
        });
    }
    
    // Remove highlighting
    removeHighlighting() {
        this.foundLinks.forEach(link => {
            if (link.element) {
                link.element.style.border = '';
                link.element.style.backgroundColor = '';
                link.element.title = '';
            }
        });
    }
}

// Initialize the scanner
const tosScanner = new TOSScanner();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanPage') {
        const results = tosScanner.scanPage();
        sendResponse({
            success: true,
            results: results,
            pageInfo: {
                title: document.title,
                url: window.location.href,
                domain: window.location.hostname
            }
        });
    } else if (request.action === 'highlightLinks') {
        tosScanner.highlightLinks();
        sendResponse({ success: true });
    } else if (request.action === 'removeHighlighting') {
        tosScanner.removeHighlighting();
        sendResponse({ success: true });
    } else if (request.action === 'extractContent') {
        tosScanner.extractPageContent(request.url).then(content => {
            sendResponse({ success: true, content: content });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep the message channel open for async response
    }
});

// Auto-scan when page loads (optional)
window.addEventListener('load', () => {
    setTimeout(() => {
        const results = tosScanner.scanPage();
        if (results.length > 0) {
            // Store results for popup to access
            chrome.storage.local.set({
                [`scan_${window.location.hostname}`]: {
                    timestamp: Date.now(),
                    results: results,
                    pageInfo: {
                        title: document.title,
                        url: window.location.href,
                        domain: window.location.hostname
                    }
                }
            });
        }
    }, 2000);
});

console.log('TOS Scanner content script loaded');
