from django.urls import path
from .views import AnalyzeToSView, HealthCheckView, ScrapeWebpageView, ScrapeAndAnalyzeView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('analyze/', AnalyzeToSView.as_view(), name='analyze-tos'),
    path('scrape/', ScrapeWebpageView.as_view(), name='scrape-webpage'),
    path('scrape-and-analyze/', ScrapeAndAnalyzeView.as_view(), name='scrape-and-analyze'),
]