// App Initialization
console.log('Roadside Rescue App Initialized');

document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Global Chatbot Injection
    if (!document.getElementById('chatbot-btn')) {
        const chatbotHTML = `
            <div id="chatbot-btn" onclick="toggleChat()" style="position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: var(--color-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 5px 20px rgba(0,0,0,0.5); cursor: pointer; z-index: 9999; transition: transform 0.3s ease;">
                <ion-icon name="chatbubbles"></ion-icon>
            </div>
            <div id="chatbot-window" class="card glass" style="position: fixed; bottom: 90px; right: 20px; width: 320px; height: 450px; display: none; flex-direction: column; z-index: 9999; padding: 0; overflow: hidden;">
                <div style="background: rgba(255, 107, 0, 0.2); padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0;">Support Assist</h4>
                    <ion-icon name="close" onclick="toggleChat()" style="cursor: pointer; font-size: 1.5rem;"></ion-icon>
                </div>
                <div id="chat-messages" style="flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="background: rgba(255,255,255,0.1); padding: 0.5rem 1rem; border-radius: 10px 10px 10px 0; max-width: 80%; align-self: flex-start;">
                        Hello! Welcome to FixRide. How can we help?
                    </div>
                </div>
                <div style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 0.5rem;">
                    <input type="text" id="chat-input" class="input-field" placeholder="Type..." style="border-radius: 20px; padding: 0.5rem 1rem;" onkeypress="handleChat(event)">
                    <button class="btn btn-primary" style="padding: 0.5rem; border-radius: 50%;" onclick="sendChat()">
                        <ion-icon name="send"></ion-icon>
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    }
});

// Global Chatbot Functions
window.toggleChat = function () {
    const win = document.getElementById('chatbot-window');
    const btn = document.getElementById('chatbot-btn');
    if (win.style.display === 'none' || win.style.display === '') {
        win.style.display = 'flex';
        btn.style.transform = 'rotate(90deg) scale(0)';
    } else {
        win.style.display = 'none';
        btn.style.transform = 'rotate(0deg) scale(1)';
    }
};

window.handleChat = function (e) {
    if (e.key === 'Enter') sendChat();
};

window.sendChat = function () {
    const input = document.getElementById('chat-input');
    const msgs = document.getElementById('chat-messages');
    const text = input.value.trim();

    if (text) {
        const userDiv = document.createElement('div');
        userDiv.style.cssText = 'background: var(--color-primary); color: white; padding: 0.5rem 1rem; border-radius: 10px 10px 0 10px; max-width: 80%; align-self: flex-end;';
        userDiv.textContent = text;
        msgs.appendChild(userDiv);
        input.value = '';
        msgs.scrollTop = msgs.scrollHeight;

        setTimeout(() => {
            const botDiv = document.createElement('div');
            botDiv.style.cssText = 'background: rgba(255,255,255,0.1); padding: 0.5rem 1rem; border-radius: 10px 10px 10px 0; max-width: 80%; align-self: flex-start;';
            botDiv.textContent = "Thanks. An agent will connect shortly.";
            msgs.appendChild(botDiv);
            msgs.scrollTop = msgs.scrollHeight;
        }, 1000);
    }
};
