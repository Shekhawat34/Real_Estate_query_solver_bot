//ChatMessage.js
import React from 'react';
import PropertyCard from './PropertyCard';

const ChatMessage=({ message })=>{
  return (
    <div className={`message ${message.sender}`}>
      <div className="message-content">
        <p>{message.text}</p>
        {message.properties && message.properties.length > 0 && (
          <div className="properties-container">
            {message.properties.map((property, index) => (
              <PropertyCard key={index} property={property} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;