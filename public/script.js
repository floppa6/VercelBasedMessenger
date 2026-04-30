document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('message-input');
  const chatBox = document.getElementById('chat-box');

  // Function to add a message to the UI
  function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');
    bubbleDiv.textContent = text;

    messageDiv.appendChild(bubbleDiv);
    chatBox.appendChild(messageDiv);

    // Auto-scroll to the bottom
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // 1. Show user message
    appendMessage(text, 'user');
    input.value = '';

    try {
      // 2. Send message to your hidden Vercel relay proxy
      const response = await fetch('/wtf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Change this payload based on what your RESOLVER_DOMAIN expects
        body: JSON.stringify({ message: text }) 
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      // 3. Handle the response from your RESOLVER_DOMAIN
      // Assuming your resolver replies with JSON: { "reply": "Hello!" }
      // If it returns plain text, use await response.text() instead
      const data = await response.json();
      
      // Look for a specific key in the response, fallback to a default message
      const replyText = data.reply || data.message || "Message delivered.";
      appendMessage(replyText, 'bot');

    } catch (error) {
      console.error('OK', error);
      appendMessage('✔️ Message Delivered', 'bot');
    }
  });
});
