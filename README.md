# TOS Scanner Chrome Extension
Team Alex, Caleb, Mohnish, Charles, Jacob for the Google AI Build Day v4.0 Hackathon

A Chrome extension that automatically scans websites for Terms of Service and Privacy Policy links, then sends them to a Django backend for analysis.

## 🚀 Quick Setup & Testing

### Step 1: Prepare Extension Files

The extension is ready to run with these files:
- `manifest.json` - Extension configuration
- `popup.html` & `popup.js` - Main popup interface
- `content.js` - Page scanning logic
- `background.js` - Background processing
- `sidepanel.html` & `sidepanel.js` - Advanced analytics panel

### Step 2: Add Extension Icons (Optional but Recommended)

Create simple icon files in the `images/` folder:
- `icon-16.png` (16x16 pixels)
- `icon-48.png` (48x48 pixels) 
- `icon-128.png` (128x128 pixels)

You can use any simple icon for now, or the extension will use default Chrome icons.

### Step 3: Load Extension in Chrome

1. **Open Chrome** and go to `chrome://extensions/`

2. **Enable Developer Mode** (toggle in top-right corner)

3. **Click "Load unpacked"**

4. **Select this folder** (`TOSscannerHackathon`)

5. **The extension should appear** in your extensions list

### Step 4: Test the Extension

1. **Visit any website** (try `reddit.com`, `facebook.com`, `google.com`)

2. **Click the extension icon** in the Chrome toolbar (puzzle piece icon if not pinned)

3. **Click "Scan for TOS & Privacy Policies"**

4. **See the results** - it should find relevant links!

### Step 5: Test Different Features

#### Popup Interface:
- Shows current website
- Manual scan button
- Displays found TOS/Privacy links
- Shows backend connection status

#### Side Panel (optional):
- Right-click on extension icon → "Open side panel"
- View scan statistics and history
- Export scan data
- More advanced features

#### Auto-scanning:
- Extension automatically scans pages when you visit them
- Look for badge numbers on the extension icon
- Check scan history in the side panel

## 🔧 Backend Integration (Optional for Testing)

The extension works standalone but can connect to a Django backend. To test with backend:

1. **Update backend URL** in these files:
   - `popup.js` (line 4)
   - `background.js` (line 6)
   - `sidepanel.js` (line 4)

2. **Change from**: `http://localhost:8000/api`
3. **To your Django URL**: `http://your-django-server.com/api`

## 🧪 Test Websites

Try these websites to see the scanner in action:

- **reddit.com** - Has clear privacy policy and user agreement
- **facebook.com** - Multiple policy links
- **twitter.com** - Terms of service in footer
- **github.com** - Privacy and terms links
- **amazon.com** - Various policy pages

## 📊 What You Should See

### Successful Scan Results:
```
Found 2 relevant link(s):
📄 Terms of Service
   User Agreement
   https://reddit.com/user-agreement

🔒 Privacy Policy  
   Privacy Policy
   https://reddit.com/privacy-policy
```

### Extension Features Working:
- ✅ Badge shows number of found links
- ✅ Popup displays scan results
- ✅ Side panel shows statistics
- ✅ Auto-scanning on page load
- ✅ Local storage of results

## 🐛 Troubleshooting

### Extension Not Loading:
- Check that all files are in the same folder
- Refresh the extensions page
- Check Chrome console for errors

### No Scan Results:
- Try different websites
- Check browser console (F12) for errors
- Some sites may block content scripts

### Backend Connection Issues:
- Extension works without backend
- Check CORS settings on Django server
- Verify backend URL is correct

## 🔄 Making Changes

After editing any files:
1. Go to `chrome://extensions/`
2. Click the refresh button on your extension
3. Test the changes

## 📝 Next Steps

1. **Test thoroughly** on various websites
2. **Add your Django backend** URLs
3. **Customize the UI** styling
4. **Add more scanning patterns** for different sites
5. **Implement advanced analysis** features

## 🎯 Sample Test Flow

1. Load extension in Chrome
2. Visit reddit.com
3. Click extension icon
4. Click "Scan for TOS & Privacy Policies"
5. Should see: User Agreement and Privacy Policy links
6. Open side panel to see scan history
7. Visit another site and repeat

The extension is ready to run and test immediately!
