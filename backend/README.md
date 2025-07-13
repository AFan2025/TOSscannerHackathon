# TOS Scanner Backend

A Django REST API backend for the TOS Scanner Chrome extension that provides web scraping and AI-powered Terms of Service analysis capabilities.

## Features

- **Web Scraping**: Playwright-based scraping for JavaScript-rendered content
- **AI Analysis**: Google Gemini AI integration for TOS content analysis
- **RESTful API**: Well-documented endpoints for frontend integration
- **CORS Support**: Configured for Chrome extension communication
- **Error Handling**: Comprehensive error handling and logging
- **Async Support**: Both synchronous and asynchronous scraping capabilities

## Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Internet connection for downloading browser binaries

### 1. Clone and Navigate

```bash
git clone <repository-url>
cd backend
```

### 2. Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Python Dependencies

```bash
# Install standard dependencies
pip install -r requirements.txt

# Install Google Gemini AI (separate command as requested)
pip install -q -U google-genai
```

### 4. Install Playwright Browsers

```bash
# Install browser binaries
playwright install

# Install system dependencies (Linux/Ubuntu only)
# Skip this on Windows/macOS
playwright install-deps
```

### 5. Configure Environment Variables

Create a `.env` file in the backend directory or set the following environment variable:

```bash
# Option 1: Create .env file
echo "GEMINI_API_KEY=your_actual_gemini_api_key_here" > .env

# Option 2: Set environment variable directly
# Windows:
set GEMINI_API_KEY=your_actual_gemini_api_key_here
# macOS/Linux:
export GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> **Note**: Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 6. Database Setup

```bash
# Apply database migrations
python manage.py migrate

# Create superuser (optional, for admin access)
python manage.py createsuperuser
```

### 7. Start Development Server

```bash
# Start the server
python manage.py runserver

# Server will be available at: http://localhost:8000
```

## API Endpoints

### Health Check
```
GET /api/health/
```
Returns server status and basic information.

### Analyze TOS Text
```
POST /api/analyze/
Content-Type: application/json

{
    "tos_text": "Your terms of service text here..."
}
```

### Scrape Webpage
```
POST /api/scrape/
Content-Type: application/json

{
    "url": "https://example.com/terms",
    "headless": true,        // Optional, default: true
    "timeout": 30000         // Optional, default: 30000ms
}
```

### Scrape and Analyze
```
POST /api/scrape-and-analyze/
Content-Type: application/json

{
    "url": "https://example.com/terms",
    "headless": true,        // Optional, default: true
    "timeout": 30000         // Optional, default: 30000ms
}
```

## Testing the Setup

### 1. Health Check
```bash
curl http://localhost:8000/api/health/
```

### 2. Test Scraping
```bash
curl -X POST http://localhost:8000/api/scrape/ \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://example.com"}'
```

### 3. Test Analysis (requires Gemini API key)
```bash
curl -X POST http://localhost:8000/api/analyze/ \
     -H 'Content-Type: application/json' \
     -d '{"tos_text": "This is a sample terms of service text."}'
```

## Configuration

### Django Settings

Key configuration options in `tos_scanner/settings.py`:

```python
# CORS settings (for Chrome extension)
CORS_ALLOW_ALL_ORIGINS = True  # Development only

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# API Key (use environment variable in production)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
```

### Playwright Configuration

The scraper uses the following default settings:
- Headless mode: `True`
- Timeout: `30000ms`
- User Agent: Chrome/Desktop
- JavaScript enabled: `True`

## Development Workflow

### Running with Auto-reload
```bash
# Django auto-reloads on file changes
python manage.py runserver
```

### Running Tests
```bash
# Run all tests
python manage.py test

# Run specific test file
python test_scraper.py
```

### Debug Mode
The server runs in debug mode by default (`DEBUG = True`). This provides:
- Detailed error pages
- Auto-reloading on code changes
- SQL query logging
- Static file serving

## Troubleshooting

### Common Issues

#### 1. "playwright command not found"
```bash
# Make sure you're in the virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Reinstall playwright
pip install playwright
playwright install
```

#### 2. "Browser not found" errors
```bash
# Reinstall browsers
playwright install
```

#### 3. CORS errors from Chrome extension
- Ensure `django-cors-headers` is installed
- Check that `CORS_ALLOW_ALL_ORIGINS = True` in settings
- Verify the extension is making requests to the correct URL

#### 4. Gemini API errors
- Verify your API key is correct
- Check if you have API quota/billing enabled
- Ensure the environment variable is set correctly

#### 5. Database errors
```bash
# Reset database
rm db.sqlite3
python manage.py migrate
```

### Debug Commands

```bash
# Check Python environment
python --version
pip list

# Check Django configuration
python manage.py check

# Check database status
python manage.py showmigrations

# Test Playwright installation
python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')"
```

## Project Structure

```
backend/
├── manage.py              # Django management script
├── requirements.txt       # Python dependencies
├── db.sqlite3            # SQLite database
├── .env                  # Environment variables (create this)
├── tos_scanner/          # Django project settings
│   ├── __init__.py
│   ├── settings.py       # Main configuration
│   ├── urls.py          # URL routing
│   └── wsgi.py          # WSGI configuration
└── api/                  # Main API app
    ├── __init__.py
    ├── models.py         # Database models
    ├── views.py          # API endpoints
    ├── urls.py           # API URL patterns
    ├── scraper.py        # Playwright scraping logic
    └── migrations/       # Database migrations
```

## Production Considerations

While this README focuses on development deployment, consider these for production:

### Security
- Set `DEBUG = False`
- Use environment variables for sensitive data
- Configure proper CORS origins (not `CORS_ALLOW_ALL_ORIGINS`)
- Use a production database (PostgreSQL, MySQL)
- Set up proper logging

### Performance
- Use a proper WSGI server (Gunicorn, uWSGI)
- Set up a reverse proxy (Nginx, Apache)
- Configure static file serving
- Consider caching for frequent requests

### Monitoring
- Set up health checks
- Monitor API response times
- Track error rates
- Monitor resource usage

## Support

If you encounter issues:

1. Check the [Django documentation](https://docs.djangoproject.com/)
2. Review [Playwright documentation](https://playwright.dev/python/)
3. Check [Google Gemini AI documentation](https://developers.generativeai.google/)
4. Look for similar issues in the project repository

## License

[Add your license information here] 