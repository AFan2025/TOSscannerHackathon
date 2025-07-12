from django.urls import path
from .views import AnalyzeToSView

urlpatterns = [
    path('analyze/', AnalyzeToSView.as_view(), name='analyze-tos'),
]