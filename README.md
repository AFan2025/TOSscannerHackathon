# TOS Scanner Extension

A Chrome extension that scans and analyzes Terms of Service and Privacy Policy agreements to help users understand potentially harmful clauses.

## Features

- **Automatic TOS Detection**: Scans web pages for Terms of Service and Privacy Policy links
- **AI-Powered Analysis**: Uses a Django backend with AI to analyze TOS content for harmful clauses
- **Multiple Interfaces**: 
  - **Popup**: Quick access via extension icon
  - **Side Panel**: Resizable, persistent workspace for detailed analysis
- **Persistent Results**: Analysis results are cached and survive browser sessions
- **Risk Assessment**: Categorizes clauses by severity (High, Medium, Low)
- **Detailed Reporting**: Shows specific harmful clauses with explanations

## Side Panel Access

The TOS Scanner provides multiple ways to access the side panel:

### Method 1: From Popup
1. Click the extension icon in the toolbar
2. Click the "📋 Open Side Panel" button

### Method 2: Right-Click Context Menu
1. Right-click anywhere on a webpage
2. Select "📋 Open TOS Scanner Side Panel"

### Method 3: Keyboard Shortcut
- **Windows/Linux**: `Ctrl + Shift + S`
- **Mac**: `Cmd + Shift + S`

## Testing Side Panel Functionality

To test if the side panel is working correctly:

1. **Check Chrome Version**: Ensure you're using Chrome 114 or later
2. **Open Developer Console**: 
   - Right-click → Inspect → Console tab
   - Look for side panel setup messages when the extension loads
3. **Try Multiple Access Methods**: Test all three methods above
4. **Check for Error Messages**: If side panel doesn't open, check console for helpful error messages

### Expected Console Messages
```
✅ Side panel available via multiple access methods:
  1. Right-click menu
  2. Keyboard shortcut (Ctrl+Shift+S)
  3. Button in popup
Side panel options: {enabled: true, path: "sidepanel.html"}
```

### Troubleshooting
- **"Side panel API not available"**: Update Chrome to version 114+
- **Permission errors**: Verify `sidePanel` permission in manifest.json
- **Side panel won't open**: Try different access methods, check console errors

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. Test the side panel functionality using the methods above

## Backend Setup

The extension works with a Django backend for AI analysis. See `backend/README_SCRAPER.md` for setup instructions.

## File Structure

```
├── popup.html/js          # Main popup interface
├── sidepanel.html/js      # Resizable side panel interface
├── content.js             # Page scanning functionality
├── background.js          # Extension coordination
└── backend/               # Django AI analysis backend
```
