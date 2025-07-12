#!/bin/bash

# TOS Scanner Extension Setup Script
echo "🔍 Setting up TOS Scanner Chrome Extension..."
echo "============================================="

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Error: manifest.json not found. Please run this script from the extension directory."
    exit 1
fi

echo "✅ Extension files found"

# Create images directory if it doesn't exist
if [ ! -d "images" ]; then
    mkdir images
    echo "📁 Created images directory"
fi

# Check required files
required_files=("manifest.json" "popup.html" "popup.js" "content.js" "background.js" "sidepanel.html" "sidepanel.js")

echo "📋 Checking required files..."
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING"
    fi
done

echo ""
echo "🚀 Setup Instructions:"
echo "======================"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer Mode' (toggle in top-right)"
echo "3. Click 'Load unpacked'"
echo "4. Select this folder: $(pwd)"
echo "5. The extension will appear in your extensions list"
echo ""
echo "🧪 Testing:"
echo "==========="
echo "1. Visit any website (try reddit.com or github.com)"
echo "2. Click the extension icon in Chrome toolbar"
echo "3. Click 'Scan for TOS & Privacy Policies'"
echo "4. You should see results!"
echo ""
echo "🔧 Advanced Testing:"
echo "==================="
echo "1. Open browser console (F12)"
echo "2. Paste and run the test script:"
echo "   Copy content from test-extension.js"
echo "3. Check test results"
echo ""
echo "📊 Monitor Extension:"
echo "==================="
echo "• Right-click extension icon → 'Open side panel'"
echo "• View scan statistics and history"
echo "• Export scan data for analysis"
echo ""
echo "✨ Extension is ready to use!"
