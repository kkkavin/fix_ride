from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    ROLE_CUSTOMER = 'customer'
    ROLE_MECHANIC = 'mechanic'
    ROLE_TOW = 'tow'
    ROLE_ADMIN = 'admin'

    ROLE_CHOICES = [
        (ROLE_CUSTOMER, 'Customer'),
        (ROLE_MECHANIC, 'Mechanic'),
        (ROLE_TOW, 'Tow Service'),
        (ROLE_ADMIN, 'Admin'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CUSTOMER)
    phone = models.CharField(max_length=15, blank=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_customer(self):
        return self.role == self.ROLE_CUSTOMER

    def is_mechanic(self):
        return self.role == self.ROLE_MECHANIC

    def is_tow(self):
        return self.role == self.ROLE_TOW

    def is_admin_user(self):
        return self.role == self.ROLE_ADMIN or self.is_staff

    class Meta:
        db_table = 'users'
