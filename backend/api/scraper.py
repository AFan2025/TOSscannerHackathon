"""
Playwright-based web scraping utility for extracting text content from web pages.
"""
import asyncio
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebScraper:
    """
    A robust web scraper using Playwright for extracting text content from web pages.
    """
    
    def __init__(self, headless: bool = True, timeout: int = 30000):
        """
        Initialize the WebScraper.
        
        Args:
            headless (bool): Whether to run browser in headless mode
            timeout (int): Timeout in milliseconds for page operations
        """
        self.headless = headless
        self.timeout = timeout
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
        
    async def start(self):
        """Start the browser and create context."""
        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=self.headless)
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            )
            logger.info("Browser started successfully")
        except Exception as e:
            logger.error(f"Failed to start browser: {e}")
            raise
    
    async def close(self):
        """Close the browser and cleanup."""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if hasattr(self, 'playwright'):
                await self.playwright.stop()
            logger.info("Browser closed successfully")
        except Exception as e:
            logger.error(f"Error closing browser: {e}")
    
    def _is_valid_url(self, url: str) -> bool:
        """
        Validate if the URL is properly formatted.
        
        Args:
            url (str): URL to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text.
        
        Args:
            text (str): Raw text to clean
            
        Returns:
            str: Cleaned text
        """
        if not text:
            return ""
        
        # Remove extra whitespace and normalize
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove common unwanted characters
        text = re.sub(r'[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\'\"\/\@\#\$\%\&\*\+\=\<\>]', '', text)
        
        return text
    
    async def scrape_page(self, url: str, wait_for_selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Scrape text content from a web page.
        
        Args:
            url (str): URL to scrape
            wait_for_selector (Optional[str]): CSS selector to wait for before scraping
            
        Returns:
            Dict[str, Any]: Dictionary containing scraped data and metadata
        """
        if not self._is_valid_url(url):
            raise ValueError(f"Invalid URL: {url}")
        
        if not self.context:
            raise RuntimeError("Browser context not initialized. Call start() first.")
        
        page = None
        try:
            page = await self.context.new_page()
            
            # Set timeout
            page.set_default_timeout(self.timeout)
            
            logger.info(f"Navigating to: {url}")
            await page.goto(url, wait_until='networkidle')
            
            # Wait for specific selector if provided
            if wait_for_selector:
                logger.info(f"Waiting for selector: {wait_for_selector}")
                await page.wait_for_selector(wait_for_selector, timeout=self.timeout)
            
            # Extract page title
            title = await page.title()
            
            # Extract main text content
            # Try to get text from main content areas first
            main_text = ""
            main_selectors = [
                'main',
                'article',
                '[role="main"]',
                '.main-content',
                '.content',
                '#content',
                '.post-content',
                '.article-content'
            ]
            
            for selector in main_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    if elements:
                        for element in elements:
                            text = await element.inner_text()
                            if text and len(text.strip()) > 100:  # Only consider substantial text
                                main_text += text + "\n"
                        if main_text:
                            break
                except Exception as e:
                    logger.warning(f"Failed to extract text from selector {selector}: {e}")
                    continue
            
            # Fallback to body if no main content found
            if not main_text:
                logger.info("No main content found, falling back to body")
                try:
                    body_element = await page.query_selector('body')
                    if body_element:
                        main_text = await body_element.inner_text()
                except Exception as e:
                    logger.error(f"Failed to extract body text: {e}")
                    main_text = ""
            
            # Clean the extracted text
            cleaned_text = self._clean_text(main_text)
            
            # Extract meta information
            meta_description = ""
            try:
                meta_desc_element = await page.query_selector('meta[name="description"]')
                if meta_desc_element:
                    meta_description = await meta_desc_element.get_attribute('content') or ""
            except Exception as e:
                logger.warning(f"Failed to extract meta description: {e}")
            
            # Get page URL (might be different from input URL due to redirects)
            final_url = page.url
            
            # Count words and characters
            word_count = len(cleaned_text.split()) if cleaned_text else 0
            char_count = len(cleaned_text) if cleaned_text else 0
            
            result = {
                'url': final_url,
                'original_url': url,
                'title': title,
                'text': cleaned_text,
                'meta_description': meta_description,
                'word_count': word_count,
                'character_count': char_count,
                'success': True,
                'error': None
            }
            
            logger.info(f"Successfully scraped {word_count} words from {url}")
            return result
            
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            return {
                'url': url,
                'original_url': url,
                'title': '',
                'text': '',
                'meta_description': '',
                'word_count': 0,
                'character_count': 0,
                'success': False,
                'error': str(e)
            }
        
        finally:
            if page:
                await page.close()

# Convenience function for one-off scraping
async def scrape_url(url: str, headless: bool = True, timeout: int = 30000) -> Dict[str, Any]:
    """
    Scrape a single URL and return the results.
    
    Args:
        url (str): URL to scrape
        headless (bool): Whether to run browser in headless mode
        timeout (int): Timeout in milliseconds
        
    Returns:
        Dict[str, Any]: Scraped data and metadata
    """
    async with WebScraper(headless=headless, timeout=timeout) as scraper:
        return await scraper.scrape_page(url)

# Synchronous wrapper for Django views
def scrape_url_sync(url: str, headless: bool = True, timeout: int = 30000) -> Dict[str, Any]:
    """
    Synchronous wrapper for scraping URLs.
    
    Args:
        url (str): URL to scrape
        headless (bool): Whether to run browser in headless mode
        timeout (int): Timeout in milliseconds
        
    Returns:
        Dict[str, Any]: Scraped data and metadata
    """
    try:
        return asyncio.run(scrape_url(url, headless, timeout))
    except Exception as e:
        logger.error(f"Error in synchronous scraping: {e}")
        return {
            'url': url,
            'original_url': url,
            'title': '',
            'text': '',
            'meta_description': '',
            'word_count': 0,
            'character_count': 0,
            'success': False,
            'error': str(e)
        } 