from django.urls import path
from django.shortcuts import render
from django.contrib.auth.decorators import login_required


def landing(request):
    return render(request, 'index.html')

def login_page(request):
    return render(request, 'auth/login.html')

def register_page(request):
    return render(request, 'auth/register.html')

def customer_dashboard(request):
    return render(request, 'customer/dashboard.html')

def mechanic_dashboard(request):
    return render(request, 'mechanic/dashboard.html')

def admin_dashboard(request):
    return render(request, 'admin/dashboard.html')

def tow_dashboard(request):
    return render(request, 'tow/dashboard.html')

def sos_page(request):
    return render(request, 'sos.html')


urlpatterns = [
    path('', landing, name='landing'),
    path('auth/login/', login_page, name='login'),
    path('auth/register/', register_page, name='register'),
    path('customer/dashboard/', customer_dashboard, name='customer-dashboard'),
    path('mechanic/dashboard/', mechanic_dashboard, name='mechanic-dashboard'),
    path('admin-panel/', admin_dashboard, name='admin-dashboard'),
    path('tow/dashboard/', tow_dashboard, name='tow-dashboard'),
    path('sos/', sos_page, name='sos'),
]
