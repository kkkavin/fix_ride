from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.register_view, name='api-register'),
    path('guest/login/', views.guest_login, name='api-guest-login'),
    path('login/', TokenObtainPairView.as_view(), name='api-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('profile/', views.profile_view, name='api-profile'),
    path('me/', views.check_auth, name='api-me'),
]
