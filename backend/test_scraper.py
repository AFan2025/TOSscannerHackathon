#!/usr/bin/env python
"""
Test script for the Playwright web scraper.
This script demonstrates how to use the scraping functionality.
"""

import asyncio
import json
from api.scraper import scrape_url, scrape_url_sync, WebScraper

def test_sync_scraping():
    """Test synchronous scraping function."""
    print("🧪 Testing synchronous scraping...")
    
    # Test URLs
    test_urls = [
        "https://example.com",
        "https://httpbin.org/html",
        "https://github.com/terms",
    ]
    
    for url in test_urls:
        print(f"\n📄 Scraping: {url}")
        try:
            result = scrape_url_sync(url)
            if result['success']:
                print(f"✅ Success!")
                print(f"   Title: {result['title']}")
                print(f"   Word count: {result['word_count']}")
                print(f"   Character count: {result['character_count']}")
                print(f"   Text preview: {result['text'][:200]}...")
            else:
                print(f"❌ Failed: {result['error']}")
        except Exception as e:
            print(f"❌ Exception: {e}")

async def test_async_scraping():
    """Test asynchronous scraping function."""
    print("\n🧪 Testing asynchronous scraping...")
    
    # Test URLs
    test_urls = [
        "https://example.com",
        "https://httpbin.org/html",
    ]
    
    for url in test_urls:
        print(f"\n📄 Scraping: {url}")
        try:
            result = await scrape_url(url)
            if result['success']:
                print(f"✅ Success!")
                print(f"   Title: {result['title']}")
                print(f"   Word count: {result['word_count']}")
                print(f"   Character count: {result['character_count']}")
                print(f"   Text preview: {result['text'][:200]}...")
            else:
                print(f"❌ Failed: {result['error']}")
        except Exception as e:
            print(f"❌ Exception: {e}")

async def test_web_scraper_class():
    """Test the WebScraper class for batch scraping."""
    print("\n🧪 Testing WebScraper class...")
    
    test_urls = [
        "https://example.com",
        "https://httpbin.org/html",
    ]
    
    async with WebScraper(headless=True) as scraper:
        for url in test_urls:
            print(f"\n📄 Scraping: {url}")
            try:
                result = await scraper.scrape_page(url)
                if result['success']:
                    print(f"✅ Success!")
                    print(f"   Title: {result['title']}")
                    print(f"   Word count: {result['word_count']}")
                    print(f"   Character count: {result['character_count']}")
                    print(f"   Text preview: {result['text'][:200]}...")
                else:
                    print(f"❌ Failed: {result['error']}")
            except Exception as e:
                print(f"❌ Exception: {e}")

def test_api_endpoints():
    """Test the API endpoints (requires Django server running)."""
    print("\n🧪 Testing API endpoints...")
    print("📝 To test the API endpoints, start your Django server and run:")
    print()
    print("# Test scraping endpoint")
    print("curl -X POST http://localhost:8000/api/scrape/ \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"url\": \"https://example.com\"}'")
    print()
    print("# Test scrape and analyze endpoint")
    print("curl -X POST http://localhost:8000/api/scrape-and-analyze/ \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"url\": \"https://github.com/terms\"}'")
    print()
    print("# Test with custom timeout")
    print("curl -X POST http://localhost:8000/api/scrape/ \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"url\": \"https://example.com\", \"timeout\": 10000}'")

async def main():
    """Main test function."""
    print("🎭 Playwright Web Scraper Test Suite")
    print("=" * 50)
    
    # Test synchronous scraping
    test_sync_scraping()
    
    # Test asynchronous scraping
    await test_async_scraping()
    
    # Test WebScraper class
    await test_web_scraper_class()
    
    # Show API testing examples
    test_api_endpoints()
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    # Run the test suite
    asyncio.run(main()) 