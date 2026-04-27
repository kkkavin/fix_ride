from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

CHATBOT_RULES = {
    'book': "To book a mechanic, go to your Customer Dashboard and click 'Book a Mechanic'. Fill in your vehicle type, describe the issue, and select urgency. Our system will find the nearest mechanic for you!",
    'mechanic': "Our mechanics are verified professionals. Once you book, the nearest available mechanic will be assigned to you automatically.",
    'track': "You can track your booking status in real-time on your Customer Dashboard. Status updates from Pending → Accepted → En Route → Arrived → Completed.",
    'payment': "Payment is simulated in this platform. You'll see a service charge after the job is completed. We support UPI, Card, and Cash on Service.",
    'cancel': "To cancel a booking, open the booking detail and click 'Cancel'. You can cancel before the mechanic arrives.",
    'review': "After your service is completed, you can leave a rating (1-5 stars) and a comment for your mechanic.",
    'register': "Click 'Register' on the homepage. Choose your role (Customer or Mechanic) and fill in your details.",
    'login': "Click 'Login' on the homepage. Enter your username and password. Forgot password? Contact support.",
    'price': "Service charges vary by job type. Typical charges: Basic checkup ₹200-500, Tire change ₹300-800, Battery jump ₹300-600, Engine repair ₹1000+.",
    'tyre': "For tyre/tire issues, book a mechanic with urgency 'Emergency' if you are stranded. Mention 'flat tyre' in the issue description.",
    'battery': "For dead battery, select 'Emergency' urgency. Our mechanic can jump-start or replace your battery on-site.",
    'fuel': "Running out of fuel? Some mechanics offer fuel delivery. Mention it in your issue description.",
    'hello': "Hello! Welcome to Fix_Ride 👋 I'm your virtual assistant. How can I help you today?",
    'hi': "Hi there! 👋 I'm Fix_Ride's assistant. Ask me about booking, mechanics, pricing, or tracking your service.",
    'help': "I can help you with: Booking a mechanic, Tracking your service, Understanding pricing, Registration/Login, Canceling a booking. Type any of these topics!",
}

DEFAULT_RESPONSE = ("I'm not sure I understood that. Try asking about: 'book', 'track', 'payment', "
                    "'cancel', 'review', 'price', 'tyre', 'battery', or type 'help'.")


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_response(request):
    message = request.data.get('message', '').lower().strip()
    if not message:
        return Response({'reply': "Please type a message."})

    for keyword, reply in CHATBOT_RULES.items():
        if keyword in message:
            return Response({'reply': reply})

    return Response({'reply': DEFAULT_RESPONSE})
