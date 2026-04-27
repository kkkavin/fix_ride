import os
import django
import random
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fix_ride.settings')
django.setup()

from django.contrib.auth import get_user_model
from mechanics.models import MechanicProfile
from bookings.models import Booking, Review, Message

User = get_user_model()

def run():
    print("Clearing existing data...")
    Booking.objects.all().delete()
    MechanicProfile.objects.all().delete()
    User.objects.all().delete()
    
    # Create ADMIN
    print("Creating admin...")
    admin = User.objects.create_superuser(
        username='admin',
        email='admin@fixride.com',
        password='admin',
        first_name='Admin',
        last_name='User'
    )
    # Ensure role is set for our custom logic if needed
    admin.role = 'customer' # role doesn't matter much since is_superuser=True
    admin.save()

    # Create CUSTOMERS
    print("Creating customers...")
    customers = []
    customer_data = [
        ('rahul', 'Rahul', 'Sharma', '9876543210'),
        ('priya', 'Priya', 'Singh', '9876543211'),
        ('amit', 'Amit', 'Patel', '9876543212'),
        ('neha', 'Neha', 'Gupta', '9876543213'),
        ('rohit', 'Rohit', 'Kumar', '9876543214'),
    ]
    for username, first, last, phone in customer_data:
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password='password123',
            first_name=first,
            last_name=last,
            role='customer',
            phone=phone
        )
        customers.append(user)

    # Create MECHANICS
    print("Creating mechanics...")
    mechanics = []
    mechanic_data = [
        ('mech_raj', 'Rajesh', 'Mechanic', '9998887771', 'Engine, Tyres, Battery', 5, True, True),
        ('mech_suresh', 'Suresh', 'Auto', '9998887772', 'AC Repair, Engine', 8, True, True),
        ('mech_arun', 'Arun', 'Motors', '9998887773', 'Tyres, Towing, Battery', 3, True, False), # Offline
        ('mech_vijay', 'Vijay', 'Garage', '9998887774', 'Full Service, Engine', 10, True, True),
        ('mech_new', 'New', 'Mech', '9998887775', 'Battery', 1, False, False), # Pending approval
    ]
    
    # Base location (Bangalore roughly)
    base_lat = 12.9716
    base_lng = 77.5946

    for username, first, last, phone, skills, exp, approved, online in mechanic_data:
        user = User.objects.create_user(
            username=username,
            email=f"{username}@fixride.com",
            password='password123',
            first_name=first,
            last_name=last,
            role='mechanic',
            phone=phone
        )
        
        # Add random offset to location
        lat = base_lat + random.uniform(-0.05, 0.05)
        lng = base_lng + random.uniform(-0.05, 0.05)
        
        prof = MechanicProfile.objects.create(
            user=user,
            is_approved=approved,
            is_available=online,
            skills=skills,
            experience_years=exp,
            lat=lat,
            lng=lng,
            total_jobs=random.randint(10, 50) if approved else 0,
            total_earnings=random.randint(5000, 25000) if approved else 0
        )
        if approved:
            mechanics.append(prof)

    # Create BOOKINGS
    print("Creating bookings...")
    vehicles = ['bike', 'car', 'auto']
    issues = [
        "Car won't start, battery seems dead.",
        "Flat tyre in the middle of the road.",
        "Engine overheating and smoking.",
        "AC stopped working suddenly.",
        "Brake noise, need urgent check.",
        "Need a general service and oil change.",
        "Clutch is very hard and stuck."
    ]
    urgencies = ['low', 'medium', 'high', 'emergency']
    statuses = ['completed', 'completed', 'completed', 'cancelled', 'in_progress', 'pending', 'accepted', 'en_route', 'arrived']
    
    now = timezone.now()

    for i in range(25):
        cust = random.choice(customers)
        status = random.choice(statuses)
        mech = None
        
        if status != 'pending':
            mech = random.choice(mechanics)
            
        # Time offset
        days_ago = random.randint(0, 30)
        created = now - timedelta(days=days_ago, hours=random.randint(0, 23))
        
        b = Booking.objects.create(
            customer=cust,
            mechanic=mech,
            vehicle_type=random.choice(vehicles),
            issue_description=random.choice(issues),
            customer_lat=base_lat + random.uniform(-0.05, 0.05),
            customer_lng=base_lng + random.uniform(-0.05, 0.05),
            status=status,
            urgency=random.choice(urgencies),
            distance_km=round(random.uniform(1.0, 15.0), 1) if mech else None,
            service_charge=random.choice([250, 500, 800, 1200, 1500]) if status == 'completed' else 0,
            created_at=created
        )
        
        # Override auto_now_add
        Booking.objects.filter(id=b.id).update(created_at=created)

        # Reviews for completed
        if status == 'completed':
            Review.objects.create(
                booking=b,
                rating=random.randint(3, 5),
                comment="Good service." if random.random() > 0.5 else "Very helpful and fast."
            )
            
        # Add messages for active bookings
        if status in ['accepted', 'en_route', 'arrived', 'in_progress']:
            Message.objects.create(booking=b, sender=cust, content="Hi, how long will it take to reach?")
            Message.objects.create(booking=b, sender=mech.user, content="I am on the way, usually takes 10 mins.")

    print("\n--- SEEDING COMPLETE ---")
    print("Admin:   u: admin / p: admin")
    print("Cust:    u: rahul / p: password123")
    print("Mech:    u: mech_raj / p: password123")

if __name__ == '__main__':
    run()
