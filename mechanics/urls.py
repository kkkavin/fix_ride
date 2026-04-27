from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.mechanic_profile, name='mechanic-profile'),
    path('availability/', views.toggle_availability, name='mechanic-availability'),
    path('nearby/', views.nearby_mechanics, name='nearby-mechanics'),
]
