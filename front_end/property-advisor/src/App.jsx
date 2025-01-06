import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: "Hello, Welcome to Prestige Constructions, How may I help you?",
      sender: 'bot',
      isGreeting: true
    }
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    const scrollTimeout = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(scrollTimeout);
  }, [messages]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { text: trimmedInput, sender: 'user' }]);
    setInput(''); //Clear input immediately
    scrollToBottom();
    try {
      
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: trimmedInput
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if the response is not the greeting message
      const isNotGreeting = data.response !== messages[0].text;

      // Only add bot response if it's not a greeting or if it has properties
      if (data.response && (isNotGreeting || data.properties?.length > 0)) {
        const botMessage = {
          text: data.response,
          sender: 'bot',
          properties: data.properties || []
        };
        setMessages(prev => [...prev, botMessage]);
      } //Append bot message

    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'bot'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false); //End loading state
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Prestige Genie</h1>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            message={message}
            className = {message.visible ? 'visible' : ''}
          />
        ))}
        {isLoading && <div className="loading-spinner"></div>} 
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isLoading ? "Please wait..." : "Type your message..."}
          disabled={isLoading}
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className={`send-button ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default App;