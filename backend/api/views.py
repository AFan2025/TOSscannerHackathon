# In api/views.py
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from google import genai
from google.genai import types
import json
from .scraper import scrape_url_sync

class HealthCheckView(APIView):
    """
    Simple health check endpoint to verify the backend is running.
    """
    def get(self, request, *args, **kwargs):
        return Response(
            {
                "status": "healthy",
                "message": "TOS Scanner backend is running",
                "timestamp": "2024-01-01T00:00:00Z"  # You can use timezone.now() if needed
            },
            status=status.HTTP_200_OK
        )

class AnalyzeToSView(APIView):
    """
    API endpoint that accepts ToS text and uses the Google Gemini API
    for analysis, enforcing a JSON response.
    """
    def post(self, request, *args, **kwargs):
        # 1. Extract text from the incoming request
        tos_text = request.data.get('tos_text')

        if not tos_text:
            return Response(
                {"error": "Field 'tos_text' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Configure the Gemini client with the API key
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            return Response(
                {"error": "API key configuration error. Ensure GEMINI_API_KEY is set correctly."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 3. Define the system prompt for the LLM
        prompt = (
            "You are an expert legal assistant specialized in analyzing Terms of Service agreements. "
            "Analyze the following text. Your response MUST be a valid JSON object. "
            "Provide a main 'summary' in simple, easy-to-understand language. "
            "Then, create a list of 'key_clauses', where each item in the list is an object with a 'title' "
            "for the clause type (e.g., 'Data Privacy', 'Content Ownership', 'Arbitration') and a 'details' "
            "string explaining the user's rights and obligations for that clause. "
            "Here is the text to analyze:\n\n"
            f"{tos_text}"
        )

        # 4. Make the API call
        try:
            response = client.models.generate_content(
                model="gemini-2.5-pro",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,  # Some creativity but not too much
                    thinking_config=types.ThinkingConfig(thinking_budget=1024),
                ),
            )
            
            # 5. Process the response
            response_text = response.text
            
            # Check if response_text is None
            if not response_text:
                return Response(
                    {"error": "Empty response from Gemini API"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # 6. Parse the JSON response
            try:
                analysis_result = json.loads(response_text)
            except json.JSONDecodeError:
                # If the response is not valid JSON, try to extract JSON from the text
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    try:
                        analysis_result = json.loads(json_match.group())
                    except json.JSONDecodeError:
                        # If still not valid JSON, return a structured error
                        analysis_result = {
                            "error": "Failed to parse JSON response",
                            "raw_response": response_text
                        }
                else:
                    analysis_result = {
                        "error": "No JSON found in response",
                        "raw_response": response_text
                    }
            
            return Response(analysis_result, status=status.HTTP_200_OK)

        except Exception as e:
            # Handle API call errors or other exceptions
            return Response(
                {"error": f"An error occurred during Gemini API call: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ScrapeWebpageView(APIView):
    """
    API endpoint that accepts a URL and returns the scraped text content.
    """
    def post(self, request, *args, **kwargs):
        # Extract URL from the incoming request
        url = request.data.get('url')
        headless = request.data.get('headless', True)
        timeout = request.data.get('timeout', 30000)
        
        if not url:
            return Response(
                {"error": "Field 'url' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Scrape the webpage
            result = scrape_url_sync(url, headless=headless, timeout=timeout)
            
            if result['success']:
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(
                    {"error": result['error'], "url": url},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            return Response(
                {"error": f"An error occurred during scraping: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ScrapeAndAnalyzeView(APIView):
    """
    API endpoint that combines scraping and TOS analysis.
    Accepts a URL, scrapes the content, and analyzes it using Gemini.
    """
    def post(self, request, *args, **kwargs):
        # Extract URL from the incoming request
        url = request.data.get('url')
        headless = request.data.get('headless', True)
        timeout = request.data.get('timeout', 30000)
        
        if not url:
            return Response(
                {"error": "Field 'url' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Step 1: Scrape the webpage
            scrape_result = scrape_url_sync(url, headless=headless, timeout=timeout)
            
            if not scrape_result['success']:
                return Response(
                    {"error": f"Failed to scrape webpage: {scrape_result['error']}", "url": url},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Step 2: Analyze the scraped text with Gemini
            tos_text = scrape_result['text']
            
            if not tos_text or len(tos_text.strip()) < 100:
                return Response(
                    {"error": "Scraped content is too short to analyze (minimum 100 characters required)"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Configure the Gemini client
            try:
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                return Response(
                    {"error": "API key configuration error. Ensure GEMINI_API_KEY is set correctly."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Define the system prompt for the LLM
            prompt = (
                "You are an expert legal assistant specialized in analyzing Terms of Service agreements. "
                "Analyze the following scraped webpage text. Your response MUST be a valid JSON object. "
                "Provide a main 'summary' in simple, easy-to-understand language. "
                "Then, create a list of 'key_clauses', where each item in the list is an object with a 'title' "
                "for the clause type (e.g., 'Data Privacy', 'Content Ownership', 'Arbitration') and a 'details' "
                "string explaining the user's rights and obligations for that clause. "
                "Here is the scraped text to analyze:\n\n"
                f"{tos_text}"
            )
            
            # Make the API call
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                        thinking_config=types.ThinkingConfig(thinking_budget=1024),
                    ),
                )
                
                # Process the response
                response_text = response.text
                
                if not response_text:
                    return Response(
                        {"error": "Empty response from Gemini API"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                
                # Parse the JSON response
                try:
                    analysis_result = json.loads(response_text)
                except json.JSONDecodeError:
                    import re
                    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                    if json_match:
                        try:
                            analysis_result = json.loads(json_match.group())
                        except json.JSONDecodeError:
                            analysis_result = {
                                "error": "Failed to parse JSON response",
                                "raw_response": response_text
                            }
                    else:
                        analysis_result = {
                            "error": "No JSON found in response",
                            "raw_response": response_text
                        }
                
                # Combine scraping metadata with analysis results
                final_result = {
                    "scraping_metadata": {
                        "url": scrape_result['url'],
                        "original_url": scrape_result['original_url'],
                        "title": scrape_result['title'],
                        "word_count": scrape_result['word_count'],
                        "character_count": scrape_result['character_count'],
                        "meta_description": scrape_result['meta_description']
                    },
                    "analysis": analysis_result
                }
                
                return Response(final_result, status=status.HTTP_200_OK)
                
            except Exception as e:
                return Response(
                    {"error": f"An error occurred during Gemini API call: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except Exception as e:
            return Response(
                {"error": f"An error occurred during scraping and analysis: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )